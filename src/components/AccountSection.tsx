"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { remaining, useAuth } from "@/lib/auth-client";
import { DemoCodeForm } from "./DemoCodeForm";

const RESULTS: Record<string, string> = {
  failed: "로그인하지 못했어요. 다시 시도해 주세요.",
  unavailable: "로그인이 아직 준비되지 않았어요.",
};

function LoginResult() {
  const code = useSearchParams().get("login");
  const message = code ? RESULTS[code] : undefined;
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-[var(--radius-control)] bg-danger-soft px-4 py-3 text-[0.9375rem] text-danger">
      {message}
    </p>
  );
}

/** 로그인 상태와 오늘 남은 횟수. 로그인이 꺼져 있는 개발 환경에서는 보이지 않는다. */
export function AccountSection() {
  const { state, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (state.status !== "ready" || state.mode === "open") return null;

  const signOut = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ongi-client": "web" },
        body: "{}",
      });
      if (!response.ok) throw new Error("logout failed");
      refresh();
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const chatLeft = remaining(state, "chat");
  const planLeft = remaining(state, "plan");

  return (
    <section aria-labelledby="account-title">
      <h2 id="account-title" className="display text-xl">
        AI 이용 계정
      </h2>
      {state.mode === "closed" ? (
        <p className="mt-2 text-[0.9375rem] text-muted">
          AI 코치와 루틴 조정은 지금 열려 있지 않아요. 나머지 기능은 그대로 쓸 수 있어요.
        </p>
      ) : state.user ? (
        <>
          <p className="mt-2 text-[0.9375rem]">
            {state.user.login === "demo" ? (
              "시연 코드로 입장했어요."
            ) : (
              <>
                GitHub 계정 <strong>{state.user.login}</strong>으로 로그인했어요.
              </>
            )}
          </p>
          {chatLeft !== null && planLeft !== null && (
            <p className="mt-1 text-[0.9375rem] text-muted">
              오늘 코치 {chatLeft}회, 루틴 조정 {planLeft}회 더 쓸 수 있어요. 한국 시간 자정에 새로 채워져요.
            </p>
          )}
          <button type="button" className="btn btn-outline mt-4 w-full" onClick={signOut} disabled={busy}>
            {busy ? "로그아웃하는 중…" : "로그아웃"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[0.9375rem] text-muted">
            {state.methods.demo && !state.methods.github
              ? "시연 코드를 입력하면 AI 코치와 루틴 조정을 쓸 수 있어요."
              : "입장하면 AI 코치와 루틴 조정을 쓸 수 있어요."}{" "}
            하루에 코치 20회, 루틴 조정 5회까지예요.
          </p>
          {state.methods.demo && !state.methods.open && <DemoCodeForm onDone={refresh} />}
          {state.methods.github && (
            <a
              href="/api/auth/login?next=/me"
              className={`btn mt-4 w-full ${state.methods.demo ? "btn-outline" : "btn-primary"}`}
            >
              GitHub로 로그인
            </a>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[0.9375rem] font-medium text-danger">
          {error}
        </p>
      )}
      <Suspense fallback={null}>
        <LoginResult />
      </Suspense>
    </section>
  );
}
