import React, { useState, useRef } from "react";

export default function MessageInput({
  onSend,
  disabled = false,
}: {
  onSend: (msg: string, file?: File) => void;
  disabled?: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (msg.trim() || file) {
      onSend(msg, file || undefined);
      setMsg("");
      setFile(null);
      setDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      }
      e.dataTransfer.clearData();
    }
  };

  return (
    <form
      className={`flex gap-2 border-t px-4 py-2 bg-white items-center ${
        dragActive ? "border-blue-600 bg-blue-50" : ""
      }`}
      onSubmit={handleSend}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive ? (
        <span className="flex-1 text-center text-blue-600 font-semibold">
          Drop PDF here
        </span>
      ) : (
        <>
          <button
            type="button"
            className="p-2 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a PDF"
            disabled={disabled}
          >
            +
          </button>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0])
                setFile(e.target.files[0]);
            }}
            disabled={disabled}
          />
          {file && (
            <span className="text-blue-600 text-xs truncate max-w-[100px]">
              {file.name}
            </span>
          )}
          <input
            type="text"
            className="flex-1 border rounded px-3 py-2"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Type your message..."
            disabled={disabled}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
            disabled={disabled}
          >
            Send
          </button>
        </>
      )}
    </form>
  );
}
