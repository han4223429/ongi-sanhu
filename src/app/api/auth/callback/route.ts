import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAuthConfig } from "@/lib/auth-config";
import { exchangeCodeForUser, safeNext } from "@/lib/github-oauth";
import {
  SESSION_MAX_AGE_SECONDS,
  clearedCookie,
  readCookie,
  serializeCookie,
  sessionCookieName,
  signSession,
  stateCookieName,
} from "@/lib/session";

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/** GitHub이 돌려보낸 요청을 확인하고 로그인 쿠키를 만든다. */
export async function GET(request: Request) {
  // 빌드 때 미리 만들어지지 않고 요청마다 실행되게 한다. (state가 모든 사용자에게 같아지면 안 된다)
  await connection();
  const config = getAuthConfig();
  const clearState = clearedCookie(stateCookieName());
  if (!config.enabled) return redirect("/me?login=unavailable", [clearState]);

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const stored = readCookie(request, stateCookieName());
  const dot = stored?.indexOf(".") ?? -1;
  const expectedState = stored && dot > 0 ? stored.slice(0, dot) : "";
  const next = safeNext(
    stored && dot > 0 ? decodeURIComponent(stored.slice(dot + 1)) : null,
  );

  const failed = () => redirect("/me?login=failed", [clearState]);
  if (params.get("error") || !code || code.length > 200) return failed();
  if (!state || !expectedState || !equal(state, expectedState)) return failed();

  try {
    const user = await exchangeCodeForUser(code, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: `${config.baseUrl}/api/auth/callback`,
    });
    const token = await signSession(user, config.secret);
    return redirect(next, [
      serializeCookie(sessionCookieName(), token, SESSION_MAX_AGE_SECONDS),
      clearState,
    ]);
  } catch {
    return failed();
  }
}
