import { z } from "zod";
import type { SessionUser } from "./session";

/**
 * GitHub OAuth. 요청하는 권한(scope)이 없어서 공개 프로필(id, 로그인 이름)만 받는다.
 * 이메일이나 저장소 접근은 요청하지 않는다.
 */
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";
const TIMEOUT_MS = 10_000;

export function authorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

const TokenSchema = z.object({ access_token: z.string().min(1).max(500) });
const UserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/),
});

/** 인가 코드를 GitHub 사용자로 바꾼다. 실패하면 예외를 던진다. */
export async function exchangeCodeForUser(
  code: string,
  config: { clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SessionUser> {
  const tokenResponse = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenResponse.ok) throw new Error("github token request failed");
  const token = TokenSchema.parse(await tokenResponse.json());

  const userResponse = await fetchImpl(USER_URL, {
    headers: {
      authorization: `Bearer ${token.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "ongi-sanhu",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!userResponse.ok) throw new Error("github user request failed");
  return UserSchema.parse(await userResponse.json());
}

/** 로그인 뒤 돌아갈 곳. 같은 사이트의 경로만 허용한다(열린 리디렉션 방지). */
export function safeNext(value: string | null | undefined): string {
  if (!value || !/^\/[A-Za-z0-9/_-]*$/.test(value) || value.startsWith("//")) {
    return "/today";
  }
  return value;
}
