"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="display text-[1.75rem]">화면을 불러오지 못했어요</h1>
      <p className="text-muted">
        잠시 문제가 생겼어요. 내 기록은 이 휴대폰에 그대로 있어요. 다시
        시도해도 안 되면 오늘의 루틴으로 돌아가 주세요.
      </p>
      <div className="mt-4 grid gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          다시 시도
        </button>
        <Link href="/today" className="btn btn-outline">
          오늘의 루틴으로 가기
        </Link>
      </div>
    </main>
  );
}
