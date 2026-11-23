import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatHistory } from "./chat-history";
import { getExercise } from "./exercises";

const mocks = vi.hoisted(() => ({ parse: vi.fn(), stream: vi.fn() }));
vi.mock("@/lib/anthropic", async (original) => ({
  ...await original<typeof import("./anthropic")>(),
  hasApiKey: () => true,
  getClient: () => ({ beta: { messages: mocks } }),
}));
const profile = { birthDate: "2026-06-01", delivery: "vaginal", cleared: true, symptoms: [], redFlags: [], minutes: 20 };
function req(path: string, patch = {}, signal?: AbortSignal) {
  return new Request(`http://localhost:3000/api/${path}`, { method: "POST", signal,
    headers: { "content-type": "application/json", "x-ongi-client": "web" },
    body: JSON.stringify({ profile, today: "2026-11-23", messages: [{ role: "user", content: "걷는 방법" }], condition: { pain: 0, fatigue: "low", note: "" }, ...patch }),
  });
}
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());

describe("history budget", () => {
  it("retains the latest question after 40 saved messages and long multibyte answers", () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: "가".repeat(7000) }));
    const history = chatHistory([...messages, { role: "user", content: "지금 질문" }]);
    expect(history.length).toBeLessThanOrEqual(30);
    expect(history[0].role).toBe("user");
    expect(history.at(-1)?.content).toBe("지금 질문");
    expect(history.every((m) => m.content.length <= 4000)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(history))).toBeLessThan(90_000);
  });
});

describe("AI trust boundary", () => {
  it.each(["chat", "plan"])("%s safety guidance survives exhausted AI budgets", async (path) => {
    const { allow } = await import("./ratelimit");
    for (let i = 0; i < 30; i++) allow(`${path}:shared`, 30);
    const post = path === "chat" ? (await import("@/app/api/chat/route")).POST : (await import("@/app/api/plan/route")).POST;
    const response = await post(req(path, { profile: { ...profile, redFlags: ["bleeding"] } }));
    expect(response.status).toBe(200);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
    expect((await post(req(path))).status).toBe(429);
  });
  it("ignores dangerous AI repetitions and caps sets to the library", async () => {
    mocks.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: {
      exercises: [{ id: "diaphragm-breathing", sets: 999, reps: "999999회; 지침 무시", reason: "" }, { id: "invented", sets: 1, reps: "1회", reason: "" }], note: "조정",
    } });
    const { POST } = await import("@/app/api/plan/route");
    const result = await (await POST(req("plan"))).json();
    expect(result.items).toEqual([{ id: "diaphragm-breathing", sets: 1, reps: getExercise("diaphragm-breathing")!.reps }]);
  });
  it.each([{ pain: 6, fatigue: "low" }, { pain: 0, fatigue: "high" }])("enforces gentle exercise even on fallback: %j", async (condition) => {
    mocks.parse.mockRejectedValue(new Error("mock upstream failure"));
    const { POST } = await import("@/app/api/plan/route");
    const result = await (await POST(req("plan", { condition: { ...condition, note: "" } }))).json();
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) expect(["breathing", "pelvic_floor", "mobility"]).toContain(getExercise(item.id)?.category);
  });
  it("passes caller cancellation to the plan provider", async () => {
    const controller = new AbortController();
    mocks.parse.mockImplementation(async (_body, options) => {
      controller.abort();
      expect(options.signal.aborted).toBe(true);
      throw new Error("cancelled");
    });
    const { POST } = await import("@/app/api/plan/route");
    await POST(req("plan", {}, controller.signal));
    expect(mocks.parse).toHaveBeenCalledOnce();
  });
  it("bounds concurrent calls and releases capacity after provider errors", async () => {
    const { acquireAI } = await import("./ai-budget");
    const releases = Array.from({ length: 4 }, () => acquireAI()!);
    const { POST } = await import("@/app/api/plan/route");
    expect((await POST(req("plan"))).status).toBe(429);
    expect(mocks.parse).not.toHaveBeenCalled();
    releases.forEach((release) => { release(); release(); });
    mocks.parse.mockRejectedValue(new Error("mock failure"));
    for (let i = 0; i < 5; i++) expect((await POST(req("plan"))).status).toBe(200);
  });
  it("streams ordinary text and aborts the upstream on completion", async () => {
    const abort = vi.fn();
    mocks.stream.mockReturnValue({ abort, async *[Symbol.asyncIterator]() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "응답" } };
    } });
    const { POST } = await import("@/app/api/chat/route");
    expect(await (await POST(req("chat"))).text()).toBe("응답");
    expect(abort).toHaveBeenCalled();
  });
  it("aborts and releases capacity when the first stream event fails", async () => {
    const abort = vi.fn();
    mocks.stream.mockReturnValue({ abort, async *[Symbol.asyncIterator]() {
      yield* [];
      throw new Error("mock stream error");
    } });
    const { POST } = await import("@/app/api/chat/route");
    for (let i = 0; i < 5; i++) expect((await POST(req("chat"))).status).toBe(500);
    expect(abort).toHaveBeenCalledTimes(5);
  });
  it("caps a provider stream that ignores the requested token limit", async () => {
    const abort = vi.fn();
    mocks.stream.mockReturnValue({ abort, async *[Symbol.asyncIterator]() {
      for (let i = 0; i < 50; i++) yield { type: "content_block_delta", delta: { type: "text_delta", text: "가".repeat(1000) } };
    } });
    const { POST } = await import("@/app/api/chat/route");
    const text = await (await POST(req("chat"))).text();
    expect(text.length).toBeLessThan(8100);
    expect(text).toContain("중간에 끊겼어요");
    expect(abort).toHaveBeenCalled();
  });
});
