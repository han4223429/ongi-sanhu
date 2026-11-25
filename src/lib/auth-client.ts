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
      methods: { github: boolean; demo: boolean; open: boolean };
      user: { login: string } | null;
      usage: UsageInfo | null;
    };

/** 서버 없는 정적 데모(GitHub Pages) 빌드. 이 경우 AI 기능은 항상 닫힌 것으로 보여 준다. */
const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
const STATIC_STATE: AuthState = {
  status: "ready",
  mode: "closed",
  methods: { github: false, demo: false, open: false },
  user: null,
  usage: null,
};

/** 서버가 알려 주는 로그인 상태와 오늘 남은 횟수. 알 수 없으면 막지 않고 서버 판단에 맡긴다. */
export function useAuth() {
  const [state, setState] = useState<AuthState>(
    STATIC_DEMO ? STATIC_STATE : { status: "loading" },
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (STATIC_DEMO) return;
    const controller = new AbortController();
    const status = async () => {
      const response = await fetch("/api/auth/me", {
        headers: { "x-ongi-client": "web" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("auth status failed");
      return response.json();
    };
    (async () => {
      try {
        let data = await status();
        // 코드 없는 시연 모드: 입력 없이 자동으로 입장한다. (실패해도 다시 시도하지 않는다)
        if (data.mode === "login" && data.methods?.open && !data.user) {
          const entered = await fetch("/api/auth/demo", {
            method: "POST",
            headers: { "content-type": "application/json", "x-ongi-client": "web" },
            body: "{}",
            signal: controller.signal,
          });
          if (entered.ok) data = await status();
        }
        setState({
          status: "ready",
          mode: data.mode,
          methods: {
            github: Boolean(data.methods?.github),
            demo: Boolean(data.methods?.demo),
            open: Boolean(data.methods?.open),
          },
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
