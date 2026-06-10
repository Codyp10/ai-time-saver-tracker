import {
  parseMultipleUploadFiles,
  type MultiParseResult,
  type ParseProgress,
} from "./index";
import { ParseError } from "./errors";
import { computeParseTimeoutMs } from "@/config/securityLimits";

export interface ParseWorkerRequest {
  files: File[];
}

export interface SerializedParseError {
  code: string;
  message: string;
}

export type ParseWorkerResponse =
  | { type: "progress"; progress: ParseProgress }
  | { type: "result"; result: MultiParseResult }
  | { type: "error"; error: SerializedParseError };

export function serializeParseWorkerError(err: unknown): SerializedParseError {
  if (err instanceof ParseError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { code: "PARSE_FAILED", message: err.message };
  return { code: "PARSE_FAILED", message: "Something went wrong while parsing your file." };
}

export function computeBatchParseTimeoutMs(fileSizes: number[]): number {
  return fileSizes.reduce((total, size) => total + computeParseTimeoutMs(size), 0);
}

class WorkerUnavailableError extends Error {}

export async function parseMultipleUploadFilesInWorker(
  files: File[],
  onProgress?: (progress: ParseProgress) => void,
): Promise<MultiParseResult> {
  if (typeof Worker === "undefined" || files.length === 0) {
    return parseMultipleUploadFiles(files, onProgress);
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return parseMultipleUploadFiles(files, onProgress);
  }

  const timeoutMs = computeBatchParseTimeoutMs(files.map((f) => f.size));

  try {
    return await new Promise<MultiParseResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(
          new ParseError(
            `Parsing ${files.length} file${files.length === 1 ? "" : "s"} timed out after ${Math.round(timeoutMs / 1000)} seconds. Try a smaller export, fewer files, or close other browser tabs.`,
            "PARSE_TIMEOUT",
          ),
        );
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent<ParseWorkerResponse>) => {
        const message = event.data;
        if (message.type === "progress") {
          onProgress?.(message.progress);
          return;
        }
        clearTimeout(timer);
        if (message.type === "result") {
          resolve(message.result);
        } else {
          reject(new ParseError(message.error.message, message.error.code));
        }
      };

      worker.onerror = () => {
        clearTimeout(timer);
        reject(new WorkerUnavailableError());
      };
      worker.onmessageerror = () => {
        clearTimeout(timer);
        reject(new WorkerUnavailableError());
      };

      const request: ParseWorkerRequest = { files };
      try {
        worker.postMessage(request);
      } catch {
        clearTimeout(timer);
        reject(new WorkerUnavailableError());
      }
    });
  } catch (err) {
    if (err instanceof WorkerUnavailableError) {
      return parseMultipleUploadFiles(files, onProgress);
    }
    throw err;
  } finally {
    worker.terminate();
  }
}
