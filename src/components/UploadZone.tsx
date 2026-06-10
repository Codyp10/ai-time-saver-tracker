import { useCallback, useState } from "react";

const ACCEPTED_EXTENSIONS = [".zip", ".json", ".jsonl", ".db", ".vscdb"];

const ACCEPTED = [
  ...ACCEPTED_EXTENSIONS,
  "application/json",
  "application/zip",
  "application/x-sqlite3",
].join(",");

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

interface SkippedNotice {
  count: number;
  allSkipped: boolean;
}

function isAcceptedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
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
  const [skipped, setSkipped] = useState<SkippedNotice | null>(null);

  const acceptFiles = useCallback(
    (all: File[]) => {
      const accepted = all.filter((f) => isAcceptedFile(f.name));
      const skippedCount = all.length - accepted.length;
      setSkipped(
        skippedCount > 0 ? { count: skippedCount, allSkipped: accepted.length === 0 } : null,
      );
      if (accepted.length) onFiles(accepted);
    },
    [onFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      acceptFiles(Array.from(e.dataTransfer.files));
    },
    [disabled, acceptFiles],
  );

  const skippedMessage = skipped
    ? `Skipped ${skipped.count} unsupported file${skipped.count === 1 ? "" : "s"} — accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`
    : null;

  return (
    <>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`group relative block border-2 border-dashed rounded-3xl p-10 sm:p-16 text-center cursor-pointer neon-glow-hover transition-all duration-300 focus-within:border-wrap-500 focus-within:ring-2 focus-within:ring-wrap-500/50 ${
          dragOver
            ? "border-wrap-500 bg-wrap-500/5"
            : "border-white/10 bg-surface-800/30"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          type="file"
          accept={ACCEPTED}
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            acceptFiles(Array.from(e.target.files ?? []));
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
      <div aria-live="polite" role="status">
        {skippedMessage && (
          <p
            className={`text-center text-sm rounded-lg p-3 mt-4 ${
              skipped?.allSkipped
                ? "text-red-400 bg-red-950/30"
                : "text-amber-200/80 bg-amber-950/20"
            }`}
          >
            {skippedMessage}
          </p>
        )}
      </div>
    </>
  );
}
