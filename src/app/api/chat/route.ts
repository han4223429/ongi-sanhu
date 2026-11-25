import { acquireAI, aiSignal } from "@/lib/ai-budget";
import { gateAI } from "@/lib/ai-access";
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
import { allow } from "@/lib/ratelimit";
import { detectRedFlags, redFlagNotice } from "@/lib/redflags";

export const maxDuration = 120;

const MAX_BODY_BYTES = 100_000;

const BodySchema = z.object({
  profile: ProfileSchema,
  today: DateKeySchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
});

const REFUSAL_TEXT =
  "이 질문에는 답해 드리기 어려워요. 산후 회복 운동에 대해 다른 방식으로 물어봐 주세요.";
const INTERRUPTED_TEXT = "\n\n(답변이 중간에 끊겼어요. 다시 물어봐 주세요.)";

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

  const { profile, today } = parsed.data;
  // 최근 30개만 보낸다. 대화는 사용자 메시지로 시작하고 끝나야 한다.
  let messages = parsed.data.messages.slice(-30);
  while (messages.length > 0 && messages[0].role !== "user") {
    messages = messages.slice(1);
  }
  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    return failure({
      status: 400,
      code: "bad_request",
      message: "질문을 입력해 주세요.",
    });
  }

  // 위험 증상은 AI에 맡기지 않고 규칙으로 먼저 안내한다.
  const flags = [...new Set([...profile.redFlags, ...detectRedFlags(last.content)])];
  const notice = redFlagNotice(flags);

  // Deterministic safety notice cannot be overridden by a user or model instruction.
  if (notice) return new Response(notice, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

  // 로그인 확인과 하루 사용량 차감. 위험 증상 안내는 위에서 이미 이 문을 거치지 않고 반환했다.
  const gate = await gateAI(request, "chat");
  if (!gate.ok) return gate.response;

  if (!allow(`chat:${gate.key}`, 30)) {
    await gate.refund();
    return failure({
      status: 429,
      code: "rate_limited",
      message: "요청이 많아요. 잠시 뒤 다시 시도해 주세요.",
    });
  }

  if (!hasApiKey()) {
    await gate.refund();
    // 키가 없어도 위험 증상 안내는 반드시 전달한다.
    return json(
      {
        code: "no_api_key",
        message: "AI 코치가 아직 연결되지 않았어요.",
        notice,
      },
      { status: 503 },
    );
  }

  const release = acquireAI();
  if (!release) {
    await gate.refund();
    return failure({ status: 429, code: "rate_limited", message: "AI가 다른 요청을 처리하고 있어요. 잠시 뒤 시도해 주세요." });
  }
  const signal = aiSignal(request);
  const model = getModel();
  let stream: ReturnType<ReturnType<typeof getClient>["beta"]["messages"]["stream"]>;
  let events: ReturnType<typeof stream[typeof Symbol.asyncIterator]>;
  let current: Awaited<ReturnType<typeof events.next>>;
  let abortUpstream: (() => void) | undefined;
  try {
    stream = getClient().beta.messages.stream(
      {
        model,
        max_tokens: 2048,
        system: buildSystem(profile, today),
        messages,
        output_config: { effort: "low" },
        ...fallbackParams(model),
      },
      { signal },
    );
    abortUpstream = () => stream.abort();
    events = stream[Symbol.asyncIterator]();
    current = await events.next();
  } catch (error) {
    abortUpstream?.();
    release();
    await gate.refund();
    const failed = mapError(error);
    console.error("[chat] upstream error", failed.code);
    return failure(failed);
  }

  const encoder = new TextEncoder();
  let closed = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (!closed && text) controller.enqueue(encoder.encode(text));
      };

      let wroteText = false;
      let outputCharacters = 0;
      let stopReason: string | null = null;
      try {
        while (!current.done) {
          const event = current.value;
          if (event.type === "message_start") {
            const usage = event.message.usage;
            console.info("[chat] usage", {
              input: usage.input_tokens,
              cacheRead: usage.cache_read_input_tokens ?? 0,
              cacheWrite: usage.cache_creation_input_tokens ?? 0,
            });
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            outputCharacters += event.delta.text.length;
            if (outputCharacters > 8000) throw new Error("AI output exceeded limit");
            wroteText = true;
            send(event.delta.text);
          } else if (event.type === "message_delta") {
            stopReason = event.delta.stop_reason ?? stopReason;
          }
          current = await events.next();
        }

        if (stopReason === "refusal") {
          send(wroteText ? `\n\n${REFUSAL_TEXT}` : REFUSAL_TEXT);
        } else if (stopReason === "max_tokens") {
          send(INTERRUPTED_TEXT);
        }
      } catch (error) {
        if (!closed && !request.signal.aborted) {
          console.error("[chat] stream error", mapError(error).code);
          send(INTERRUPTED_TEXT);
        }
      } finally {
        stream.abort();
        release();
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      stream.abort();
      release();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
