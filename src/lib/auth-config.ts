/**
 * 로그인(GitHub OAuth) 설정. 환경변수가 모두 있어야 로그인이 켜진다.
 *
 * AI 접근 규칙 (src/lib/ai-access.ts):
 * - 로그인 설정 있음 → 로그인한 사용자만, 하루 한도 안에서 AI 사용
 * - 설정 없음 + 개발/테스트 → 이전처럼 열려 있음(로컬 확인용)
 * - 설정 없음 + 프로덕션 → AI 기능 닫힘 (키가 있어도 누구나 쓰는 일이 없게)
 */
/** 로그인 쿠키 서명 키. 로그인 방법(GitHub, 시연 코드)이 같이 쓴다. */
export function getSessionSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 32 ? new TextEncoder().encode(secret) : null;
}

/** 시연 코드. 8자 이상이고 쿠키 서명 키가 있어야 켜진다. */
export function getDemoPasscode(): string | null {
  const code = process.env.DEMO_PASSCODE?.trim();
  return code && code.length >= 8 && getSessionSecret() ? code : null;
}

/**
 * 코드 없이 입장하는 시연 모드. DEMO_OPEN=1 과 만료 시각 DEMO_OPEN_UNTIL(ISO 형식, 예: 2026-12-03T00:00:00+09:00)이
 * 모두 있고 아직 지나지 않았을 때만 켜진다. 만료 시각이 없거나 잘못되면 켜지지 않는다.
 * 주소를 아는 누구나 AI를 쓸 수 있는 모드라서, 끄는 것을 잊어도 정해진 날 저절로 꺼지게 한다.
 */
export function isDemoOpen(now = Date.now()): boolean {
  if (process.env.DEMO_OPEN?.trim() !== "1" || getSessionSecret() === null) return false;
  const until = Date.parse(process.env.DEMO_OPEN_UNTIL?.trim() ?? "");
  return Number.isFinite(until) && now < until;
}

/** 시연 입장이 켜져 있는지 (코드 방식 또는 코드 없는 방식) */
export function demoEnabled(): boolean {
  return getDemoPasscode() !== null || isDemoOpen();
}

/** 지금 켜져 있는 로그인 방법 */
export function loginMethods(): { github: boolean; demo: boolean; open: boolean } {
  return {
    github: getAuthConfig().enabled,
    demo: demoEnabled(),
    open: isDemoOpen(),
  };
}

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
