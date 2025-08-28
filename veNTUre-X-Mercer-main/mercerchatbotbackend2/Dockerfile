# Use a slim Python base
FROM python:3.11-slim

# Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UPLOAD_ROOT=/data/uploads

# System packages (add poppler-utils for pdf2image AND tesseract-ocr for pytesseract)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Workdir
WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements.txt .
RUN pip install -r requirements.txt

# App code
COPY app ./app

# Create upload dir
RUN mkdir -p /data/uploads

# Expose port
EXPOSE 8000

# Start FastAPI with auto-reload (drop --reload in production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]