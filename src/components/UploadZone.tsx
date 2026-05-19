import { useCallback, useState } from "react";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadZone({ onFiles, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith(".zip") || f.name.endsWith(".json"),
      );
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
        accept=".zip,.json"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <p className="text-xl font-semibold text-white mb-2">
        Drop your AI export ZIPs here
      </p>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        ChatGPT, Claude, Grok, or Gemini Takeout (.zip or .json). Files are parsed
        locally in your browser — nothing is uploaded to a server.
      </p>
    </label>
  );
}
