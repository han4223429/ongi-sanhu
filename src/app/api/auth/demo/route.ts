import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDemoPasscode, getSessionSecret, isDemoOpen } from "@/lib/auth-config";
import { guardRequest, json, readJson, requestFailure } from "@/lib/http";
import {
  SESSION_MAX_AGE_SECONDS,
  serializeCookie,
  sessionCookieName,
  signSession,
} from "@/lib/session";

const BodySchema = z.object({ code: z.string().min(1).max(64) });

// 코드 없는 모드에서 임의 번호를 너무 많이 만들지 못하게 하는 제한(이 서버 인스턴스 기준)
const MAX_OPEN_ENTRIES = 120;
let entries = { count: 0, resetAt: 0 };

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

  const open = isDemoOpen();
  const passcode = getDemoPasscode();
  const secret = getSessionSecret();
  if ((!open && !passcode) || !secret) {
    return json(
      { code: "demo_unavailable", message: "시연 코드 입장은 지금 열려 있지 않아요." },
      { status: 404 },
    );
  }

  const now = Date.now();

  if (open) {
    // 코드 없이 입장. 코드 확인은 건너뛰고, 입장 횟수만 제한한다.
    if (entries.resetAt <= now) entries = { count: 0, resetAt: now + WINDOW_MS };
    if (entries.count >= MAX_OPEN_ENTRIES) {
      return json(
        { code: "rate_limited", message: "지금은 입장이 많아요. 잠시 뒤에 다시 해 주세요." },
        { status: 429 },
      );
    }
    entries.count += 1;
    return enter(secret);
  }

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

  if (!passcode || !sameText(code, passcode)) {
    failures.count += 1;
    return json(
      { code: "wrong_code", message: "시연 코드가 맞지 않아요." },
      { status: 401 },
    );
  }

  return enter(secret);
}

/** 사람마다 다른 임의 번호로 입장시킨다. 사용 한도는 이 번호별로 센다. */
async function enter(secret: Uint8Array): Promise<Response> {
  const id = 1_000_000_000 + randomInt(0, 4_000_000_000);
  const token = await signSession({ id, login: "demo" }, secret);
  const response = json({ ok: true });
  response.headers.append(
    "set-cookie",
    serializeCookie(sessionCookieName(), token, SESSION_MAX_AGE_SECONDS),
  );
  return response;
}
