import { afterEach, describe, expect, it, vi } from "vitest";
import { guardRequest, readJson, RequestError } from "./http";

afterEach(() => vi.useRealTimers());
function streaming(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request("http://localhost:3000/api/chat", { method: "POST", body, signal, duplex: "half" } as RequestInit);
}
describe("bounded body reader", () => {
  it("cancels oversized chunked uploads immediately", async () => {
    const cancel = vi.fn();
    const request = streaming(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(11)); }, cancel }));
    await expect(readJson(request, 10)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects an excessive declared size without pulling the body", async () => {
    const request = new Request("http://localhost", { method: "POST", headers: { "content-length": "1000" }, body: "{}" });
    await expect(readJson(request, 10)).rejects.toMatchObject({ status: 413 });
  });
  it("times out a body that never finishes", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const reading = readJson(streaming(new ReadableStream({ cancel })), 100, 50);
    const result = expect(reading).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(51);
    await result;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("handles disconnects without an uncaught error", async () => {
    const controller = new AbortController();
    const reading = readJson(streaming(new ReadableStream(), controller.signal), 100);
    controller.abort();
    await expect(reading).rejects.toMatchObject({ status: 408 });
  });
  it("accepts multibyte text split across chunks", async () => {
    const bytes = new TextEncoder().encode('{"text":"한글"}');
    const request = streaming(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } }));
    expect(await readJson(request, bytes.length)).toEqual({ text: "한글" });
  });
  it("rejects malformed UTF-8", async () => {
    await expect(readJson(streaming(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([255])); c.close(); } })), 100)).rejects.toMatchObject({ status: 400 });
  });
  it("bounds simultaneous slow uploads and releases slots after cancellation", async () => {
    const controllers = Array.from({ length: 8 }, () => new AbortController());
    const pending = controllers.map((c) => readJson(streaming(new ReadableStream(), c.signal), 100).catch((error) => error));
    await expect(readJson(streaming(new ReadableStream()), 100)).rejects.toMatchObject({ status: 429 });
    controllers.forEach((c) => c.abort());
    expect((await Promise.all(pending)).every((error) => error instanceof RequestError && error.status === 408)).toBe(true);
    expect(await readJson(new Request("http://localhost", { method: "POST", body: "{}" }), 100)).toEqual({});
  });
});

describe("alternate browser request encodings", () => {
  it.each(["null", "https://evil.example", "http://localhost:3000.evil.example", "http://localhost:3000/"])("rejects Origin %s", (origin) => {
    expect(guardRequest(new Request("http://localhost:3000", { headers: { origin, "x-ongi-client": "web", "content-type": "application/json" } }))?.status).toBe(403);
  });
  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])("rejects %s", (type) => {
    expect(guardRequest(new Request("http://localhost:3000", { headers: { "x-ongi-client": "web", "content-type": type } }))?.status).toBe(415);
  });
});

describe("guardRequest: 프록시 뒤 https Origin", () => {
  const proxied = (origin: string) =>
    new Request("http://demo-3000.app.github.dev/api/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ongi-client": "web",
        host: "demo-3000.app.github.dev",
        origin,
      },
      body: "{}",
    });

  it("개발 모드에서는 https Origin을 허용하지만 호스트가 다르면 막는다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { guardRequest } = await import("./http");
    expect(guardRequest(proxied("https://demo-3000.app.github.dev"))).toBeNull();
    expect(guardRequest(proxied("https://evil.example"))?.status).toBe(403);
    vi.unstubAllEnvs();
  });

  it("프로덕션에서는 프로토콜이 다르면 막는다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { guardRequest } = await import("./http");
    expect(guardRequest(proxied("https://demo-3000.app.github.dev"))?.status).toBe(403);
    vi.unstubAllEnvs();
  });
});
