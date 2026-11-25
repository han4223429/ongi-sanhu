"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SendIcon, StopIcon } from "@/components/icons";
import { LoginCard } from "@/components/LoginCard";
import { isLocked, remaining, useAuth } from "@/lib/auth-client";
import type { Profile } from "@/lib/profile";
import { chatHistory } from "@/lib/chat-history";
import { detectRedFlags, redFlagNotice } from "@/lib/redflags";
import {
  KEYS,
  captureStore,
  clearChat,
  saveChat,
  useChat,
  useProfile,
  useToday,
  type ChatMessage,
} from "@/lib/store";

const SUGGESTIONS = [
  "오늘 루틴 중에 뭐가 제일 중요해요?",
  "배가 아직 나와 있는데 윗몸일으키기 해도 돼요?",
  "수유하고 나면 허리가 아픈데 어떻게 풀어요?",
  "잠을 거의 못 잤는데 운동해도 될까요?",
];

const ERRORS: Record<string, string> = {
  no_api_key:
    "AI 코치가 아직 연결되지 않았어요. 연결되기 전까지는 오늘의 루틴과 운동 설명을 이용해 주세요.",
  rate_limited: "요청이 많아요. 최대 5분 뒤에 다시 보내 주세요.",
  too_large: "대화가 너무 길어졌어요. 대화를 지우고 다시 시작해 주세요.",
  ai_unavailable: "지금은 답을 가져오지 못했어요. 잠시 뒤 다시 보내 주세요.",
  login_required: "로그인이 풀렸어요. 아래에서 다시 로그인해 주세요.",
  quota_exceeded: "오늘 쓸 수 있는 코치 횟수를 모두 썼어요. 내일 다시 쓸 수 있어요.",
  capacity_reached: "오늘은 AI 이용이 많아 잠시 닫았어요. 내일 다시 열려요.",
  ai_disabled: "AI 코치가 지금은 열려 있지 않아요. 오늘의 루틴과 운동 설명을 이용해 주세요.",
};

export default function CoachPage() {
  const profile = useProfile();
  const today = useToday();
  const messages = useChat();
  const router = useRouter();

  useEffect(() => {
    if (profile === null) router.replace("/");
  }, [profile, router]);

  if (!profile || !today || !messages) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
        <div className="skeleton h-10 w-24" />
        <div className="skeleton h-14" />
        <div className="skeleton h-14" />
      </main>
    );
  }

  return <Chat profile={profile} today={today} messages={messages} />;
}

function Chat({
  profile,
  today,
  messages,
}: {
  profile: Profile;
  today: string;
  messages: ChatMessage[];
}) {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const { state: auth, refresh: refreshAuth } = useAuth();
  const locked = isLocked(auth);
  const left = remaining(auth, "chat");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const streaming = draft !== null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, draft]);

  useEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming || abortRef.current) return;
    // 위험 증상 안내는 로그인 없이도 나온다. 그 밖의 질문은 로그인이 필요하다.
    if (
      locked &&
      redFlagNotice([...new Set([...profile.redFlags, ...detectRedFlags(content)])]) === ""
    ) {
      setError(
        auth.status === "ready" && auth.mode === "closed"
          ? ERRORS.ai_disabled
          : ERRORS.login_required,
      );
      return;
    }

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    if (!saveChat(history)) {
      setError("대화를 저장하지 못했어요. 브라우저의 저장 공간과 권한을 확인해 주세요.");
      return;
    }
    const snapshot = captureStore(KEYS.chat, KEYS.profile);
    setInput("");
    setError("");
    setConfirmClear(false);
    setDraft("");

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";

    try {
      // Always show existing deterministic safety guidance, even if the API is busy/offline.
      const notice = redFlagNotice([...new Set([...profile.redFlags, ...detectRedFlags(content)])]);
      if (notice) { answer = notice; return; }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ongi-client": "web" },
        body: JSON.stringify({ profile, today, messages: chatHistory(history) }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70_000)]),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        // 연결에 실패해도 위험 증상 안내는 보여 준다.
        if (typeof data?.notice === "string" && data.notice) {
          answer = data.notice;
        }
        setError(
          ERRORS[data?.code] ??
            "보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
        );
        if (data?.code === "login_required" || data?.code === "quota_exceeded") refreshAuth();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setDraft(answer);
      }
      answer += decoder.decode();
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === "AbortError";
      if (!aborted) {
        setError("연결이 끊겼어요. 인터넷을 확인하고 다시 보내 주세요.");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        if (answer.trim()) {
          saveChat([...history, { role: "assistant", content: answer.trim() }], snapshot);
        }
        setDraft(null);
        refreshAuth();
      }
    }
  };

  const empty = messages.length === 0 && !streaming;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-6 pt-4">
        <h1 className="display text-[1.75rem]">코치</h1>
        {!empty && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="min-h-11 cursor-pointer rounded-lg px-2 text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            대화 지우기
          </button>
        )}
      </header>

      {confirmClear && (
        <section aria-label="대화 삭제 확인" className="mx-6 mt-4 rounded-[var(--radius-control)] border border-line bg-surface p-4">
          <p className="font-medium">이 기기의 대화를 모두 지울까요?</p>
          <p className="mt-2 text-sm text-muted">진행 중인 답변도 멈춰요. 지운 대화는 되돌릴 수 없어요.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmClear(false)}>취소</button>
            <button type="button" className="btn btn-danger" onClick={() => {
              abortRef.current?.abort();
              abortRef.current = null;
              setDraft(null);
              setConfirmClear(false);
              setError(clearChat() ? "" : "대화를 지우지 못했어요. 브라우저 저장소 권한을 확인해 주세요.");
            }}>대화 지우기</button>
          </div>
        </section>
      )}

      <div className="flex-1 px-6 pb-4 pt-4">
        {empty && locked ? (
          <LoginCard state={auth} next="/coach" what="AI 코치" onLoggedIn={refreshAuth} />
        ) : empty ? (
          <section>
            <p className="text-muted">
              오늘 루틴, 동작하는 법, 몸의 변화까지 편하게 물어보세요. 내 산후
              주차와 증상을 알고 답해요.
            </p>
            <p className="mt-3 text-sm text-muted">질문과 회복 정보가 AI 제공자에게 전달돼요. 이름·연락처는 적지 않아도 돼요.</p>
            <ul className="mt-6 space-y-2">
              {SUGGESTIONS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => void send(question)}
                    className="min-h-12 w-full cursor-pointer rounded-[var(--radius-control)] border-[1.5px] border-line bg-surface px-4 py-3 text-left transition-colors hover:border-primary"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <ol className="space-y-4" aria-live="polite">
            {messages.map((message, index) => (
              <Bubble key={index} role={message.role} text={message.content} />
            ))}
            {streaming && <Bubble role="assistant" text={draft} pending />}
          </ol>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[var(--radius-control)] bg-danger-soft px-4 py-3 text-[0.9375rem] text-danger"
          >
            {error}
          </p>
        )}
        {!empty && locked && (
          <div className="mt-4">
            <LoginCard state={auth} next="/coach" what="AI 코치" onLoggedIn={refreshAuth} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-bg px-4 pb-2 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="question" className="sr-only">
            코치에게 질문
          </label>
          <textarea
            id="question"
            ref={inputRef}
            rows={1}
            maxLength={2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // 한글 조합 중의 Enter는 보내지 않는다.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send(input);
              }
            }}
            placeholder={
              locked
                ? auth.status === "ready" && auth.mode === "closed"
                  ? "AI 코치는 지금 열려 있지 않아요"
                  : "로그인하면 질문할 수 있어요"
                : "궁금한 걸 물어보세요"
            }
            disabled={locked}
            className="field max-h-32 min-h-12 flex-1 resize-none [field-sizing:content]"
          />
          {streaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="답변 멈추기"
              className="btn btn-outline size-12 min-h-12 flex-none px-0"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || locked}
              aria-label="보내기"
              className="btn btn-primary size-12 min-h-12 flex-none px-0"
            >
              <SendIcon />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          {left !== null ? `오늘 ${left}회 더 물어볼 수 있어요. ` : ""}
          일반 건강 정보예요. 진단이나 치료를 대신하지 않아요.
        </p>
      </form>
    </main>
  );
}

function Bubble({
  role,
  text,
  pending = false,
}: {
  role: ChatMessage["role"];
  text: string;
  pending?: boolean;
}) {
  const mine = role === "user";
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap px-4 py-3 ${
          mine
            ? "rounded-[1.25rem] rounded-br-md bg-primary text-on-primary"
            : "rounded-[1.25rem] rounded-bl-md bg-surface ring-1 ring-inset ring-line"
        }`}
      >
        <span className="sr-only">{mine ? "나: " : "코치: "}</span>
        {text}
        {pending && !text && (
          <span
            className="flex items-center gap-1.5 py-1"
            role="status"
            aria-label="답을 쓰는 중"
          >
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-2 rounded-full bg-muted"
                style={{ animation: `pulse 1.1s ${dot * 0.18}s ease-in-out infinite` }}
              />
            ))}
          </span>
        )}
      </div>
    </li>
  );
}
