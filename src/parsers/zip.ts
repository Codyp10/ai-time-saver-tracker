import { unzip } from "fflate";
import {
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_BYTES,
  formatBytes,
} from "@/config/securityLimits";
import { ParseError } from "./errors";

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

function validateZipEntries(entries: Record<string, Uint8Array>): void {
  const paths = Object.keys(entries).filter((p) => !p.endsWith("/"));

  if (paths.length === 0) {
    throw new ParseError("ZIP file is empty.", "INVALID_ZIP");
  }

  if (paths.length > MAX_ZIP_ENTRIES) {
    throw new ParseError(
      `ZIP contains too many files (${paths.length.toLocaleString()}). Maximum is ${MAX_ZIP_ENTRIES.toLocaleString()}.`,
      "ZIP_TOO_LARGE",
    );
  }

  let totalUncompressed = 0;
  for (const path of paths) {
    const size = entries[path]!.byteLength;
    if (size > MAX_ZIP_ENTRY_BYTES) {
      throw new ParseError(
        `File "${path}" in ZIP is too large (${formatBytes(size)}). Maximum per file is ${formatBytes(MAX_ZIP_ENTRY_BYTES)}.`,
        "ZIP_TOO_LARGE",
      );
    }
    totalUncompressed += size;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new ParseError(
        `ZIP uncompressed content exceeds ${formatBytes(MAX_UNCOMPRESSED_BYTES)}. This may be a zip bomb or an unusually large export — try splitting your export.`,
        "ZIP_TOO_LARGE",
      );
    }
  }
}

export async function extractZip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(new Uint8Array(buffer), (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  } catch {
    throw new ParseError(
      "Could not open ZIP file. Make sure it is a valid export archive.",
      "INVALID_ZIP",
    );
  }

  validateZipEntries(entries);

  return Object.entries(entries)
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, data]) => ({ path, data }));
}

export function findEntry(
  entries: ZipEntry[],
  matcher: (path: string) => boolean,
): ZipEntry | undefined {
  return entries.find((e) => matcher(e.path.toLowerCase()));
}

export function decodeText(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ParseError(
      "Could not read JSON in export file. The file may be corrupted or incomplete.",
      "INVALID_JSON",
    );
  }
}
