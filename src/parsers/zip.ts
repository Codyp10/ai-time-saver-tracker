import { unzip } from "fflate";
import { ParseError } from "./errors";

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

export async function extractZip(file: File): Promise<ZipEntry[]> {
  const buffer = await file.arrayBuffer();
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

  const result = Object.entries(entries)
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, data]) => ({ path, data }));

  if (result.length === 0) {
    throw new ParseError("ZIP file is empty.", "INVALID_ZIP");
  }

  return result;
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
