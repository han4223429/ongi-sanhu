"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Disclaimer } from "@/components/Notices";
import { DELIVERY_LABEL, SYMPTOMS, daysSince } from "@/lib/profile";
import { PHASES, getPhase } from "@/lib/program";
import { clearAll, useProfile, useToday } from "@/lib/store";

export default function MePage() {
  const profile = useProfile();
  const today = useToday();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile === null) router.replace("/");
  }, [profile, router]);

  if (!profile || !today) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
        <div className="skeleton h-10 w-32" />
        <div className="skeleton h-56" />
      </main>
    );
  }

  const days = daysSince(profile.birthDate, today);
  const phase = PHASES[getPhase(profile, today)];
  const symptoms = SYMPTOMS.filter((item) => profile.symptoms.includes(item.id));

  const rows: [string, string][] = [
    ["출산일", profile.birthDate.replaceAll("-", ". ")],
    ["산후", `${Math.floor(days / 7)}주 ${days % 7}일`],
    ["분만 방식", DELIVERY_LABEL[profile.delivery]],
    ["운동 허가", profile.cleared ? "받았어요" : "아직이에요"],
    [
      "불편한 곳",
      symptoms.length > 0
        ? symptoms.map((item) => item.label).join(", ")
        : "없어요",
    ],
    ["하루 운동 시간", `${profile.minutes}분`],
    ["회복 단계", `${phase.phase}단계 ${phase.title}`],
  ];

  return (
    <main className="flex flex-1 flex-col gap-10 px-6 pb-8 pt-4">
      <section>
        <h1 className="display text-[1.75rem]">내 정보</h1>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {rows.map(([term, value]) => (
            <div key={term} className="flex gap-4 py-3">
              <dt className="w-28 flex-none text-muted">{term}</dt>
              <dd className="min-w-0 flex-1 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <Link href="/onboarding" className="btn btn-quiet mt-4 w-full">
          내 상태 고치기
        </Link>
      </section>

      <section>
        <h2 className="display text-xl">내 기록은 이 기기에만 있어요</h2>
        <p className="mt-2 text-[0.9375rem] text-muted">
          출산 정보와 운동 기록은 이 휴대폰의 브라우저에만 저장돼요. 코치에게
          질문하거나 루틴을 조정할 때만 분만 방식, 산후 주차, 증상이 AI에
          전달되고, 이름이나 연락처는 묻지 않아요.
        </p>
        <Disclaimer className="mt-4" />
      </section>

      <section>
        <h2 className="display text-xl">처음부터 다시 시작</h2>
        <p className="mt-2 text-[0.9375rem] text-muted">
          내 정보, 운동 기록, 코치와 나눈 대화를 이 기기에서 지워요. 되돌릴 수
          없어요.
        </p>
        {error && <p role="alert" className="mt-4 text-danger">{error}</p>}
        {confirming ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirming(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (clearAll()) router.replace("/");
                else setError("일부 기록을 지우지 못했어요. 브라우저 저장소 권한을 확인한 뒤 다시 시도해 주세요.");
              }}
            >
              모두 지우기
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline mt-4 w-full"
            onClick={() => setConfirming(true)}
          >
            기록 지우기
          </button>
        )}
      </section>
    </main>
  );
}
