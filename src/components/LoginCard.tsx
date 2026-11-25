import type { AuthState } from "@/lib/auth-client";

/** AI를 쓰려면 로그인이 필요하다는 안내. 로그인이 없어도 쓸 수 있는 것은 함께 알려 준다. */
export function LoginCard({
  state,
  next,
  what,
}: {
  state: AuthState;
  next: string;
  what: string;
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

  return (
    <section className="rounded-[var(--radius-control)] border border-line bg-surface p-4">
      <h2 className="font-semibold">로그인하면 {what}을 쓸 수 있어요</h2>
      <p className="mt-2 text-[0.9375rem] text-muted">
        GitHub 계정으로 로그인해요. 이메일은 받지 않고, 출산 정보와 운동 기록은
        로그인과 상관없이 이 기기에만 저장돼요. 하루에 코치 20회, 루틴 조정
        5회까지 쓸 수 있어요.
      </p>
      <p className="mt-2 text-sm text-muted">
        자세한 내용은{" "}
        <a href="/privacy" className="underline underline-offset-4">
          개인정보 처리방침
        </a>
        에 있어요.
      </p>
      <a
        href={`/api/auth/login?next=${encodeURIComponent(next)}`}
        className="btn btn-primary mt-4 w-full"
      >
        GitHub로 로그인
      </a>
    </section>
  );
}
