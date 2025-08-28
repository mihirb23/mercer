from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, io, uuid, gc, textwrap, pathlib
import requests
from datetime import datetime, timedelta
import tempfile
import shutil

from pdf2image import convert_from_bytes
from google.cloud import storage
from PIL.PngImagePlugin import PngInfo
import pytesseract

# --- OCR must be available (fail fast) ---
if not shutil.which("tesseract"):
    raise RuntimeError("Tesseract binary not found on PATH. Install `tesseract-ocr` in the container/host.")

try:
    TESS_VERSION = str(pytesseract.get_tesseract_version())
except Exception as e:
    raise RuntimeError(f"pytesseract not usable: {e}")

OCR_LANG = os.getenv("OCR_LANG", "eng")  # e.g., "eng" or "eng+deu"

app = FastAPI(title="MercerChat backend (JSON-only, GCS upload)")

DEBUG_LOG = os.getenv("DEBUG_LOG", "1") == "1"

def _log(msg: str):
    if DEBUG_LOG:
        print(f"[backend] {msg}", flush=True)

# --- CORS (for browser access from the frontend) ---
# You can override the allowed origins via env FRONTEND_ORIGINS (comma-separated).
_origins_env = os.getenv("FRONTEND_ORIGINS", "")
if _origins_env.strip():
    CORS_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    # sensible defaults for local dev
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_log(f"CORS enabled for origins: {CORS_ORIGINS}")
_log(f"OCR ready: tesseract {TESS_VERSION} lang='{OCR_LANG}'")

# =========================
# Config
# =========================
GCS_BUCKET = os.getenv("GCS_BUCKET")
SIGNED_URL_TTL_MIN = int(os.getenv("SIGNED_URL_TTL_MIN", "15"))

GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL")
GPU_BEARER_TOKEN = os.getenv("GPU_BEARER_TOKEN", "")
GPU_TIMEOUT_SEC = int(os.getenv("GPU_TIMEOUT_SEC", "180"))

if not GCS_BUCKET:
    raise RuntimeError("GCS_BUCKET not set.")

# GCS client
try:
    gcs_client = storage.Client()
    gcs_bucket = gcs_client.bucket(GCS_BUCKET)
    _log(f"GCS initialized. Bucket='{GCS_BUCKET}'")
except Exception as e:
    raise RuntimeError(f"GCS init failed: {e}")

# =========================
# Helpers
# =========================
def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def ocr_image_to_text(img) -> str:
    """
    OCR a PIL image to text using tesseract (mandatory).
    """
    im = img.convert("RGB")
    w, h = im.size
    # Light upscaling for better OCR on small scans
    if max(w, h) < 1600:
        scale = 1600.0 / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)))

    # Tune psm/oem if needed; psm 4 is good for block text
    config = "--psm 4"
    try:
        txt = pytesseract.image_to_string(im, lang=OCR_LANG, config=config)
        txt = txt.replace("\r\n", "\n").replace("\r", "\n").strip()
        return txt
    except Exception as e:
        # OCR is required; surface the error
        raise RuntimeError(f"OCR failed: {e}")

def make_doc_id() -> str:
    return uuid.uuid4().hex[:16]

def png_bytes_with_meta(img, meta: dict) -> bytes:
    info = PngInfo()
    for k, v in meta.items():
        try:
            info.add_text(str(k), str(v))
        except Exception:
            info.add_text(str(k), "")
    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=info)
    return buf.getvalue()

def pil_images_from_pdf_bytes(pdf_bytes: bytes, dpi: int = 400):
    return convert_from_bytes(pdf_bytes, dpi=dpi, fmt="png")

def gcs_put_and_sign(key: str, data: bytes, content_type: str, metadata: dict | None = None) -> str:
    blob = gcs_bucket.blob(key)
    if metadata:
        blob.metadata = metadata
    blob.upload_from_string(data, content_type=content_type)
    signed = blob.generate_signed_url(expiration=timedelta(minutes=SIGNED_URL_TTL_MIN), method="GET")
    _log(f"GCS UPLOAD ok key='{key}' ct='{content_type}' size={len(data)} signed={bool(signed)}")
    return signed

def gcs_sign_only(key: str) -> str:
    """
    Generate a signed GET URL for an existing object in GCS.
    """
    blob = gcs_bucket.blob(key)
    return blob.generate_signed_url(expiration=timedelta(minutes=SIGNED_URL_TTL_MIN), method="GET")

def process_pdf_to_gcs(conversation_id: str, file_path: str, original_filename: str) -> dict:
    """
    Read PDF from file_path, upload original + rendered pages to GCS.
    Return {conversation_id, doc_id, pdf_key, pages_count}
    """
    conv = conversation_id or "no-conv"
    doc_id = make_doc_id()
    safe_name = original_filename

    # Read file
    try:
        with open(file_path, "rb") as f:
            raw = f.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")
    if not raw:
        raise HTTPException(status_code=400, detail="File is empty.")

    _log(f"PDF READ ok name='{safe_name}' bytes={len(raw)} conv='{conv}' doc_id='{doc_id}'")

    # Upload original PDF
    pdf_key = f"pdfs/{conv}/{doc_id}.pdf"
    gcs_put_and_sign(
        pdf_key, raw,
        content_type="application/pdf",
        metadata={
            "original_filename": safe_name,
            "conversation_id": conv,
            "doc_id": doc_id,
            "uploaded_at": _now_iso(),
        },
    )

    # Render pages → upload
    pil_pages = pil_images_from_pdf_bytes(raw, dpi=400)
    _log(f"PDF RENDER ok pages={len(pil_pages)}")

    for i, img in enumerate(pil_pages, start=1):
        meta = {
            "conversation_id": conv,
            "doc_id": doc_id,
            "page_number": str(i),
            "source_pdf_key": pdf_key,
            "original_filename": safe_name,
        }
        png_bytes = png_bytes_with_meta(img, meta)
        img_key = f"pages/{conv}/{doc_id}/page_{i}.png"
        gcs_put_and_sign(img_key, png_bytes, content_type="image/png", metadata=meta)

        # --- OCR current page and upload text ---
        try:
            ocr_text = ocr_image_to_text(img)
        except Exception as _e:
            _log(f"[OCR][WARN] unexpected OCR error on page {i}: {_e}")
            ocr_text = ""

        txt_meta = {
            **meta,
            "source_image_key": img_key,
            "ocr_engine": "tesseract",
            "ocr_version": TESS_VERSION,
            "ocr_lang": OCR_LANG,
            "ocr_at": _now_iso(),
            "content_type": "text/plain; charset=utf-8",
        }
        txt_key = f"text/{conv}/{doc_id}/page_{i}.txt"
        try:
            gcs_put_and_sign(
                txt_key,
                (ocr_text or "").encode("utf-8"),
                content_type="text/plain; charset=utf-8",
                metadata=txt_meta,
            )
        except Exception as _e:
            _log(f"[OCR][WARN] failed to upload OCR text for page {i} to {txt_key}: {_e}")

    gc.collect()
    return {
        "conversation_id": conv,
        "doc_id": doc_id,
        "pdf_key": pdf_key,
        "pages_count": len(pil_pages),
    }

def call_gpu_backend(conversation_id: str, human: str, doc_id: str | None = None) -> dict:
    if not GPU_BACKEND_URL:
        return {"ai": "(stub) GPU_BACKEND_URL not configured.", "conversation_id": conversation_id}

    url = GPU_BACKEND_URL.rstrip("/") + "/ingest-and-answer"
    payload = {"conversation_id": conversation_id, "human": human}
    if doc_id:
        payload["doc_id"] = doc_id

    headers = {"Content-Type": "application/json"}
    if GPU_BEARER_TOKEN:
        headers["Authorization"] = f"Bearer {GPU_BEARER_TOKEN}"

    _log("GPU REQ → " + textwrap.shorten(f"POST {url} json={payload}", width=180))
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=GPU_TIMEOUT_SEC)
        resp.raise_for_status()
        body = resp.json()
        # If GPU backend returned page image keys, attach signed URLs for the frontend
        try:
            pages_used = body.get("pages_used", []) or []
            if isinstance(pages_used, list):
                signed_urls = []
                for k in pages_used:
                    try:
                        if isinstance(k, str) and k:
                            signed_urls.append(gcs_sign_only(k))
                    except Exception as _e:
                        _log(f"[WARN] failed to sign page key '{k}': {_e}")
                body["page_image_urls"] = signed_urls

                # New logic: fetch metadata for each page key
                page_info_list = []
                for k in pages_used:
                    try:
                        if isinstance(k, str) and k:
                            blob = gcs_bucket.blob(k)
                            blob.reload()
                            meta = blob.metadata or {}
                            pdf_name = meta.get("original_filename")
                            page_number = meta.get("page_number")
                            page_info_list.append({
                                "page_key": k,
                                "pdf_name": pdf_name,
                                "page_number": page_number,
                            })
                    except Exception as _e:
                        _log(f"[WARN] failed to fetch metadata for page key '{k}': {_e}")
                body["page_info"] = page_info_list
        except Exception as _e:
            _log(f"[WARN] post-process pages_used failed: {_e}")
        _log(f"GPU RESP ← {body}")
        return body
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GPU backend error: {e}")

# =========================
# Routes
# =========================
@app.get("/")
async def root():
    return {"status": "MercerChat backend running 🚀", "time": _now_iso()}

@app.post("/chat")
async def chat(
    human: str = Form(...),
    conversation_id: str = Form(""),
    pdf_file: UploadFile | None = File(None),
    original_filename: str  = Form(""),
):
    doc_id = None
    if pdf_file:
        try:
            suffix = pathlib.Path(pdf_file.filename).suffix if pdf_file.filename else ".pdf"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp_path = tmp.name
                content = await pdf_file.read()
                tmp.write(content)
            result = process_pdf_to_gcs(conversation_id, tmp_path, original_filename)
            doc_id = result["doc_id"]
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    return call_gpu_backend(conversation_id, human, doc_id)