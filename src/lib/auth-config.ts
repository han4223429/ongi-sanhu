/**
 * 로그인(GitHub OAuth) 설정. 환경변수가 모두 있어야 로그인이 켜진다.
 *
 * AI 접근 규칙 (src/lib/ai-access.ts):
 * - 로그인 설정 있음 → 로그인한 사용자만, 하루 한도 안에서 AI 사용
 * - 설정 없음 + 개발/테스트 → 이전처럼 열려 있음(로컬 확인용)
 * - 설정 없음 + 프로덕션 → AI 기능 닫힘 (키가 있어도 누구나 쓰는 일이 없게)
 */
export type AuthConfig =
  | {
      enabled: true;
      clientId: string;
      clientSecret: string;
      secret: Uint8Array;
      /** 로그인 주소의 기준(예: https://ongi-sanhu.vercel.app). Host 헤더를 믿지 않는다. */
      baseUrl: string;
    }
  | { enabled: false };

export const isProduction = () => process.env.NODE_ENV === "production";

const MIN_SECRET_LENGTH = 32;

export function getAuthConfig(): AuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const secret = process.env.AUTH_SECRET?.trim();
  if (!clientId || !clientSecret || !secret || secret.length < MIN_SECRET_LENGTH) {
    return { enabled: false };
  }

  const configured = process.env.AUTH_URL?.trim().replace(/\/+$/, "");
  const baseUrl = configured || (isProduction() ? "" : "http://localhost:3000");
  try {
    const url = new URL(baseUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && !isProduction())) {
      return { enabled: false };
    }
    if (url.pathname !== "/" || url.search || url.hash) return { enabled: false };
  } catch {
    return { enabled: false };
  }

  return {
    enabled: true,
    clientId,
    clientSecret,
    secret: new TextEncoder().encode(secret),
    baseUrl,
  };
}
