import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDemoPasscode, getSessionSecret } from "@/lib/auth-config";
import { guardRequest, json, readJson, requestFailure } from "@/lib/http";
import {
  SESSION_MAX_AGE_SECONDS,
  serializeCookie,
  sessionCookieName,
  signSession,
} from "@/lib/session";

const BodySchema = z.object({ code: z.string().min(1).max(64) });

// 틀린 코드 시도 제한(이 서버 인스턴스 기준). 맞게 입력한 사람은 세지 않는다.
const WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 10;
let failures = { count: 0, resetAt: 0 };

function sameText(a: string, b: string): boolean {
  // 길이가 달라도 같은 시간이 걸리도록 해시끼리 비교한다.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * 시연 코드로 입장한다. 코드를 아는 사람에게 로그인 쿠키(임의 번호)를 준다.
 * 이름이나 계정 정보는 받지 않는다.
 */
export async function POST(request: Request) {
  const rejected = guardRequest(request);
  if (rejected) return rejected;

  const passcode = getDemoPasscode();
  const secret = getSessionSecret();
  if (!passcode || !secret) {
    return json(
      { code: "demo_unavailable", message: "시연 코드 입장은 지금 열려 있지 않아요." },
      { status: 404 },
    );
  }

  const now = Date.now();
  if (failures.resetAt <= now) failures = { count: 0, resetAt: now + WINDOW_MS };
  if (failures.count >= MAX_FAILURES) {
    return json(
      { code: "rate_limited", message: "틀린 시도가 많아요. 5분 뒤에 다시 해 주세요." },
      { status: 429 },
    );
  }

  let code: string;
  try {
    code = BodySchema.parse(await readJson(request, 1024)).code.trim();
  } catch (error) {
    return requestFailure(error);
  }

  if (!sameText(code, passcode)) {
    failures.count += 1;
    return json(
      { code: "wrong_code", message: "시연 코드가 맞지 않아요." },
      { status: 401 },
    );
  }

  // 사람마다 다른 임의 번호. 사용 한도는 이 번호별로 센다.
  const id = 1_000_000_000 + randomInt(0, 4_000_000_000);
  const token = await signSession({ id, login: "demo" }, secret);
  const response = json({ ok: true });
  response.headers.append(
    "set-cookie",
    serializeCookie(sessionCookieName(), token, SESSION_MAX_AGE_SECONDS),
  );
  return response;
}
