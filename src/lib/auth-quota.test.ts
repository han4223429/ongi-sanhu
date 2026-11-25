import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthConfig } from "./auth-config";
import { gateAI } from "./ai-access";
import { exchangeCodeForUser, safeNext } from "./github-oauth";
import {
  readCookie,
  sessionCookieName,
  signSession,
  verifySession,
} from "./session";
import {
  DAILY_LIMITS,
  MemoryUsageStore,
  UpstashUsageStore,
  consume,
  kstDay,
  nextResetAt,
  readUsage,
  refund,
  setUsageStoreForTests,
} from "./usage";

const SECRET_TEXT = "s".repeat(40);
const SECRET = new TextEncoder().encode(SECRET_TEXT);

function enableAuth() {
  vi.stubEnv("GITHUB_CLIENT_ID", "client-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "client-secret");
  vi.stubEnv("AUTH_SECRET", SECRET_TEXT);
  vi.stubEnv("AUTH_URL", "https://ongi.example");
}

async function requestWithSession(userId = 42, login = "mom-user") {
  const config = getAuthConfig();
  if (!config.enabled) throw new Error("auth not enabled in test");
  const token = await signSession({ id: userId, login }, config.secret);
  return new Request("https://ongi.example/api/chat", {
    method: "POST",
    headers: { cookie: `${sessionCookieName()}=${token}` },
  });
}

beforeEach(() => {
  setUsageStoreForTests(new MemoryUsageStore());
});
afterEach(() => {
  vi.unstubAllEnvs();
  setUsageStoreForTests(undefined);
});

describe("auth config", () => {
  it("로그인 설정이 모두 있어야 켜진다", () => {
    expect(getAuthConfig().enabled).toBe(false);
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    expect(getAuthConfig().enabled).toBe(false);
    vi.stubEnv("AUTH_SECRET", "too-short");
    expect(getAuthConfig().enabled).toBe(false);
    vi.stubEnv("AUTH_SECRET", SECRET_TEXT);
    expect(getAuthConfig().enabled).toBe(true);
  });

  it("프로덕션에서는 https 주소만 허용하고 주소가 없으면 닫는다", () => {
    enableAuth();
    vi.stubEnv("NODE_ENV", "production");
    expect(getAuthConfig().enabled).toBe(true);
    vi.stubEnv("AUTH_URL", "http://ongi.example");
    expect(getAuthConfig().enabled).toBe(false);
    vi.stubEnv("AUTH_URL", "");
    expect(getAuthConfig().enabled).toBe(false);
    vi.stubEnv("AUTH_URL", "https://ongi.example/path");
    expect(getAuthConfig().enabled).toBe(false);
  });
});

describe("session", () => {
  it("서명한 세션을 다시 읽는다", async () => {
    const token = await signSession({ id: 7, login: "abc-def" }, SECRET);
    expect(await verifySession(token, SECRET)).toEqual({ id: 7, login: "abc-def" });
  });

  it("다른 키로 만든 것, 변조, 만료는 거부한다", async () => {
    const token = await signSession({ id: 7, login: "abc" }, SECRET, 0);
    expect(await verifySession(token, new TextEncoder().encode("x".repeat(40)), 0)).toBeNull();
    const parts = token.split(".");
    const forged = `${parts[0]}.${Buffer.from(JSON.stringify({ sub: "1", login: "admin" })).toString("base64url")}.${parts[2]}`;
    expect(await verifySession(forged, SECRET, 0)).toBeNull();
    expect(await verifySession(token, SECRET, 0)).not.toBeNull();
    expect(await verifySession(token, SECRET, 8 * 24 * 3600 * 1000)).toBeNull();
    expect(await verifySession("not-a-token", SECRET)).toBeNull();
  });

  it("alg none 토큰과 잘못된 로그인 이름을 거부한다", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ sub: "1", login: "x", iss: "ongi-sanhu", aud: "ongi-web", exp: 9999999999 }),
    ).toString("base64url");
    expect(await verifySession(`${header}.${body}.`, SECRET)).toBeNull();
    const bad = await signSession({ id: 3, login: "bad name<script>" }, SECRET);
    expect(await verifySession(bad, SECRET)).toBeNull();
  });

  it("쿠키 헤더에서 값을 읽는다", () => {
    const request = new Request("https://x.test", {
      headers: { cookie: "a=1; ongi_session=tok=en; b=2" },
    });
    expect(readCookie(request, "ongi_session")).toBe("tok=en");
    expect(readCookie(request, "missing")).toBeUndefined();
  });
});

describe("safeNext (열린 리디렉션 방지)", () => {
  it.each([
    ["/coach", "/coach"],
    ["/exercise/glute-bridge", "/exercise/glute-bridge"],
    ["//evil.example", "/today"],
    ["https://evil.example", "/today"],
    ["/\\evil.example", "/today"],
    ["javascript:alert(1)", "/today"],
    ["/a?b=1", "/today"],
    ["", "/today"],
    [null, "/today"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe("GitHub 사용자 확인", () => {
  const cfg = { clientId: "id", clientSecret: "secret", redirectUri: "https://ongi.example/api/auth/callback" };

  it("코드를 사용자로 바꾼다", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return String(url).includes("access_token")
        ? Response.json({ access_token: "gho_test" })
        : Response.json({ id: 99, login: "mom-user", email: "private@example.com" });
    }) as unknown as typeof fetch;
    const user = await exchangeCodeForUser("code", cfg, fetchMock);
    expect(user).toEqual({ id: 99, login: "mom-user" });
    expect(calls).toHaveLength(2);
  });

  it("토큰 오류와 잘못된 사용자 응답은 실패한다", async () => {
    const tokenError = vi.fn(async () => Response.json({ error: "bad_verification_code" })) as unknown as typeof fetch;
    await expect(exchangeCodeForUser("c", cfg, tokenError)).rejects.toThrow();

    const badUser = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("access_token")
        ? Response.json({ access_token: "t" })
        : Response.json({ id: "1; DROP", login: "x" }),
    ) as unknown as typeof fetch;
    await expect(exchangeCodeForUser("c", cfg, badUser)).rejects.toThrow();

    const httpError = vi.fn(async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(exchangeCodeForUser("c", cfg, httpError)).rejects.toThrow();
  });
});

describe("하루 사용량", () => {
  it("한국 시간 자정에 날짜가 바뀐다", () => {
    expect(kstDay(Date.parse("2026-11-23T14:59:59Z"))).toBe("2026-11-23");
    expect(kstDay(Date.parse("2026-11-23T15:00:00Z"))).toBe("2026-11-24");
    expect(nextResetAt(Date.parse("2026-11-23T10:00:00Z")).toISOString()).toBe("2026-11-23T15:00:00.000Z");
  });

  it("코치 20회, 루틴 조정 5회까지만 쓸 수 있다", async () => {
    const store = new MemoryUsageStore();
    for (let i = 0; i < DAILY_LIMITS.chat; i++) expect((await consume(store, 1, "chat")).ok).toBe(true);
    const over = await consume(store, 1, "chat");
    expect(over).toMatchObject({ ok: false, reason: "user" });
    for (let i = 0; i < DAILY_LIMITS.plan; i++) expect((await consume(store, 1, "plan")).ok).toBe(true);
    expect(await consume(store, 1, "plan")).toMatchObject({ ok: false, reason: "user" });
    // 다른 사용자는 영향이 없다.
    expect((await consume(store, 2, "chat")).ok).toBe(true);
  });

  it("한도를 넘어 거절된 요청은 횟수를 더 쓰지 않는다", async () => {
    const store = new MemoryUsageStore();
    for (let i = 0; i < 25; i++) await consume(store, 1, "chat");
    expect((await readUsage(store, 1)).chat.used).toBe(DAILY_LIMITS.chat);
  });

  it("날짜가 바뀌면 다시 쓸 수 있다", async () => {
    const store = new MemoryUsageStore();
    const day1 = Date.parse("2026-11-23T10:00:00Z");
    for (let i = 0; i < DAILY_LIMITS.plan; i++) await consume(store, 1, "plan", day1);
    expect((await consume(store, 1, "plan", day1)).ok).toBe(false);
    const day2 = Date.parse("2026-11-23T15:00:01Z");
    expect((await consume(store, 1, "plan", day2)).ok).toBe(true);
  });

  it("전체 하루 한도를 넘으면 모두 막는다", async () => {
    vi.stubEnv("AI_DAILY_GLOBAL_LIMIT", "3");
    const store = new MemoryUsageStore();
    for (let user = 1; user <= 3; user++) expect((await consume(store, user, "chat")).ok).toBe(true);
    expect(await consume(store, 4, "chat")).toMatchObject({ ok: false, reason: "global" });
  });

  it("환불하면 횟수가 돌아온다", async () => {
    const store = new MemoryUsageStore();
    const result = await consume(store, 1, "plan");
    expect(result.ok).toBe(true);
    if (result.ok) await refund(result.ticket);
    expect((await readUsage(store, 1)).plan.used).toBe(0);
  });

  it("저장소가 실패하면 열어 주지 않는다", async () => {
    const broken = new UpstashUsageStore("https://redis.example", "tok", (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch);
    expect(await consume(broken, 1, "chat")).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("Upstash에는 토큰을 헤더로, 명령을 파이프라인으로 보낸다", async () => {
    const seen: { url: string; auth: string | null; body: unknown }[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({
        url: String(url),
        auth: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body)),
      });
      return Response.json([{ result: 1 }, { result: 1 }]);
    }) as unknown as typeof fetch;
    const store = new UpstashUsageStore("https://redis.example", "secret-token", fetchMock);
    expect(await store.add("k", 1, 100)).toBe(1);
    expect(seen[0].url).toBe("https://redis.example/pipeline");
    expect(seen[0].auth).toBe("Bearer secret-token");
    expect(seen[0].body).toEqual([["INCR", "k"], ["EXPIRE", "k", 100]]);
  });
});

describe("AI 접근 게이트", () => {
  it("로그인 설정이 없는 프로덕션에서는 AI를 닫는다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const gate = await gateAI(new Request("https://ongi.example/api/chat"), "chat");
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(503);
      expect((await gate.response.json()).code).toBe("ai_disabled");
    }
  });

  it("개발·테스트에서는 로그인 없이 열려 있다", async () => {
    const gate = await gateAI(new Request("http://localhost:3000/api/chat"), "chat");
    expect(gate.ok).toBe(true);
  });

  it("로그인이 켜져 있으면 쿠키가 없거나 잘못된 요청은 401", async () => {
    enableAuth();
    for (const headers of [{} as Record<string, string>, { cookie: `${sessionCookieName()}=garbage` }]) {
      const gate = await gateAI(new Request("https://ongi.example/api/chat", { headers }), "chat");
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
        expect(gate.response.status).toBe(401);
        expect((await gate.response.json()).code).toBe("login_required");
      }
    }
  });

  it("로그인한 사용자는 한도까지 쓰고 그다음은 429", async () => {
    enableAuth();
    for (let i = 0; i < DAILY_LIMITS.plan; i++) {
      expect((await gateAI(await requestWithSession(), "plan")).ok).toBe(true);
    }
    const over = await gateAI(await requestWithSession(), "plan");
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.response.status).toBe(429);
      const body = await over.response.json();
      expect(body.code).toBe("quota_exceeded");
      expect(body.resetsAt).toMatch(/Z$/);
    }
    // 다른 종류(코치)는 따로 센다.
    expect((await gateAI(await requestWithSession(), "chat")).ok).toBe(true);
  });

  it("프로덕션에서 사용량 저장소가 없으면 닫는다", async () => {
    enableAuth();
    vi.stubEnv("NODE_ENV", "production");
    setUsageStoreForTests(null);
    const gate = await gateAI(await requestWithSession(), "chat");
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.response.status).toBe(503);
  });
});
