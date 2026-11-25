import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gateAI } from "./ai-access";
import { getSessionSecret } from "./auth-config";
import { sessionCookieName, verifySession } from "./session";
import { setUsageStoreForTests } from "./usage";

const BASE = "https://ongi.example";
const SECRET_TEXT = "d".repeat(40);
const CODE = "ongi-test1";

function enableDemo(code: string | null = CODE) {
  vi.stubEnv("AUTH_SECRET", SECRET_TEXT);
  if (code !== null) vi.stubEnv("DEMO_PASSCODE", code);
}

function post(body: unknown, extra: Record<string, string> = {}) {
  return new Request(`${BASE}/api/auth/demo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ongi-client": "web",
      origin: BASE,
      ...extra,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** 시도 제한이 모듈 상태라서 테스트마다 새로 불러온다. */
async function route() {
  vi.resetModules();
  return (await import("@/app/api/auth/demo/route")).POST;
}

function tokenOf(response: Response): string {
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith(`${sessionCookieName()}=`))!;
  return cookie.split(";")[0].split("=").slice(1).join("=");
}

beforeEach(() => setUsageStoreForTests(undefined));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/demo (시연 코드 입장)", () => {
  it("맞는 코드면 임의 번호가 담긴 로그인 쿠키를 준다", async () => {
    enableDemo();
    const POST = await route();
    const response = await POST(post({ code: CODE }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith(`${sessionCookieName()}=`))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const user = await verifySession(tokenOf(response), getSessionSecret()!);
    expect(user?.login).toBe("demo");
    expect(user!.id).toBeGreaterThanOrEqual(1_000_000_000);
  });

  it("입장할 때마다 다른 번호를 만든다 (사용 한도를 사람별로 센다)", async () => {
    enableDemo();
    const POST = await route();
    const a = await verifySession(tokenOf(await POST(post({ code: CODE }))), getSessionSecret()!);
    const b = await verifySession(tokenOf(await POST(post({ code: CODE }))), getSessionSecret()!);
    expect(a!.id).not.toBe(b!.id);
  });

  it("앞뒤 공백은 무시하고, 틀린 코드는 401", async () => {
    enableDemo();
    const POST = await route();
    expect((await POST(post({ code: `  ${CODE} ` }))).status).toBe(200);
    const wrong = await POST(post({ code: "ongi-test2" }));
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).code).toBe("wrong_code");
    expect(wrong.headers.getSetCookie()).toHaveLength(0);
  });

  it("틀린 시도가 10번 쌓이면 맞는 코드도 잠시 막는다", async () => {
    enableDemo();
    const POST = await route();
    for (let i = 0; i < 10; i++) expect((await POST(post({ code: `bad-code-${i}` }))).status).toBe(401);
    const locked = await POST(post({ code: CODE }));
    expect(locked.status).toBe(429);
    expect((await locked.json()).code).toBe("rate_limited");
  });

  it("잘못된 요청 형식은 거부한다", async () => {
    enableDemo();
    const POST = await route();
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ code: "x".repeat(65) }))).status).toBe(400);
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ code: CODE }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(post({ code: CODE }, { "x-ongi-client": "" }))).status).toBe(403);
  });

  it("코드가 없거나 8자 미만이면 입장이 열리지 않는다", async () => {
    enableDemo(null);
    expect((await (await route())(post({ code: CODE }))).status).toBe(404);
    vi.unstubAllEnvs();
    enableDemo("short");
    expect((await (await route())(post({ code: "short" }))).status).toBe(404);
    vi.unstubAllEnvs();
    vi.stubEnv("DEMO_PASSCODE", CODE); // 쿠키 서명 키가 없으면 열리지 않는다
    expect((await (await route())(post({ code: CODE }))).status).toBe(404);
  });
});

describe("시연 코드 모드의 AI 접근 (프로덕션, Redis 없음)", () => {
  async function sessionRequest() {
    const POST = await route();
    const token = tokenOf(await POST(post({ code: CODE })));
    return new Request(`${BASE}/api/chat`, {
      method: "POST",
      headers: { cookie: `${sessionCookieName()}=${token}` },
    });
  }

  it("코드로 입장한 사람은 쓸 수 있고, 입장 안 한 사람은 401", async () => {
    enableDemo();
    vi.stubEnv("NODE_ENV", "production");
    const { gateAI: gate } = await import("./ai-access");
    expect((await gate(await sessionRequest(), "chat")).ok).toBe(true);
    const anon = await gate(new Request(`${BASE}/api/chat`), "chat");
    expect(anon.ok).toBe(false);
    if (!anon.ok) expect(anon.response.status).toBe(401);
  });

  it("사람별 한도(루틴 조정 5회)가 그대로 적용된다", async () => {
    enableDemo();
    vi.stubEnv("NODE_ENV", "production");
    const { gateAI: gate } = await import("./ai-access");
    const request = await sessionRequest();
    for (let i = 0; i < 5; i++) expect((await gate(request, "plan")).ok).toBe(true);
    const over = await gate(request, "plan");
    expect(over.ok).toBe(false);
    if (!over.ok) expect((await over.response.json()).code).toBe("quota_exceeded");
  });

  it("시연 코드도 로그인도 없으면 프로덕션에서는 AI가 닫혀 있다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const gate = await gateAI(new Request(`${BASE}/api/chat`), "chat");
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.response.status).toBe(503);
  });

  it("상태 API가 입장 방법을 알려 준다", async () => {
    enableDemo();
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/me/route");
    const body = await (
      await GET(new Request(`${BASE}/api/auth/me`, { headers: { "x-ongi-client": "web" } }))
    ).json();
    expect(body).toEqual({ mode: "login", methods: { github: false, demo: true }, user: null, usage: null });
  });
});
