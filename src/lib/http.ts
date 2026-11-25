/** Health-related responses must not be retained by intermediary caches. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export class RequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** JSON + custom header forces browser preflight. This is not authentication. */
export function guardRequest(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  // Host is browser-controlled, not a forwarded header supplied by an arbitrary proxy.
  const host = request.headers.get("host") || target.host;
  let validOrigin = true;
  if (origin) {
    try {
      const parsed = new URL(origin);
      // 개발 환경(Codespaces 등)에서는 TLS를 끝내는 프록시가 https를 http로 바꿔 전달하므로 프로토콜 차이를 허용한다.
      // 프로덕션은 요청 주소와 Origin의 프로토콜이 같아야 하고, 호스트는 항상 같아야 한다.
      const sameProtocol = parsed.protocol === target.protocol
        || (process.env.NODE_ENV === "development" && parsed.protocol === "https:" && target.protocol === "http:");
      validOrigin = parsed.origin === origin && parsed.host === host && sameProtocol;
    } catch {
      validOrigin = false;
    }
  }
  if (site === "cross-site" || site === "same-site" || !validOrigin || request.headers.get("x-ongi-client") !== "web") {
    return json({ code: "forbidden", message: "앱에서 다시 요청해 주세요." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ code: "unsupported_media_type", message: "JSON 요청만 지원해요." }, { status: 415 });
  }
  if (request.headers.has("content-encoding") && request.headers.get("content-encoding") !== "identity") {
    return json({ code: "unsupported_encoding", message: "압축된 요청은 지원하지 않아요." }, { status: 415 });
  }
  return null;
}

let activeReaders = 0;

/** Bound memory before JSON parsing, including chunked/multibyte/slow uploads. */
export async function readJson(request: Request, maxBytes: number, timeoutMs = 10_000): Promise<unknown> {
  const tooLarge = () => new RequestError(413, "too_large", "요청이 너무 커요. 내용을 줄여 다시 시도해 주세요.");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw tooLarge();
  if (!request.body) throw new RequestError(400, "bad_request", "요청 본문이 없어요.");
  if (activeReaders >= 8) throw new RequestError(429, "rate_limited", "요청이 많아요. 잠시 뒤 시도해 주세요.");
  const reader = request.body.getReader();
  activeReaders++;
  let rejectRead: (error: Error) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { rejectRead = reject; });
  const stop = (error: Error) => {
    rejectRead(error);
    void reader.cancel().catch(() => {});
  };
  const onAbort = () => stop(new RequestError(408, "request_timeout", "요청이 취소됐어요."));
  const timer = setTimeout(() => stop(new RequestError(408, "request_timeout", "요청 시간이 초과됐어요.")), timeoutMs);
  request.signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (request.signal.aborted) onAbort();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let size = 0;
    let raw = "";
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw tooLarge();
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, "bad_request", "요청 형식이 올바르지 않아요.");
  } finally {
    activeReaders--;
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

export function requestFailure(error: unknown): Response {
  return error instanceof RequestError
    ? json({ code: error.code, message: error.message }, { status: error.status })
    : json({ code: "bad_request", message: "요청 형식이 올바르지 않아요." }, { status: 400 });
}
