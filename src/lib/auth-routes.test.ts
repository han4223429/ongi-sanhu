import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/anthropic", async (original) => ({
  ...(await original<typeof import("./anthropic")>()),
  hasApiKey: () => false,
}));

import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as chat } from "@/app/api/chat/route";
import { POST as plan } from "@/app/api/plan/route";
import { getAuthConfig } from "./auth-config";
import { sessionCookieName, signSession, stateCookieName, verifySession } from "./session";
import { MemoryUsageStore, readUsage, setUsageStoreForTests } from "./usage";

const BASE = "https://ongi.example";
const SECRET_TEXT = "k".repeat(40);

const profile = {
  birthDate: "2026-10-01", delivery: "vaginal", cleared: true,
  symptoms: [], redFlags: [], minutes: 20,
};
const chatBody = (content: string) => ({
  profile, today: "2026-11-23", messages: [{ role: "user", content }],
});
const planBody = {
  profile, today: "2026-11-23", condition: { pain: 0, fatigue: "low", note: "" },
};

function enableAuth() {
  vi.stubEnv("GITHUB_CLIENT_ID", "client-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "client-secret");
  vi.stubEnv("AUTH_SECRET", SECRET_TEXT);
  vi.stubEnv("AUTH_URL", BASE);
}

async function sessionCookie(id = 5) {
  const config = getAuthConfig();
  if (!config.enabled) throw new Error("disabled");
  return `${sessionCookieName()}=${await signSession({ id, login: "mom" }, config.secret)}`;
}

function post(path: string, body: unknown, cookie?: string, extra: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ongi-client": "web",
      origin: BASE,
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
  });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

let store: MemoryUsageStore;
beforeEach(() => {
  store = new MemoryUsageStore();
  setUsageStoreForTests(store);
  enableAuth();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setUsageStoreForTests(undefined);
});

describe("GET /api/auth/login", () => {
  it("GitHub으로 보내고, 권한(scope)은 요청하지 않으며, state 쿠키를 둔다", async () => {
    const response = await login(new Request(`${BASE}/api/auth/login?next=/coach`));
    expect(response.status).toBe(302);
    const target = new URL(response.headers.get("location")!);
    expect(target.origin + target.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(target.searchParams.get("client_id")).toBe("client-id");
    expect(target.searchParams.get("redirect_uri")).toBe(`${BASE}/api/auth/callback`);
    expect(target.searchParams.has("scope")).toBe(false);
    const state = target.searchParams.get("state")!;
    expect(state.length).toBeGreaterThanOrEqual(30);
    const cookie = setCookies(response)[0];
    expect(cookie).toContain(`${stateCookieName()}=${state}.`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("외부 주소로 돌아가려는 next는 /today로 바꾼다", async () => {
    const response = await login(new Request(`${BASE}/api/auth/login?next=//evil.example`));
    expect(decodeURIComponent(setCookies(response)[0])).toContain(".%2Ftoday".replace("%2F", "/"));
  });

  it("로그인이 설정되지 않았으면 안내로 돌려보낸다", async () => {
    vi.unstubAllEnvs();
    const response = await login(new Request(`${BASE}/api/auth/login`));
    expect(response.headers.get("location")).toBe("/me?login=unavailable");
  });
});

describe("GET /api/auth/callback", () => {
  const stateCookie = (state: string, next = "/coach") =>
    `${stateCookieName()}=${state}.${encodeURIComponent(next)}`;

  function mockGitHub(user = { id: 77, login: "mom-user" }) {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) =>
      String(url).includes("access_token")
        ? Response.json({ access_token: "gho_x" })
        : Response.json(user),
    ));
  }

  it("정상이면 로그인 쿠키를 만들고 원래 가려던 곳으로 보낸다", async () => {
    mockGitHub();
    const response = await callback(
      new Request(`${BASE}/api/auth/callback?code=abc&state=STATE1`, {
        headers: { cookie: stateCookie("STATE1") },
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/coach");
    const cookies = setCookies(response);
    const session = cookies.find((c) => c.startsWith(`${sessionCookieName()}=`))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    const token = session.split(";")[0].split("=").slice(1).join("=");
    const config = getAuthConfig();
    if (!config.enabled) throw new Error("x");
    expect(await verifySession(token, config.secret)).toEqual({ id: 77, login: "mom-user" });
    // state 쿠키는 한 번 쓰고 지운다.
    expect(cookies.some((c) => c.startsWith(`${stateCookieName()}=;`) && /Max-Age=0/.test(c))).toBe(true);
  });

  it("state가 다르면(위조된 로그인 요청) 거부한다", async () => {
    mockGitHub();
    const response = await callback(
      new Request(`${BASE}/api/auth/callback?code=abc&state=ATTACKER`, {
        headers: { cookie: stateCookie("STATE1") },
      }),
    );
    expect(response.headers.get("location")).toBe("/me?login=failed");
    expect(setCookies(response).some((c) => c.startsWith(`${sessionCookieName()}=`) && !/Max-Age=0/.test(c))).toBe(false);
  });

  it("state 쿠키가 없거나 GitHub이 오류를 돌려주면 거부한다", async () => {
    mockGitHub();
    for (const url of [
      `${BASE}/api/auth/callback?code=abc&state=S`,
      `${BASE}/api/auth/callback?error=access_denied&state=S`,
      `${BASE}/api/auth/callback?state=S`,
    ]) {
      const response = await callback(new Request(url, { headers: { cookie: stateCookie("S") } }));
      const noCookie = url.includes("code=abc");
      const result = noCookie
        ? await callback(new Request(url))
        : response;
      expect(result.headers.get("location")).toBe("/me?login=failed");
    }
  });

  it("쿠키의 돌아갈 곳을 바꿔도 외부로 나가지 않는다", async () => {
    mockGitHub();
    const response = await callback(
      new Request(`${BASE}/api/auth/callback?code=abc&state=S`, {
        headers: { cookie: stateCookie("S", "//evil.example") },
      }),
    );
    expect(response.headers.get("location")).toBe("/today");
  });

  it("GitHub 확인이 실패하면 로그인시키지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const response = await callback(
      new Request(`${BASE}/api/auth/callback?code=abc&state=S`, { headers: { cookie: stateCookie("S") } }),
    );
    expect(response.headers.get("location")).toBe("/me?login=failed");
  });
});

describe("GET /api/auth/me, POST /api/auth/logout", () => {
  const meRequest = (cookie?: string, headers: Record<string, string> = { "x-ongi-client": "web" }) =>
    new Request(`${BASE}/api/auth/me`, { headers: { ...headers, ...(cookie ? { cookie } : {}) } });

  it("브라우저 헤더가 없거나 다른 사이트에서 부르면 거부한다", async () => {
    expect((await me(meRequest(undefined, {}))).status).toBe(403);
    expect((await me(meRequest(undefined, { "x-ongi-client": "web", "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });

  it("로그인 전에는 login 모드, 후에는 이름과 남은 횟수를 준다", async () => {
    expect(await (await me(meRequest())).json()).toEqual({ mode: "login", user: null, usage: null });
    const body = await (await me(meRequest(await sessionCookie()))).json();
    expect(body.user).toEqual({ login: "mom" });
    expect(body.usage.chat).toEqual({ used: 0, limit: 20 });
    expect(body.usage.plan).toEqual({ used: 0, limit: 5 });
    expect(JSON.stringify(body)).not.toMatch(/"id"/);
  });

  it("프로덕션에서 로그인이 없으면 closed", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    expect((await (await me(meRequest())).json()).mode).toBe("closed");
  });

  it("로그아웃은 쿠키를 지우고, 브라우저 요청만 받는다", async () => {
    const ok = await logout(post("/api/auth/logout", {}, await sessionCookie()));
    expect(ok.status).toBe(200);
    expect(setCookies(ok)[0]).toMatch(new RegExp(`^${sessionCookieName()}=;.*Max-Age=0`));
    const forged = await logout(post("/api/auth/logout", {}, undefined, { origin: "https://evil.example" }));
    expect(forged.status).toBe(403);
  });
});

describe("코치·루틴 API와 로그인", () => {
  it("로그인하지 않으면 AI를 쓸 수 없다 (401)", async () => {
    const a = await chat(post("/api/chat", chatBody("브리지 몇 세트요?")));
    expect(a.status).toBe(401);
    expect((await a.json()).code).toBe("login_required");
    const b = await plan(post("/api/plan", planBody));
    expect(b.status).toBe(401);
  });

  it("잘못된 쿠키로도 AI를 쓸 수 없다", async () => {
    const response = await chat(post("/api/chat", chatBody("걷기"), `${sessionCookieName()}=forged.token.value`));
    expect(response.status).toBe(401);
  });

  it("위험 증상 안내는 로그인 없이도 나온다", async () => {
    const response = await chat(post("/api/chat", chatBody("어제부터 출혈이 갑자기 많아졌어요")));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("진료가 먼저");
    expect((await plan(post("/api/plan", { ...planBody, condition: { pain: 0, fatigue: "low", note: "왼쪽 종아리가 붓고 아파요" } }))).status).toBe(200);
  });

  it("로그인했지만 AI 키가 없으면 횟수를 쓰지 않는다 (환불)", async () => {
    const cookie = await sessionCookie(9);
    expect((await chat(post("/api/chat", chatBody("걷기 방법"), cookie))).status).toBe(503);
    expect((await plan(post("/api/plan", planBody, cookie))).status).toBe(503);
    const usage = await readUsage(store, 9);
    expect(usage.chat.used).toBe(0);
    expect(usage.plan.used).toBe(0);
  });

  it("한도를 모두 쓴 사용자는 429, 그래도 위험 증상 안내는 나온다", async () => {
    const cookie = await sessionCookie(11);
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    for (let i = 0; i < 20; i++) await store.add(`ongi:${day}:u11:chat`, 1, 3600);
    const blocked = await chat(post("/api/chat", chatBody("걷기 방법"), cookie));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("quota_exceeded");
    const safety = await chat(post("/api/chat", chatBody("가슴이 아프고 숨이 차요"), cookie));
    expect(safety.status).toBe(200);
    expect(await safety.text()).toContain("119");
  });
});
