import { parseMultipleUploadFiles } from "./index";
import {
  serializeParseWorkerError,
  type ParseWorkerRequest,
  type ParseWorkerResponse,
} from "./workerClient";

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<ParseWorkerRequest>) => void) | null;
  postMessage: (message: ParseWorkerResponse) => void;
};

ctx.onmessage = (event) => {
  void (async () => {
    try {
      const result = await parseMultipleUploadFiles(event.data.files, (progress) => {
        ctx.postMessage({ type: "progress", progress });
      });
      ctx.postMessage({ type: "result", result });
    } catch (err) {
      ctx.postMessage({ type: "error", error: serializeParseWorkerError(err) });
    }
  })();
};
