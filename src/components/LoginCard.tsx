"use client";

import type { AuthState } from "@/lib/auth-client";
import { DemoCodeForm } from "./DemoCodeForm";

/** AI를 쓰려면 입장(로그인)이 필요하다는 안내. 입장 없이 되는 것은 함께 알려 준다. */
export function LoginCard({
  state,
  next,
  what,
  onLoggedIn,
}: {
  state: AuthState;
  next: string;
  what: string;
  onLoggedIn?: () => void;
}) {
  const closed = state.status === "ready" && state.mode === "closed";

  if (closed) {
    return (
      <section className="rounded-[var(--radius-control)] border border-line bg-surface p-4">
        <h2 className="font-semibold">{what}은 지금 열려 있지 않아요</h2>
        <p className="mt-2 text-[0.9375rem] text-muted">
          오늘의 루틴, 운동 설명, 위험 증상 안내는 그대로 쓸 수 있어요.
        </p>
      </section>
    );
  }

  const methods =
    state.status === "ready"
      ? state.methods
      : { github: true, demo: false, open: false };

  return (
    <section className="rounded-[var(--radius-control)] border border-line bg-surface p-4">
      <h2 className="font-semibold">
        {methods.demo && !methods.open && !methods.github
          ? `시연 코드를 입력하면 ${what}을 쓸 수 있어요`
          : `로그인하면 ${what}을 쓸 수 있어요`}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-muted">
        출산 정보와 운동 기록은 입장과 상관없이 이 기기에만 저장돼요. 하루에 쓸 수
        있는 횟수에는 한도가 있어요.
      </p>
      <p className="mt-2 text-sm text-muted">
        자세한 내용은{" "}
        <a href="/privacy" className="underline underline-offset-4">
          개인정보 처리방침
        </a>
        에 있어요.
      </p>
      {methods.demo && !methods.open && <DemoCodeForm onDone={onLoggedIn} />}
      {methods.github && (
        <a
          href={`/api/auth/login?next=${encodeURIComponent(next)}`}
          className={`btn mt-4 w-full ${methods.demo ? "btn-outline" : "btn-primary"}`}
        >
          GitHub로 로그인
        </a>
      )}
    </section>
  );
}
