import { Link } from "react-router-dom";
import { brand } from "@/config/brand";

interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className = "" }: WordmarkProps) {
  return (
    <Link
      to="/"
      className={`font-bold text-lg tracking-tight ${className}`}
    >
      <span className="text-white">{brand.wordmark.primary}</span>{" "}
      <span className="text-brand-400">{brand.wordmark.accent}</span>
    </Link>
  );
}
