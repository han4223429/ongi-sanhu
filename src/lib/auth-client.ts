"use client";

import { useCallback, useEffect, useState } from "react";

export interface UsageInfo {
  chat: { used: number; limit: number };
  plan: { used: number; limit: number };
  resetsAt: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      mode: "login" | "open" | "closed";
      user: { login: string } | null;
      usage: UsageInfo | null;
    };

/** 서버가 알려 주는 로그인 상태와 오늘 남은 횟수. 알 수 없으면 막지 않고 서버 판단에 맡긴다. */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { "x-ongi-client": "web" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("auth status failed");
        const data = await response.json();
        setState({
          status: "ready",
          mode: data.mode,
          user: data.user ?? null,
          usage: data.usage ?? null,
        });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return { state, refresh };
}

/** 로그인이 필요한데 아직 안 했거나, AI가 닫혀 있는 상태 */
export function isLocked(state: AuthState): boolean {
  return (
    state.status === "ready" &&
    (state.mode === "closed" || (state.mode === "login" && !state.user))
  );
}

export function remaining(state: AuthState, kind: "chat" | "plan"): number | null {
  if (state.status !== "ready" || !state.user || !state.usage) return null;
  const { used, limit } = state.usage[kind];
  return Math.max(0, limit - used);
}
