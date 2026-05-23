/** Client-side upload and parse limits to reduce zip-bomb / memory-exhaustion DoS. */

/** Max compressed upload size (200 MB — large ChatGPT/Claude exports). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Max combined size of all files in one multi-file upload (500 MB). */
export const MAX_TOTAL_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Max number of files in one multi-file upload. */
export const MAX_UPLOAD_FILE_COUNT = 20;

/** Max total uncompressed bytes across all ZIP entries (500 MB). */
export const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;

/** Max number of files inside a ZIP archive. */
export const MAX_ZIP_ENTRIES = 10_000;

/** Max single extracted file size (100 MB). */
export const MAX_ZIP_ENTRY_BYTES = 100 * 1024 * 1024;

/** Max JSON / JSONL text read from a single file (100 MB). */
export const MAX_TEXT_FILE_BYTES = 100 * 1024 * 1024;

/** Max imported report JSON size (50 MB). */
export const MAX_REPORT_IMPORT_BYTES = 50 * 1024 * 1024;

/** Abort parsing if it exceeds this duration (60 s). */
export const PARSE_TIMEOUT_MS = 60_000;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function assertUploadSize(file: File, maxBytes = MAX_UPLOAD_BYTES): void {
  if (file.size > maxBytes) {
    throw new Error(
      `File "${file.name}" is too large (${formatBytes(file.size)}). Maximum allowed size is ${formatBytes(maxBytes)}.`,
    );
  }
}

export function assertBatchUploadSize(files: File[]): void {
  if (files.length === 0) {
    throw new Error("No files selected.");
  }
  if (files.length > MAX_UPLOAD_FILE_COUNT) {
    throw new Error(
      `Too many files (${files.length}). Maximum is ${MAX_UPLOAD_FILE_COUNT} files per upload.`,
    );
  }

  let totalBytes = 0;
  for (const file of files) {
    assertUploadSize(file);
    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    throw new Error(
      `Combined upload size (${formatBytes(totalBytes)}) exceeds the maximum (${formatBytes(MAX_TOTAL_UPLOAD_BYTES)}). Remove some files or use smaller exports.`,
    );
  }
}

export async function readTextWithLimit(
  file: File,
  maxBytes = MAX_TEXT_FILE_BYTES,
): Promise<string> {
  assertUploadSize(file, maxBytes);
  return file.text();
}

export async function readArrayBufferWithLimit(
  file: File,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<ArrayBuffer> {
  assertUploadSize(file, maxBytes);
  return file.arrayBuffer();
}

export function withTimeout<T>(promise: Promise<T>, ms = PARSE_TIMEOUT_MS, label = "Parse"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds. Try a smaller export or fewer files.`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
