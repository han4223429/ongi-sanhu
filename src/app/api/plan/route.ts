import { acquireAI, aiSignal } from "@/lib/ai-budget";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { guardRequest, readJson, requestFailure, json } from "@/lib/http";
import {
  buildSystem,
  failure,
  fallbackParams,
  getClient,
  getModel,
  hasApiKey,
  mapError,
} from "@/lib/anthropic";
import { DateKeySchema, ProfileSchema } from "@/lib/profile";
import {
  allowedExercises,
  buildRoutine,
  sanitizePlan,
} from "@/lib/program";
import { allow, clientKey } from "@/lib/ratelimit";
import { detectRedFlags } from "@/lib/redflags";

export const maxDuration = 120;

const MAX_BODY_BYTES = 20_000;

const BodySchema = z.object({
  profile: ProfileSchema,
  today: DateKeySchema,
  condition: z.object({
    pain: z.number().int().min(0).max(10),
    fatigue: z.enum(["low", "mid", "high"]),
    note: z.string().max(300),
  }),
});

/** AI가 채워야 하는 형식. 값 범위는 받은 뒤 sanitizePlan에서 다시 검증한다. */
const PlanSchema = z.object({
  exercises: z.array(
    z.object({
      id: z.string(),
      sets: z.number(),
      reps: z.string(),
      reason: z.string(),
    }),
  ),
  note: z.string(),
});

const FATIGUE_TEXT = {
  low: "괜찮음",
  mid: "조금 피곤함",
  high: "많이 지침",
} as const;

export async function POST(request: Request) {
  const rejected = guardRequest(request);
  if (rejected) return rejected;

  let parsed;
  try {
    parsed = BodySchema.safeParse(await readJson(request, MAX_BODY_BYTES));
  } catch (error) {
    return requestFailure(error);
  }
  if (!parsed?.success) {
    return failure({
      status: 400,
      code: "bad_request",
      message: "요청 형식이 올바르지 않아요.",
    });
  }

  const { profile, today, condition } = parsed.data;

  // 위험 증상이 있으면 루틴을 만들지 않는다.
  const redFlags = [
    ...new Set([...profile.redFlags, ...detectRedFlags(condition.note)]),
  ];
  if (redFlags.length > 0) {
    return json({ source: "rules", items: [], note: "", redFlags });
  }

  const gentle = condition.pain >= 6 || condition.fatigue === "high";
  const allowed = allowedExercises(profile, today).filter((exercise) =>
    !gentle || ["breathing", "pelvic_floor", "mobility"].includes(exercise.category),
  );
  const allowedIds = new Set(allowed.map((exercise) => exercise.id));
  const rules = buildRoutine(profile, today).filter((item) => allowedIds.has(item.id));

  if (!allow(`plan:${clientKey()}`, 10)) {
    return failure({
      status: 429,
      code: "rate_limited",
      message: "요청이 많아요. 잠시 뒤 다시 시도해 주세요.",
    });
  }

  if (!hasApiKey()) {
    return failure({
      status: 503,
      code: "no_api_key",
      message: "AI 코치가 아직 연결되지 않았어요.",
    });
  }

  const rulesFallback = () =>
    json({
      source: "rules",
      items: rules,
      note: "",
      code: "ai_unavailable",
    });

  const release = acquireAI();
  if (!release) return failure({ status: 429, code: "rate_limited", message: "AI가 다른 요청을 처리하고 있어요. 잠시 뒤 시도해 주세요." });
  const model = getModel();
  try {
    const response = await getClient().beta.messages.parse({
      model,
      max_tokens: 4096,
      system: buildSystem(profile, today),
      messages: [
        {
          role: "user",
          content: [
            "오늘 컨디션에 맞춰 루틴을 조정해 주세요.",
            `- 통증: ${condition.pain}/10`,
            `- 피로: ${FATIGUE_TEXT[condition.fatigue]}`,
            `- 메모: ${condition.note.trim() || "없음"}`,
            "",
            `기본 루틴: ${rules.map((item) => item.id).join(", ")}`,
            `고를 수 있는 운동 id: ${[...allowedIds].join(", ")}`,
            "",
            "규칙:",
            `- exercises의 id는 위 "고를 수 있는 운동 id" 중에서만 고릅니다.`,
            `- 전체 시간이 ${profile.minutes}분을 넘지 않게 합니다.`,
            "- 통증이 6 이상이거나 많이 지쳤다면 호흡·골반저근·풀어주기 위주로 줄이고 근력은 빼거나 세트를 줄입니다.",
            "- sets는 1 이상이며 운동 목록의 기본 sets를 넘기지 않습니다. reps는 운동 목록의 기본 reps를 그대로 씁니다.",
            "- reason은 이 운동을 오늘 넣은 이유를 한 문장(40자 안팎)으로 씁니다.",
            "- note는 오늘 루틴을 어떻게 맞췄는지 산모에게 건네는 말로 두 문장 안에 씁니다. 마크다운 기호는 쓰지 않고, 총 시간(분)이나 운동 개수는 쓰지 않습니다. 앱이 따로 계산해 보여 줍니다.",
          ].join("\n"),
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(PlanSchema) },
      ...fallbackParams(model),
    }, { signal: aiSignal(request) });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return rulesFallback();
    }

    const items = sanitizePlan(
      response.parsed_output.exercises,
      allowedIds,
      profile.minutes,
    );
    if (items.length === 0) return rulesFallback();

    return json({
      source: "ai",
      items,
      note: response.parsed_output.note.trim().slice(0, 300),
    });
  } catch (error) {
    const failed = mapError(error);
    console.error("[plan] upstream error", failed.code);
    // 키 문제와 한도 초과는 사용자가 알아야 하므로 그대로 알린다.
    if (failed.code === "no_api_key" || failed.code === "rate_limited") {
      return failure(failed);
    }
    return rulesFallback();
  } finally {
    release();
  }
}
