import React, { useState, useRef, useEffect, FC } from "react";
import MessageInput from "./MessageInput";
import { marked } from "marked";
import DOMPurify from "dompurify";

type SourceInfo = {
  pdfName?: string;
  pageNumber?: number;
};

type Message = {
  role: "human" | "AI";
  content: string;
  sources?: SourceInfo[]; // parsed from backend.page_info
  images?: string[]; // parsed from backend.page_image_urls (signed URLs)
};

// Render Markdown using marked.js + DOMPurify (better handling of LLM newlines/tables)
const MarkdownRenderer: FC<{ content: string }> = ({ content }) => {
  // Normalize double-escaped newlines from some LLMs ("\\n" -> "\n")
  const normalized = (content ?? "").replace(/\\n/g, "\n");

  // Configure marked once per module
  marked.setOptions({
    gfm: true,
    breaks: true, // respect single newlines
    async: false, // force sync output so types are string, not Promise<string>
  });

  const html = marked.parse(normalized) as string;
  const safe = DOMPurify.sanitize(html);

  return (
    <div
      className="prose prose-sm md:prose-base max-w-none whitespace-pre-wrap leading-relaxed"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (msg: string, file?: File) => {
    // Generate a conversation ID only on the first message (regardless of file upload)
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = "123";
      setConversationId(currentConversationId);
    }

    // Add user's message
    setMessages((prev) => [...prev, { role: "human", content: msg }]);
    setLoading(true);

    try {
      // Always send multipart/form-data so the backend path is consistent.
      const formData = new FormData();
      formData.append("human", msg);
      formData.append("conversation_id", currentConversationId || "");
      if (file) {
        // Send the file *and* the original filename explicitly so the backend
        // doesn’t have to rely on temp names produced by the server.
        formData.append("pdf_file", file);
        formData.append("original_filename", file.name);

        // Immediately add a “system-style” message to display the filename
        setMessages((prev) => [
          ...prev,
          {
            role: "AI",
            content: `📄 Uploaded file: **${file.name}**`,
          },
        ]);
      }

      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        body: formData, // Do NOT set Content-Type; the browser will set the correct boundary.
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Backend error ${response.status}: ${text || response.statusText}`
        );
      }

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Failed to parse JSON from backend");
      }

      if (data.conversation_id) setConversationId(data.conversation_id);

      // Prefer new unified page_refs: [{ page_key, pdf_name, page_number, url }]
      const refs = Array.isArray(data.page_refs) ? data.page_refs : [];

      const sourcesFromRefs: SourceInfo[] = refs
        .map((r: any) => {
          const pnRaw = r?.page_number ?? r?.page;
          const pn =
            typeof pnRaw === "number"
              ? pnRaw
              : typeof pnRaw === "string" && /^\d+$/.test(pnRaw)
              ? parseInt(pnRaw, 10)
              : undefined;

          const pdfName =
            r?.pdf_name ??
            r?.original_filename ??
            (typeof r?.pdfName === "string" ? r.pdfName : undefined);

          return {
            pdfName,
            pageNumber: pn,
          } as SourceInfo;
        })
        .filter(Boolean);

      const imagesFromRefs: string[] = refs
        .map((r: any) => r?.url)
        .filter((u: any) => typeof u === "string" && u.length > 0);

      // Fallbacks if page_refs not present
      const sourcesFromLegacy: SourceInfo[] = Array.isArray(data.page_info)
        ? data.page_info.map((p: any) => {
            const pnRaw = p?.page_number ?? p?.page;
            const pn =
              typeof pnRaw === "number"
                ? pnRaw
                : typeof pnRaw === "string" && /^\d+$/.test(pnRaw)
                ? parseInt(pnRaw, 10)
                : undefined;

            const pdfName =
              p?.pdf_name ??
              p?.original_filename ??
              (typeof p?.pdfName === "string" ? p.pdfName : undefined);

            return { pdfName, pageNumber: pn } as SourceInfo;
          })
        : [];

      const imagesFromLegacy: string[] = Array.isArray(data.page_image_urls)
        ? data.page_image_urls.filter(
            (u: any) => typeof u === "string" && u.length > 0
          )
        : [];

      const parsedSources: SourceInfo[] =
        sourcesFromRefs.length > 0 ? sourcesFromRefs : sourcesFromLegacy;

      const parsedImages: string[] =
        imagesFromRefs.length > 0 ? imagesFromRefs : imagesFromLegacy;

      setMessages((current) => [
        ...current,
        {
          role: "AI",
          content: data.ai || "No response from server",
          sources: parsedSources,
          images: parsedImages,
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((current) => [
        ...current,
        { role: "AI", content: "Error connecting to backend" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-white">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-gray-400 text-lg text-center px-2">
          Welcome to MercerChat! <br />
          Send a message or upload a PDF to get started.
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto w-full mx-auto flex flex-col gap-4 py-4 px-4 sm:px-6 md:px-8 max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-[90%] 2xl:max-w-[95%]"
        >
          {messages.map((msg: Message, idx: number) =>
            msg.role === "human" ? (
              <div
                key={idx}
                className={`self-end bg-blue-100 text-blue-900 px-4 py-2 rounded-xl max-w-[90%] ${
                  idx === 0 ? "mt-2" : "my-1"
                }`}
              >
                {msg.content}
              </div>
            ) : (
              <div
                key={idx}
                className={`self-start text-gray-900 max-w-[90%] px-1 ${
                  idx === 0 ? "mt-2" : "my-1"
                }`}
                style={{ background: "none", borderRadius: 0 }}
              >
                {/* Answer (Markdown) */}
                <MarkdownRenderer content={msg.content} />

                {/* Sources (PDF name + page numbers) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 border-l-4 border-gray-300 pl-3">
                    <div className="text-sm font-semibold text-gray-700">
                      Sources
                    </div>
                    <ul className="mt-1 text-sm text-gray-700 list-disc list-inside space-y-0.5">
                      {msg.sources.map((s, i) => (
                        <li key={i}>
                          {s.pdfName ? (
                            <>
                              PDF:{" "}
                              <span className="font-medium">{s.pdfName}</span>
                            </>
                          ) : (
                            <>
                              PDF:{" "}
                              <span className="italic text-gray-500">
                                unknown
                              </span>
                            </>
                          )}
                          {typeof s.pageNumber === "number" && (
                            <> — Page {s.pageNumber}</>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Retrieved page images */}
                {msg.images && msg.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {msg.images.map((url, i) => (
                      <div
                        key={i}
                        className="rounded border border-gray-200 p-2"
                      >
                        <img
                          src={url}
                          alt={`Retrieved page ${i + 1}`}
                          className="w-full h-auto rounded"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
      <MessageInput onSend={handleSend} disabled={loading} />
    </main>
  );
}
