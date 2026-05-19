import { unzip } from "fflate";

export interface ZipEntry {
  path: string;
  data: Uint8Array;
}

export async function extractZip(file: File): Promise<ZipEntry[]> {
  const buffer = await file.arrayBuffer();
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(new Uint8Array(buffer), (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

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
  return JSON.parse(text) as T;
}
