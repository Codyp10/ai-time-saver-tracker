import { useCallback, useState } from "react";

const ACCEPTED =
  ".zip,.json,.jsonl,.db,.vscdb,application/json,application/zip,application/x-sqlite3";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

function isAcceptedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".zip") ||
    lower.endsWith(".json") ||
    lower.endsWith(".jsonl") ||
    lower.endsWith(".db") ||
    lower.endsWith(".vscdb")
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

export function UploadZone({ onFiles, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => isAcceptedFile(f.name));
      if (files.length) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`group relative block border-2 border-dashed rounded-3xl p-10 sm:p-16 text-center cursor-pointer neon-glow-hover transition-all duration-300 ${
        dragOver
          ? "border-wrap-500 bg-wrap-500/5"
          : "border-white/10 bg-surface-800/30"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => isAcceptedFile(f.name));
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className="relative z-10">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-wrap-500/10 text-wrap-500 group-hover:scale-110 transition-transform">
          <UploadIcon />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold mb-3">Drop your export files here</h3>
        <p className="text-text-muted max-w-md mx-auto">
          Multiple files supported — e.g. Claude zip, ChatGPT export, and Cursor log together.
        </p>
        <p className="text-wrap-500/60 text-sm mt-4 font-medium">
          Parsed on your device; nothing is uploaded. Up to 20 files, 200 MB each.
        </p>
      </div>
    </label>
  );
}
