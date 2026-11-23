import Anthropic from "@anthropic-ai/sdk";
import { json } from "./http";
import { CATEGORY_LABEL, EXERCISES } from "./exercises";
import { DELIVERY_LABEL, SYMPTOMS, daysSince, type Profile } from "./profile";
import { PHASES, allowedExercises, getPhase } from "./program";

const DEFAULT_MODEL = "claude-opus-5-5";

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function hasApiKey(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.ANTHROPIC_AUTH_TOKEN?.trim(),
  );
}

let client: Anthropic | null = null;

/** 키는 환경변수(ANTHROPIC_API_KEY)에서 SDK가 읽는다. */
export function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 0 });
  return client;
}

/**
 * 안전 분류기가 요청을 거절했을 때 서버가 다른 모델로 이어서 답하게 한다.
 * 서버 측 fallback을 지원하는 모델에만 붙인다.
 */
export function fallbackParams(model: string) {
  if (!/^claude-(opus-5|sonnet-5-5|fable-5-[12])/.test(model)) return {};
  return {
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
  };
}

export interface ApiFailure {
  status: number;
  code: string;
  message: string;
}

export function mapError(error: unknown): ApiFailure {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return {
      status: 503,
      code: "no_api_key",
      message: "AI 연결 키를 확인해 주세요.",
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      code: "rate_limited",
      message: "요청이 많아요. 잠시 뒤 다시 시도해 주세요.",
    };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return {
      status: 504,
      code: "ai_unavailable",
      message: "AI 서버에 연결하지 못했어요.",
    };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      status: 502,
      code: "ai_unavailable",
      message: "AI 서버가 요청을 처리하지 못했어요.",
    };
  }
  return {
    status: 500,
    code: "server_error",
    message: "서버에서 문제가 생겼어요.",
  };
}

export function failure(failed: ApiFailure): Response {
  return json(
    { code: failed.code, message: failed.message },
    { status: failed.status },
  );
}

/* 시스템 프롬프트 */

function renderLibrary(): string {
  return EXERCISES.map((exercise) =>
    [
      `### ${exercise.name} (id: ${exercise.id})`,
      `분류: ${CATEGORY_LABEL[exercise.category]} / 시작 단계: ${exercise.phase}단계 / 기본: ${exercise.sets}세트 × ${exercise.reps} / 약 ${exercise.minutes}분`,
      `요약: ${exercise.summary}`,
      `방법: ${exercise.steps.map((step, index) => `${index + 1}) ${step}`).join(" ")}`,
      `호흡: ${exercise.breathing}`,
      `주의: ${exercise.cautions.join(" ")}`,
    ].join("\n"),
  ).join("\n\n");
}

/**
 * 모든 사용자에게 같은 고정 부분. 프롬프트 캐시가 적중하도록
 * 날짜·프로필처럼 바뀌는 값은 넣지 않는다.
 */
const STATIC_SYSTEM = `당신은 "온기산후" 앱의 산후 회복 운동 코치입니다. 출산한 지 얼마 안 된 산모가 아기를 돌보는 틈에 휴대폰으로 질문합니다.

## 말투와 형식
- 한국어 해요체로, 다정하지만 군더더기 없이 답합니다.
- 먼저 질문에 대한 답을 한두 문장으로 말하고, 필요할 때만 이유나 방법을 덧붙입니다.
- 휴대폰 화면에서 읽기 쉽게 보통 3~6문장으로 답합니다. 방법을 설명할 때만 번호 목록을 씁니다.
- 마크다운 기호(#, *, 굵게 표시)는 쓰지 않습니다. 일반 문장과 줄바꿈, "1." 형태의 번호만 씁니다.
- 산모를 평가하거나 다그치지 않습니다. 못 한 날이 있어도 괜찮다는 태도를 유지합니다.

## 할 수 있는 일
- 아래 운동 라이브러리의 동작을 설명하고, 자세·호흡·횟수·대체 동작을 안내합니다.
- 산후 회복의 일반적인 경과(복직근이개, 골반저근, 제왕절개 회복, 수유 중 자세, 수면 부족 시 운동량 조절 등)를 설명합니다.
- 사용자의 프로필과 오늘 허용된 운동 목록을 근거로 무엇을 해도 되는지 답합니다.

## 지켜야 할 선
- 운동을 권할 때는 아래 라이브러리에 있는 동작만, 그리고 "오늘 허용된 운동" 목록에 있는 것만 권합니다. 목록에 없는 동작을 물으면 아직 이른 이유를 설명하고 지금 할 수 있는 대체 동작을 알려 줍니다.
- 진단하지 않습니다. 약, 영양제 용량, 치료법을 처방하지 않습니다. "~일 수 있어요" 수준으로 말하고 확인은 의료진에게 받도록 안내합니다.
- 다음 증상이 언급되면 운동 이야기를 하기 전에 진료를 먼저 권합니다: 갑자기 늘어난 출혈이나 큰 핏덩이, 38도 이상 발열, 한쪽 종아리 통증·부기, 가슴 통증·호흡곤란, 심한 두통·시야 이상, 상처의 고름·벌어짐·심해지는 통증, 자신이나 아기를 해칠 것 같은 생각. 응급이면 119, 마음이 위태로우면 자살예방상담전화 109를 안내합니다.
- 의료진의 운동 허가를 받지 않은 사용자에게는 0단계(호흡, 골반저근, 발목 펌프, 가벼운 걷기, 스트레칭)만 권합니다.
- 체중 감량 속도나 몸매를 목표로 삼도록 부추기지 않습니다. 회복과 기능이 목표입니다.
- 산후 회복 운동과 관계없는 요청은 정중히 사양하고 도울 수 있는 범위를 알려 줍니다.

## 회복 단계
- 0단계 ${PHASES[0].title}: 의료진 허가 전이거나 초기(자연분만 2주 미만, 제왕절개 6주 미만).
- 1단계 ${PHASES[1].title}: 자연분만 2~6주, 제왕절개 6~8주.
- 2단계 ${PHASES[2].title}: 12주 미만, 또는 12주가 지났지만 복직근이개·요실금·골반 통증이 남아 있는 경우.
- 3단계 ${PHASES[3].title}: 12주 이후이고 위 증상이 없는 경우.

## 운동 라이브러리
${renderLibrary()}`;

function describeProfile(profile: Profile, today: string): string {
  const days = daysSince(profile.birthDate, today);
  const phase = PHASES[getPhase(profile, today)];
  const symptoms = SYMPTOMS.filter((item) => profile.symptoms.includes(item.id))
    .map((item) => item.label)
    .join(", ");
  const allowed = allowedExercises(profile, today);

  return [
    "## 이 사용자",
    `- 산후 ${Math.floor(days / 7)}주 ${days % 7}일 (${days + 1}일째)`,
    `- 분만 방식: ${DELIVERY_LABEL[profile.delivery]}`,
    `- 의료진 운동 허가: ${profile.cleared ? "받음" : "아직 받지 않음"}`,
    `- 불편한 곳: ${symptoms || "없음"}`,
    `- 하루 운동 가능 시간: ${profile.minutes}분`,
    `- 현재 회복 단계: ${phase.phase}단계 ${phase.title}`,
    profile.redFlags.length > 0
      ? "- 설문에서 위험 증상을 체크했습니다. 운동을 권하지 말고 진료를 먼저 권하세요."
      : `- 오늘 허용된 운동 id: ${allowed.map((exercise) => exercise.id).join(", ")}`,
  ].join("\n");
}

/**
 * 고정 블록에 캐시 지점을 두고, 사용자마다 달라지는 블록은 그 뒤에 둔다.
 * extra는 요청별 지시(예: 감지된 위험 증상)를 덧붙일 때 쓴다.
 */
export function buildSystem(profile: Profile, today: string, extra?: string) {
  return [
    {
      type: "text" as const,
      text: STATIC_SYSTEM,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: [describeProfile(profile, today), extra].filter(Boolean).join("\n\n"),
    },
  ];
}
