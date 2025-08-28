import React, { useRef, useState } from "react";

interface WelcomeBannerProps {
  onFileUpload: (file: File) => void;
  onStartNewChat: () => void;
}

export default function WelcomeBanner({
  onFileUpload,
  onStartNewChat,
}: WelcomeBannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center h-full py-12">
      <div className="text-4xl md:text-5xl font-extrabold text-blue-700 mb-4 tracking-tight">
        MercerChat
      </div>
      <div className="text-lg md:text-xl text-gray-700 mb-6 max-w-xl text-center">
        Instantly understand your insurance documents.
        <br />
        Ask any question, get AI-powered answers!
      </div>
      {/* Get Started Button */}
      <button
        className="px-6 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition text-lg mb-6"
        onClick={onStartNewChat}
      >
        Get Started
      </button>
      {/* OR separator */}
      <div className="flex items-center w-full max-w-md mb-6">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="px-4 text-gray-500 font-semibold">OR</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>
      {/* Dropzone area */}
      <div
        className={`relative flex flex-col items-center justify-center w-full max-w-md p-6 mb-4 border-2 ${
          dragActive
            ? "border-blue-600 bg-blue-50"
            : "border-dashed border-gray-300"
        } rounded-lg transition cursor-pointer`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="text-blue-700 font-semibold mb-2">
          Click here to add policy files or drag and drop
        </span>
        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      <div className="mt-8 text-gray-400 text-sm text-center">
        Secure, private, and tailored for your insurance needs.
        <br />
        Upload your PDF policies and chat today.
      </div>
    </section>
  );
}
