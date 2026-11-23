"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { Disclaimer } from "@/components/Notices";
import {
  DELIVERY_LABEL,
  MINUTE_OPTIONS,
  SYMPTOMS,
  type Profile,
  type SymptomId,
} from "@/lib/profile";
import { RED_FLAGS, type RedFlagId } from "@/lib/redflags";
import { clearPlan, saveProfile, useProfile, useToday } from "@/lib/store";

const STEP_COUNT = 5;

type Draft = {
  birthDate: string;
  delivery: Profile["delivery"] | null;
  cleared: boolean | null;
  symptoms: SymptomId[];
  redFlags: RedFlagId[];
  minutes: Profile["minutes"];
};

function toDraft(profile: Profile | null): Draft {
  return {
    birthDate: profile?.birthDate ?? "",
    delivery: profile?.delivery ?? null,
    cleared: profile?.cleared ?? null,
    symptoms: profile?.symptoms ?? [],
    redFlags: profile?.redFlags ?? [],
    minutes: profile?.minutes ?? 20,
  };
}

export default function OnboardingPage() {
  const profile = useProfile();
  const today = useToday();

  if (profile === undefined || today === undefined) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
        <div className="skeleton h-2" />
        <div className="skeleton mt-6 h-10 w-3/4" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </main>
    );
  }

  return <Survey initial={profile} today={today} />;
}

function Survey({ initial, today }: { initial: Profile | null; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState("");

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  };

  const toggle = <K extends "symptoms" | "redFlags">(
    key: K,
    id: Draft[K][number],
  ) => {
    const list = draft[key] as string[];
    const next = list.includes(id)
      ? list.filter((item) => item !== id)
      : [...list, id];
    update({ [key]: next } as Partial<Draft>);
  };

  const validate = (): string => {
    if (step === 0) {
      if (!draft.birthDate) return "출산일을 선택해 주세요.";
      if (draft.birthDate > today) return "출산일은 오늘 이전이어야 해요.";
      if (!draft.delivery) return "분만 방식을 선택해 주세요.";
    }
    if (step === 1 && draft.cleared === null) {
      return "둘 중 하나를 선택해 주세요.";
    }
    return "";
  };

  const next = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      document.getElementById("app-scroll")?.scrollTo({ top: 0 });
      return;
    }
    if (!draft.delivery || draft.cleared === null) return;

    const saved = saveProfile({
      birthDate: draft.birthDate,
      delivery: draft.delivery,
      cleared: draft.cleared,
      symptoms: draft.symptoms,
      redFlags: draft.redFlags,
      minutes: draft.minutes,
    });
    if (!saved) {
      setError(
        "이 기기에 저장할 수 없어요. 사생활 보호 모드를 끄고 다시 시도해 주세요.",
      );
      return;
    }
    clearPlan();
    router.push("/today");
  };

  const back = () => {
    setError("");
    if (step === 0) router.back();
    else setStep(step - 1);
  };

  return (
    <main className="flex flex-1 flex-col px-6 pb-6 pt-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          aria-label="이전"
          className="-ml-3 grid size-11 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-tint-soft hover:text-ink"
        >
          <ChevronLeftIcon />
        </button>
        <div
          role="progressbar"
          aria-label="설문 진행"
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step + 1}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint-soft"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
          />
        </div>
        <span className="w-8 text-right text-sm tabular-nums text-muted">
          {step + 1}/{STEP_COUNT}
        </span>
      </header>

      <form
        className="mt-8 flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
        noValidate
      >
        {step === 0 && (
          <fieldset className="space-y-6">
            <legend className="display text-[1.75rem]">
              아기를 언제, 어떻게 만나셨나요?
            </legend>

            <div>
              <label htmlFor="birthDate" className="mb-2 block font-medium">
                출산일
              </label>
              <p className="-mt-1 mb-2 text-sm text-muted">
                아래 칸을 누르면 달력이 열려요.
              </p>
              <input
                id="birthDate"
                type="date"
                className="field"
                max={today}
                value={draft.birthDate}
                onChange={(event) => update({ birthDate: event.target.value })}
              />
            </div>

            <div role="radiogroup" aria-labelledby="delivery-label">
              <p id="delivery-label" className="mb-2 font-medium">
                분만 방식
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["vaginal", "cesarean"] as const).map((value) => (
                  <label key={value} className="option justify-center">
                    <input
                      type="radio"
                      name="delivery"
                      className="sr-only"
                      checked={draft.delivery === value}
                      onChange={() => update({ delivery: value })}
                    />
                    <span className="font-medium">{DELIVERY_LABEL[value]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">
                제왕절개는 수술 부위가 아무는 시간을 더 두고 단계를 올려요.
              </p>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset className="space-y-6">
            <legend className="display text-[1.75rem]">
              검진에서 운동해도 된다는 말을 들으셨나요?
            </legend>
            <p className="text-muted">
              보통 출산 6주 전후 검진에서 확인해요. 아직이라면 호흡과
              골반저근, 가벼운 걷기만 권해 드려요.
            </p>
            <div className="space-y-3">
              {[
                { value: true, label: "네, 들었어요" },
                { value: false, label: "아직 못 들었어요" },
              ].map((item) => (
                <label key={item.label} className="option">
                  <input
                    type="radio"
                    name="cleared"
                    className="sr-only"
                    checked={draft.cleared === item.value}
                    onChange={() => update({ cleared: item.value })}
                  />
                  <span className="option-mark rounded-full">
                    <CheckIcon width={14} height={14} />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="space-y-6">
            <legend className="display text-[1.75rem]">
              요즘 불편한 곳이 있나요?
            </legend>
            <p className="text-muted">
              해당하는 것을 모두 골라 주세요. 없으면 그대로 넘어가도 돼요.
            </p>
            <div className="space-y-3">
              {SYMPTOMS.map((symptom) => (
                <label key={symptom.id} className="option">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={draft.symptoms.includes(symptom.id)}
                    onChange={() => toggle("symptoms", symptom.id)}
                  />
                  <span className="option-mark rounded-md">
                    <CheckIcon width={14} height={14} />
                  </span>
                  <span>
                    <span className="block font-medium">{symptom.label}</span>
                    <span className="block text-sm text-muted">
                      {symptom.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className="space-y-6">
            <legend className="display text-[1.75rem]">
              지금 이런 증상이 있나요?
            </legend>
            <p className="text-muted">
              하나라도 있으면 운동보다 진료가 먼저예요. 없으면 그대로 넘어가
              주세요.
            </p>
            <div className="space-y-3">
              {RED_FLAGS.map((flag) => (
                <label key={flag.id} className="option">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={draft.redFlags.includes(flag.id)}
                    onChange={() => toggle("redFlags", flag.id)}
                  />
                  <span className="option-mark rounded-md">
                    <CheckIcon width={14} height={14} />
                  </span>
                  <span>{flag.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset className="space-y-6">
            <legend className="display text-[1.75rem]">
              하루에 얼마나 쓸 수 있나요?
            </legend>
            <p className="text-muted">
              아기가 자는 틈에 할 수 있는 만큼이면 충분해요. 나중에 바꿀 수
              있어요.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {MINUTE_OPTIONS.map((minutes) => (
                <label key={minutes} className="option justify-center">
                  <input
                    type="radio"
                    name="minutes"
                    className="sr-only"
                    checked={draft.minutes === minutes}
                    onChange={() => update({ minutes })}
                  />
                  <span className="font-medium">{minutes}분</span>
                </label>
              ))}
            </div>
            <Disclaimer />
          </fieldset>
        )}

        <div className="sticky bottom-0 mt-auto bg-bg pb-[env(safe-area-inset-bottom)] pt-6">
          <p
            role="alert"
            className={`mb-3 text-sm font-medium text-danger ${error ? "" : "hidden"}`}
          >
            {error}
          </p>
          <button type="submit" className="btn btn-primary w-full">
            {step < STEP_COUNT - 1 ? "다음" : "오늘의 루틴 보기"}
          </button>
        </div>
      </form>
    </main>
  );
}
