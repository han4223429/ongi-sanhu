import { SignJWT, jwtVerify } from "jose";
import { isProduction } from "./auth-config";

/** 서명된 세션 쿠키. 저장하는 것은 GitHub 숫자 id와 표시용 로그인 이름뿐이다. */
export interface SessionUser {
  id: number;
  login: string;
}

const ISSUER = "ongi-sanhu";
const AUDIENCE = "ongi-web";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

/** 프로덕션에서는 __Host- 접두사로 도메인·경로 고정과 Secure를 브라우저가 강제한다. */
export const sessionCookieName = () =>
  isProduction() ? "__Host-ongi_session" : "ongi_session";
export const stateCookieName = () =>
  isProduction() ? "__Host-ongi_oauth" : "ongi_oauth";

export async function signSession(
  user: SessionUser,
  secret: Uint8Array,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return new SignJWT({ login: user.login })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(secret);
}

export async function verifySession(
  token: string,
  secret: Uint8Array,
  now = Date.now(),
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: new Date(now),
    });
    const id = Number(payload.sub);
    const login = payload.login;
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    if (typeof login !== "string" || !LOGIN_PATTERN.test(login)) return null;
    return { id, login };
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

export function serializeCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProduction()) parts.push("Secure");
  return parts.join("; ");
}

export const clearedCookie = (name: string) => serializeCookie(name, "", 0);
