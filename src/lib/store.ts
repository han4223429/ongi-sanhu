"use client";

import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { parseProfile, toDateKey, type Profile } from "./profile";
import type { RoutineItem } from "./program";

/**
 * 기기 저장소(localStorage). 건강 정보라 서버에는 저장하지 않는다.
 * 훅은 로딩 중 undefined, 값 없음 null을 돌려준다.
 */

export const KEYS = {
  profile: "ongi.profile.v1",
  log: "ongi.log.v1",
  plan: "ongi.plan.v1",
  chat: "ongi.chat.v1",
} as const;

const CHANGE_EVENT = "ongi:store";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 저장에 실패하면(사생활 보호 모드, 용량 초과) false */
export function write(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return true;
}

export function clearAll(): boolean {
  // Keep the profile visible on failure so the user can see/retry the error.
  const cleared = [KEYS.chat, KEYS.plan, KEYS.log].map((key) => write(key, null));
  return cleared.every(Boolean) && write(KEYS.profile, null);
}

export type StoreSnapshot = Readonly<Record<string, string | null>>;
export function captureStore(...keys: string[]): StoreSnapshot {
  return Object.fromEntries(keys.map((key) => [key, read(key)]));
}
export function storeUnchanged(snapshot: StoreSnapshot): boolean {
  return Object.entries(snapshot).every(([key, value]) => read(key) === value);
}

function useRaw(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => undefined,
  );
}

function parseJson<T>(raw: string | null | undefined, schema: z.ZodType<T>) {
  if (!raw) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/* 프로필 */

export function useProfile(): Profile | null | undefined {
  const raw = useRaw(KEYS.profile);
  return useMemo(
    () => (raw === undefined ? undefined : parseProfile(raw)),
    [raw],
  );
}

export function saveProfile(profile: Profile): boolean {
  return write(KEYS.profile, JSON.stringify(profile));
}

/* 오늘 날짜 (기기 현지 기준) */

const noopSubscribe = () => () => {};

export function useToday(): string | undefined {
  return useSyncExternalStore(
    noopSubscribe,
    () => toDateKey(new Date()),
    () => undefined,
  );
}

/* 완료 기록: 날짜 → 완료한 운동 id */

const LogSchema = z.record(z.string(), z.array(z.string()));
export type Log = z.infer<typeof LogSchema>;

const LOG_KEEP_DAYS = 120;

export function useLog(): Log | undefined {
  const raw = useRaw(KEYS.log);
  return useMemo(
    () => (raw === undefined ? undefined : (parseJson(raw, LogSchema) ?? {})),
    [raw],
  );
}

/** 호출 시점의 저장값을 새로 읽어 바꾼다. 화면이 들고 있는 값이 낡아도 앞선 체크가 사라지지 않는다. */
export function toggleDone(date: string, id: string) {
  const current = parseJson(read(KEYS.log), LogSchema) ?? {};
  const done = new Set(current[date] ?? []);
  if (done.has(id)) done.delete(id);
  else done.add(id);

  const next: Log = { ...current, [date]: [...done] };
  const dates = Object.keys(next).sort();
  for (const old of dates.slice(0, Math.max(0, dates.length - LOG_KEEP_DAYS))) {
    delete next[old];
  }
  write(KEYS.log, JSON.stringify(next));
}

/* AI가 조정한 오늘의 루틴 */

const PlanSchema = z.object({
  date: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      sets: z.number(),
      reps: z.string(),
      reason: z.string().optional(),
    }),
  ),
  note: z.string(),
});
export type StoredPlan = z.infer<typeof PlanSchema>;

export function usePlan(): StoredPlan | null | undefined {
  const raw = useRaw(KEYS.plan);
  return useMemo(
    () => (raw === undefined ? undefined : parseJson(raw, PlanSchema)),
    [raw],
  );
}

export function savePlan(date: string, items: RoutineItem[], note: string, snapshot?: StoreSnapshot) {
  if (snapshot && !storeUnchanged(snapshot)) return false;
  return write(KEYS.plan, JSON.stringify({ date, items, note }));
}

export function clearPlan() {
  write(KEYS.plan, null);
}

/* 코치 대화 */

const ChatSchema = z.array(
  z.object({ role: z.enum(["user", "assistant"]), content: z.string() }),
);
export type ChatMessage = z.infer<typeof ChatSchema>[number];

const CHAT_KEEP = 40;

export function useChat(): ChatMessage[] | undefined {
  const raw = useRaw(KEYS.chat);
  return useMemo(
    () => (raw === undefined ? undefined : (parseJson(raw, ChatSchema) ?? [])),
    [raw],
  );
}

export function saveChat(messages: ChatMessage[], snapshot?: StoreSnapshot) {
  if (snapshot && !storeUnchanged(snapshot)) return false;
  return write(KEYS.chat, JSON.stringify(messages.slice(-CHAT_KEEP)));
}

export function clearChat() {
  return write(KEYS.chat, null);
}
