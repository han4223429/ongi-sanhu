import { connection } from "next/server";
import { getAuthConfig } from "@/lib/auth-config";
import { authorizeUrl, safeNext } from "@/lib/github-oauth";
import { serializeCookie, stateCookieName } from "@/lib/session";

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString("base64url");
}

/** GitHub 로그인 화면으로 보낸다. 돌아올 때 확인할 state를 쿠키에 둔다. */
export async function GET(request: Request) {
  // 빌드 때 미리 만들어지지 않고 요청마다 실행되게 한다. (state가 모든 사용자에게 같아지면 안 된다)
  await connection();
  const config = getAuthConfig();
  if (!config.enabled) {
    return new Response(null, {
      status: 302,
      headers: { location: "/me?login=unavailable", "cache-control": "no-store" },
    });
  }

  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const state = randomState();
  const headers = new Headers({
    location: authorizeUrl(
      config.clientId,
      `${config.baseUrl}/api/auth/callback`,
      state,
    ),
    "cache-control": "no-store",
  });
  headers.append(
    "set-cookie",
    serializeCookie(stateCookieName(), `${state}.${encodeURIComponent(next)}`, 600),
  );
  return new Response(null, { status: 302, headers });
}
