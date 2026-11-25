"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { HundredDays } from "@/components/HundredDays";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import { LoginCard } from "@/components/LoginCard";
import { RedFlagNotice } from "@/components/Notices";
import { isLocked, remaining, useAuth } from "@/lib/auth-client";
import { CATEGORY_LABEL, getExercise } from "@/lib/exercises";
import { addDays, daysSince, type Profile } from "@/lib/profile";
import {
  PHASES,
  allowedExercises,
  buildRoutine,
  getPhase,
  routineMinutes,
  sanitizePlan,
  type RoutineItem,
} from "@/lib/program";
import type { RedFlagId } from "@/lib/redflags";
import {
  KEYS,
  captureStore,
  clearPlan,
  savePlan,
  toggleDone,
  useLog,
  usePlan,
  useProfile,
  useToday,
  type Log,
  type StoredPlan,
} from "@/lib/store";

export default function TodayPage() {
  const profile = useProfile();
  const today = useToday();
  const log = useLog();
  const plan = usePlan();
  const router = useRouter();

  useEffect(() => {
    if (profile === null) router.replace("/");
  }, [profile, router]);

  if (!profile || !today || !log || plan === undefined) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
        <div className="skeleton h-40" />
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </main>
    );
  }

  return <Today profile={profile} today={today} log={log} plan={plan} />;
}

function Today({
  profile,
  today,
  log,
  plan,
}: {
  profile: Profile;
  today: string;
  log: Log;
  plan: StoredPlan | null;
}) {
  const days = daysSince(profile.birthDate, today);
  const phase = PHASES[getPhase(profile, today)];

  const baseRoutine = useMemo(
    () => buildRoutine(profile, today),
    [profile, today],
  );

  // AI가 조정한 루틴은 오늘 것이고, 지금도 전부 허용된 운동일 때만 쓴다.
  const adjusted = useMemo(() => {
    if (!plan || plan.date !== today || plan.items.length === 0) return null;
    const allowed = new Set(
      allowedExercises(profile, today).map((exercise) => exercise.id),
    );
    if (!plan.items.every((item) => allowed.has(item.id))) return null;
    const items = sanitizePlan(plan.items.map((item) => ({ ...item, reason: item.reason ?? "" })), allowed, profile.minutes);
    return items.length ? { ...plan, items } : null;
  }, [plan, profile, today]);

  const routine: RoutineItem[] = adjusted ? adjusted.items : baseRoutine;
  const done = new Set(log[today] ?? []);
  const doneCount = routine.filter((item) => done.has(item.id)).length;
  const allDone = routine.length > 0 && doneCount === routine.length;
  const nextItem = routine.find((item) => !done.has(item.id));
  const next = nextItem ? getExercise(nextItem.id) : undefined;

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 pb-8 pt-4">
      <section className="flex items-center gap-5">
        <div className="w-[10.5rem] flex-none">
          <HundredDays days={days} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted">산후</p>
          <h1 className="display text-[2rem] leading-tight text-primary">
            {Math.floor(days / 7)}주 {days % 7}일
          </h1>
          <p className="mt-1 text-sm text-muted">
            {days < 100
              ? `백일까지 ${99 - days}일 남았어요`
              : "백일을 지났어요"}
          </p>
        </div>
      </section>

      {profile.redFlags.length === 0 && (
        <section className="rounded-[var(--radius-panel)] bg-tint-soft px-5 py-4">
          <p className="text-sm font-medium text-primary">
            회복 {phase.phase}단계
          </p>
          <h2 className="display mt-1 text-xl">{phase.title}</h2>
          <p className="mt-1 text-[0.9375rem] text-muted">{phase.description}</p>
          {!profile.cleared && (
            <p className="mt-3 border-t border-line pt-3 text-[0.9375rem]">
              검진에서 운동 허가를 받으면{" "}
              <Link
                href="/onboarding"
                className="font-medium text-primary underline underline-offset-4"
              >
                내 상태를 고쳐
              </Link>{" "}
              다음 단계 운동을 열 수 있어요.
            </p>
          )}
        </section>
      )}

      {profile.redFlags.length > 0 ? (
        <>
          <RedFlagNotice ids={profile.redFlags} />
          <p className="text-[0.9375rem] text-muted">
            진료를 받고 증상이 가라앉으면{" "}
            <Link
              href="/onboarding"
              className="font-medium text-primary underline underline-offset-4"
            >
              내 상태를 고쳐
            </Link>{" "}
            루틴을 다시 받을 수 있어요.
          </p>
        </>
      ) : (
        <>
          <section aria-labelledby="routine-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="routine-title" className="display text-xl">
                  오늘의 루틴
                </h2>
                <p className="text-sm text-muted">
                  약 {routineMinutes(routine)}분
                  {adjusted ? ", 오늘 컨디션에 맞춰 조정했어요" : ""}
                </p>
              </div>
              <p
                className={`flex-none rounded-full px-3 py-1 text-sm font-medium tabular-nums ${
                  allDone
                    ? "bg-sage-soft text-sage-strong"
                    : "bg-tint-soft text-primary"
                }`}
                aria-live="polite"
              >
                {allDone ? "모두 완료" : `${doneCount}/${routine.length} 완료`}
              </p>
            </div>

            {adjusted?.note && (
              <p className="mt-4 rounded-[var(--radius-control)] bg-sage-soft px-4 py-3 text-[0.9375rem] text-sage-strong">
                {adjusted.note}
              </p>
            )}

            {allDone ? (
              <p className="mt-4 rounded-[var(--radius-control)] bg-sage-soft px-4 py-3 text-[0.9375rem] text-sage-strong">
                오늘 몫을 다 했어요. 물 한 잔 마시고 쉬어요.
              </p>
            ) : (
              next && (
                <Link
                  href={`/exercise/${next.id}`}
                  className="btn btn-primary mt-4 w-full"
                >
                  {doneCount === 0 ? "시작하기" : "이어서 하기"}: {next.name}
                </Link>
              )
            )}

            <ul className="mt-4 divide-y divide-line border-y border-line">
              {routine.map((item) => (
                <RoutineRow
                  key={item.id}
                  item={item}
                  done={done.has(item.id)}
                  onToggle={() => toggleDone(today, item.id)}
                />
              ))}
            </ul>

          </section>

          <Adjust profile={profile} today={today} adjusted={adjusted !== null} />
        </>
      )}

      <WeekStrip log={log} today={today} />
    </main>
  );
}

function RoutineRow({
  item,
  done,
  onToggle,
}: {
  item: RoutineItem;
  done: boolean;
  onToggle: () => void;
}) {
  const exercise = getExercise(item.id);
  if (!exercise) return null;

  return (
    <li className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`${exercise.name} 완료`}
        className="group grid size-12 flex-none cursor-pointer place-items-center rounded-full"
      >
        <span
          className={`grid size-8 place-items-center rounded-full border-[1.5px] transition-colors ${
            done
              ? "border-sage bg-sage text-on-primary"
              : "border-muted bg-surface text-transparent group-hover:border-sage group-hover:text-sage"
          }`}
        >
          <CheckIcon width={18} height={18} />
        </span>
      </button>
      <Link
        href={`/exercise/${exercise.id}`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 transition-colors hover:text-primary"
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block font-medium ${done ? "text-muted line-through decoration-1" : ""}`}
          >
            {exercise.name}
          </span>
          <span className="block text-sm text-muted">
            {CATEGORY_LABEL[exercise.category]}, {item.sets}세트 × {item.reps}
          </span>
          {item.reason && (
            <span className="mt-1 block text-sm text-sage-strong">
              {item.reason}
            </span>
          )}
        </span>
        <ChevronRightIcon className="flex-none text-muted" />
      </Link>
    </li>
  );
}

const FATIGUE = [
  { value: "low", label: "괜찮아요" },
  { value: "mid", label: "조금 피곤해요" },
  { value: "high", label: "많이 지쳤어요" },
] as const;

type Fatigue = (typeof FATIGUE)[number]["value"];

const PLAN_ERRORS: Record<string, string> = {
  no_api_key:
    "AI 코치가 아직 연결되지 않았어요. 기본 루틴은 그대로 쓸 수 있어요.",
  rate_limited: "요청이 많아요. 최대 5분 뒤에 다시 시도해 주세요.",
  ai_unavailable:
    "지금은 AI 조정을 쓸 수 없어 기본 루틴을 유지했어요. 잠시 뒤 다시 시도해 주세요.",
  login_required: "로그인이 풀렸어요. 아래에서 다시 로그인해 주세요.",
  quota_exceeded: "오늘 쓸 수 있는 루틴 조정 횟수를 모두 썼어요. 기본 루틴은 그대로 쓸 수 있고, 내일 다시 조정할 수 있어요.",
  capacity_reached: "오늘은 AI 이용이 많아 잠시 닫았어요. 기본 루틴은 그대로 쓸 수 있어요.",
  ai_disabled: "AI 조정이 지금은 열려 있지 않아요. 기본 루틴은 그대로 쓸 수 있어요.",
};

function Adjust({
  profile,
  today,
  adjusted,
}: {
  profile: Profile;
  today: string;
  adjusted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pain, setPain] = useState(0);
  const [fatigue, setFatigue] = useState<Fatigue>("mid");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flags, setFlags] = useState<RedFlagId[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { state: auth, refresh: refreshAuth } = useAuth();
  const locked = isLocked(auth);
  const left = remaining(auth, "plan");
  useEffect(() => () => { abortRef.current?.abort(); abortRef.current = null; }, []);

  const submit = async () => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const snapshot = captureStore(KEYS.profile, KEYS.plan);
    setLoading(true);
    setError("");
    setFlags([]);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70_000)]),
        headers: { "content-type": "application/json", "x-ongi-client": "web" },
        body: JSON.stringify({
          profile,
          today,
          condition: { pain, fatigue, note },
        }),
      });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted || abortRef.current !== controller) return;

      if (!response.ok || !data) {
        setError(
          PLAN_ERRORS[data?.code] ??
            "조정하지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      if (Array.isArray(data.redFlags) && data.redFlags.length > 0) {
        setFlags(data.redFlags);
        return;
      }
      if (data.source !== "ai") {
        setError(PLAN_ERRORS[data.code] ?? PLAN_ERRORS.ai_unavailable);
        return;
      }
      if (!savePlan(today, data.items, data.note ?? "", snapshot)) {
        setError("정보가 바뀌었거나 저장하지 못했어요. 현재 정보를 확인하고 다시 조정해 주세요.");
        return;
      }
      setOpen(false);
      setNote("");
      refreshAuth();
    } catch {
      if (!controller.signal.aborted) setError("연결이 끊겼거나 시간이 초과됐어요. 다시 시도해 주세요.");
    } finally {
      if (abortRef.current === controller) { abortRef.current = null; setLoading(false); }
    }
  };

  if (!open) {
    return (
      <section className="space-y-3">
        <button
          type="button"
          className="btn btn-quiet w-full"
          onClick={() => setOpen(true)}
        >
          오늘 컨디션에 맞게 조정
        </button>
        {adjusted && (
          <button
            type="button"
            className="btn btn-outline w-full"
            onClick={clearPlan}
          >
            기본 루틴으로 되돌리기
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="adjust-title"
      className="rounded-[var(--radius-panel)] border border-line bg-surface p-5"
    >
      <h2 id="adjust-title" className="display text-xl">
        오늘 몸은 어때요?
      </h2>

      <p className="mt-2 text-sm text-muted">컨디션과 회복 정보가 AI 제공자에게 전달돼요. 조정 중에도 취소할 수 있어요.{left !== null ? ` 오늘 ${left}회 더 조정할 수 있어요.` : ""}</p>
      {locked && (
        <div className="mt-5 space-y-3">
          <LoginCard state={auth} next="/today" what="AI 루틴 조정" onLoggedIn={refreshAuth} />
          <button type="button" className="btn btn-outline w-full" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      )}
      <form
        hidden={locked}
        aria-busy={loading}
        className="mt-5 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="pain" className="font-medium">
              통증
            </label>
            <output htmlFor="pain" className="tabular-nums text-muted">
              {pain === 0 ? "없음" : `${pain} / 10`}
            </output>
          </div>
          <input
            id="pain"
            type="range"
            min={0}
            max={10}
            step={1}
            value={pain}
            onChange={(event) => setPain(Number(event.target.value))}
            className="mt-3 h-11 w-full cursor-pointer accent-primary"
          />
        </div>

        <fieldset>
          <legend className="font-medium">피로</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {FATIGUE.map((option) => (
              <label
                key={option.value}
                className="option min-h-12 justify-center px-2 text-center text-[0.9375rem]"
              >
                <input
                  type="radio"
                  name="fatigue"
                  className="sr-only"
                  checked={fatigue === option.value}
                  onChange={() => setFatigue(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="note" className="font-medium">
            더 알려 줄 것 <span className="font-normal text-muted">(선택)</span>
          </label>
          <textarea
            id="note"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="예: 밤새 수유해서 허리가 뻐근해요"
            className="field mt-2 resize-none"
          />
        </div>

        {flags.length > 0 && <RedFlagNotice ids={flags} />}
        {error && (
          <p role="alert" className="text-[0.9375rem] font-medium text-danger">
            {error}
          </p>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-3">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              abortRef.current?.abort();
              abortRef.current = null;
              setLoading(false);
              setOpen(false);
            }}
          >
            {loading ? "취소" : "닫기"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "루틴을 맞추는 중…" : "루틴 조정하기"}
          </button>
        </div>
      </form>
    </section>
  );
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function WeekStrip({ log, today }: { log: Log; today: string }) {
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  const activeDays = week.filter((date) => (log[date]?.length ?? 0) > 0).length;

  return (
    <section aria-labelledby="week-title">
      <h2 id="week-title" className="display text-xl">
        지난 7일
      </h2>
      <p className="text-sm text-muted">
        {activeDays === 0
          ? "운동을 마치고 체크하면 여기에 기록이 쌓여요."
          : `7일 중 ${activeDays}일 움직였어요.`}
      </p>
      <ol className="mt-4 grid grid-cols-7 gap-2">
        {week.map((date) => {
          const count = log[date]?.length ?? 0;
          const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
          return (
            <li key={date} className="flex flex-col items-center gap-2">
              <span
                className={`grid aspect-square w-full max-w-10 place-items-center rounded-full text-sm tabular-nums ${
                  count > 0
                    ? "bg-sage text-on-primary"
                    : "bg-dot text-transparent"
                } ${date === today ? "outline-2 outline-offset-2 outline-primary" : ""}`}
                aria-label={`${date}, ${count > 0 ? `${count}개 완료` : "기록 없음"}`}
              >
                {count > 0 ? count : "0"}
              </span>
              <span
                className={`text-xs ${date === today ? "font-semibold text-primary" : "text-muted"}`}
                aria-hidden="true"
              >
                {weekday}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
