import { getSessionSecret, isProduction, loginMethods } from "./auth-config";
import { json } from "./http";
import { readCookie, sessionCookieName, verifySession, type SessionUser } from "./session";
import {
  consume,
  getUsageStore,
  refund,
  type UsageKind,
} from "./usage";

export type AIGate =
  | { ok: true; key: string; refund: () => Promise<void> }
  | { ok: false; response: Response };

const deny = (status: number, code: string, message: string, extra = {}) => ({
  ok: false as const,
  response: json({ code, message, ...extra }, { status }),
});

/** 요청을 보낸 로그인 사용자. 없거나 잘못된 쿠키면 null. */
export async function currentUser(request: Request): Promise<SessionUser | null> {
  const methods = loginMethods();
  if (!methods.github && !methods.demo) return null;
  const secret = getSessionSecret();
  if (!secret) return null;
  const token = readCookie(request, sessionCookieName());
  return token ? verifySession(token, secret) : null;
}

/**
 * AI를 쓰기 전에 거치는 문. 로그인 확인 → 하루 한도 차감.
 * 위험 증상 안내와 기본 루틴은 이 문을 거치지 않는다(항상 열려 있다).
 */
export async function gateAI(request: Request, kind: UsageKind): Promise<AIGate> {
  const methods = loginMethods();

  if (!methods.github && !methods.demo) {
    if (isProduction()) {
      return deny(
        503,
        "ai_disabled",
        "AI 기능은 아직 열리지 않았어요. 기본 루틴과 안내는 그대로 쓸 수 있어요.",
      );
    }
    // 개발·테스트: 로그인 없이 열어 둔다(이전과 같은 동작).
    return { ok: true, key: "shared", refund: async () => {} };
  }

  const user = await currentUser(request);
  if (!user) {
    return deny(401, "login_required", "AI를 쓰려면 먼저 로그인해 주세요.");
  }

  const store = getUsageStore();
  if (!store) {
    return deny(
      503,
      "ai_disabled",
      "사용량을 확인할 수 없어 AI를 잠시 닫아 두었어요. 기본 루틴은 그대로 쓸 수 있어요.",
    );
  }

  const result = await consume(store, user.id, kind);
  if (!result.ok) {
    if (result.reason === "unavailable") {
      return deny(503, "ai_disabled", "사용량을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
    const resetsAt = result.resetsAt.toISOString();
    return deny(
      429,
      result.reason === "user" ? "quota_exceeded" : "capacity_reached",
      result.reason === "user"
        ? "오늘 쓸 수 있는 횟수를 모두 썼어요. 내일 다시 쓸 수 있어요."
        : "오늘은 AI 이용이 많아 잠시 닫았어요. 내일 다시 열려요.",
      { resetsAt },
    );
  }

  return {
    ok: true,
    key: `user:${user.id}`,
    refund: () => refund(result.ticket),
  };
}
