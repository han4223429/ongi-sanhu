"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDays, toDateKey } from "@/lib/profile";
import { clearPlan, saveProfile, useProfile } from "@/lib/store";
import { APP_NAME, APP_TAGLINE } from "@/lib/theme";

/**
 * 넓은 화면(컴퓨터)에서 폰 모양 틀 옆에 보이는 소개 패널.
 * 처음 쓰는 사람이 설문 5단계를 건너뛰고 둘러볼 수 있게 예시 프로필 시작 버튼을 둔다.
 * 이미 내 정보가 저장돼 있으면 그 정보를 덮어쓰지 않도록 버튼을 보이지 않는다.
 */
export function DesktopIntro() {
  const profile = useProfile();
  const router = useRouter();
  const [error, setError] = useState("");

  const startDemo = () => {
    const saved = saveProfile({
      birthDate: addDays(toDateKey(new Date()), -51),
      delivery: "cesarean",
      cleared: true,
      symptoms: ["back_pain"],
      redFlags: [],
      minutes: 20,
    });
    if (!saved) {
      setError("이 브라우저에 저장하지 못했어요. 저장 공간 권한을 확인해 주세요.");
      return;
    }
    clearPlan();
    router.push("/today");
  };

  return (
    <aside className="hidden max-w-xs lg:block">
      <p className="display text-2xl text-primary">{APP_NAME}</p>
      <h2 className="display mt-4 text-[2rem] text-ink">{APP_TAGLINE}</h2>
      <p className="mt-4 text-muted">
        분만 방식과 산후 주차, 불편한 곳을 바탕으로 오늘 해도 되는 운동만 골라
        보여 주고, 궁금한 건 AI 코치가 바로 답해요.
      </p>

      {profile === null && (
        <div className="mt-8">
          <button type="button" onClick={startDemo} className="btn btn-primary w-full">
            예시 프로필로 바로 둘러보기
          </button>
          <p className="mt-3 text-sm text-muted">
            산후 7주, 제왕절개, 허리 통증이 있는 예시예요. 설문은 건너뛰고, 내 정보
            화면의 &lsquo;기록 지우기&rsquo;로 언제든 지울 수 있어요.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      <p className="mt-8 text-sm text-muted">
        휴대폰에서도 열려요. 홈 화면에 추가하면 앱처럼 쓸 수 있어요.
      </p>
    </aside>
  );
}
