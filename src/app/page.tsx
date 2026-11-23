"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HundredDays } from "@/components/HundredDays";
import { Disclaimer } from "@/components/Notices";
import { useProfile } from "@/lib/store";
import { APP_NAME } from "@/lib/theme";

export default function HomePage() {
  const profile = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (profile) router.replace("/today");
  }, [profile, router]);

  if (profile !== null) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-64" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-6 pt-6">
      <p className="display text-xl text-primary">{APP_NAME}</p>

      <h1 className="display mt-6 text-[1.75rem] text-ink">
        백일 동안,
        <br />
        내 몸이 돌아오는 속도에 맞춰요
      </h1>
      <p className="mt-4 text-muted">
        분만 방식과 지금 몸 상태를 알려 주시면 오늘 해도 되는 운동만 골라
        드려요. 궁금한 건 코치에게 바로 물어볼 수 있어요.
      </p>

      <div className="mx-auto my-6 w-full max-w-[12rem]" aria-hidden="true">
        <HundredDays days={33} />
      </div>

      <div className="mt-auto space-y-4">
        <Link href="/onboarding" className="btn btn-primary w-full">
          내 회복 단계 알아보기
        </Link>
        <p className="text-center text-sm text-muted">
          질문 5개, 1분이면 끝나요. 가입은 필요 없어요.
        </p>
        <Disclaimer />
      </div>
    </main>
  );
}
