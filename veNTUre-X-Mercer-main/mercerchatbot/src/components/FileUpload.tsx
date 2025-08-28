import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";

export interface FileUploadHandle {
  openFileDialog: () => void;
}

interface FileUploadProps {
  onFile: (file: File) => void;
}

const FileUpload = forwardRef<FileUploadHandle, FileUploadProps>(
  ({ onFile }, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);

    // Expose openFileDialog to parent
    useImperativeHandle(ref, () => ({
      openFileDialog: () => {
        fileInputRef.current?.click();
      },
    }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFile(e.target.files[0]);
      }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFile(e.dataTransfer.files[0]);
      }
    };

    return (
      <div
        className={`relative flex flex-col items-center justify-center p-4 border-2 ${
          dragActive
            ? "border-blue-600 bg-blue-50"
            : "border-dashed border-gray-300"
        } rounded-lg transition`}
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
        style={{ cursor: "pointer" }}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="text-blue-700 font-semibold mb-2">
          Drag & drop PDF here, or click to upload
        </span>
        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }
);

export default FileUpload;
