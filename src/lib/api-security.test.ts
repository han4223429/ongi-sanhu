import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic", async (original) => ({
  ...await original<typeof import("./anthropic")>(),
  hasApiKey: () => false,
}));

const profile = {
  birthDate: "2026-10-01", delivery: "vaginal", cleared: true,
  symptoms: [], redFlags: [], minutes: 20,
};
const payloads = {
  chat: { profile, today: "2026-11-23", messages: [{ role: "user", content: "걷기 방법" }] },
  plan: { profile, today: "2026-11-23", condition: { pain: 0, fatigue: "low", note: "" } },
};

function request(path: keyof typeof payloads, headers: Record<string, string> = {}, body?: string) {
  return new Request(`http://localhost:3000/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ongi-client": "web", origin: "http://localhost:3000", ...headers },
    body: body ?? JSON.stringify(payloads[path]),
  });
}

beforeEach(() => vi.resetModules());

describe.each(["chat", "plan"] as const)("%s API trust boundary", (path) => {
  async function handler() {
    return path === "chat" ? (await import("@/app/api/chat/route")).POST : (await import("@/app/api/plan/route")).POST;
  }
  it("preserves valid requests when the AI key is absent", async () => {
    const response = await (await handler())(request(path));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("no_api_key");
  });
  it("blocks cross-site simple POST before reading its body", async () => {
    const response = await (await handler())(request(path, { "content-type": "text/plain", origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
  });
  it("requires the custom browser header", async () => {
    expect((await (await handler())(request(path, { "x-ongi-client": "" }))).status).toBe(403);
  });
  it("does not let forged forwarding headers reset the budget", async () => {
    const post = await handler();
    const limit = path === "chat" ? 30 : 10;
    for (let i = 0; i < limit; i++) {
      expect((await post(request(path, { "x-forwarded-for": `192.0.2.${i}` }))).status).toBe(503);
    }
    expect((await post(request(path, { "x-forwarded-for": "198.51.100.1" }))).status).toBe(429);
  });
  it("limits actual UTF-8 bytes, not UTF-16 length", async () => {
    const size = path === "chat" ? 100_000 : 20_000;
    const body = JSON.stringify({ ...payloads[path], unused: "가".repeat(Math.ceil(size / 3)) });
    expect(body.length).toBeLessThan(size);
    expect((await (await handler())(request(path, {}, body))).status).toBe(413);
  });
  it("marks health-related errors as uncacheable", async () => {
    expect((await (await handler())(request(path))).headers.get("cache-control")).toContain("no-store");
  });
});
