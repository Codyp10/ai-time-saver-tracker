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
      className={`block rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
        dragOver
          ? "border-brand-400 bg-brand-600/20"
          : "border-white/20 hover:border-brand-500/50 hover:bg-white/5"
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
      <p className="text-xl font-semibold text-white mb-2">
        Drop your AI export files here
      </p>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        ChatGPT, Claude, Grok, or Gemini ZIPs — plus Claude Code (.jsonl) and Cursor
        (.db / .vscdb). Parsed locally in your browser; nothing is uploaded to a server.
      </p>
    </label>
  );
}
