import {
  CATEGORY_ORDER,
  EXERCISES,
  getExercise,
  type Exercise,
  type Phase,
} from "./exercises";
import { daysSince, type Profile } from "./profile";

/**
 * 규칙 엔진: 프로필 → 회복 단계 → 허용 운동 → 기본 루틴.
 * AI 없이도 항상 루틴을 만들 수 있고, AI가 고를 수 있는 범위도 여기서 정한다.
 */

export interface PhaseInfo {
  phase: Phase;
  title: string;
  description: string;
}

export const PHASES: Record<Phase, PhaseInfo> = {
  0: {
    phase: 0,
    title: "몸 쉬어가기",
    description: "호흡과 골반저근, 가벼운 걷기로 회복을 준비하는 시기예요.",
  },
  1: {
    phase: 1,
    title: "깊은 코어 깨우기",
    description: "누운 자세에서 아랫배와 골반 주변을 다시 쓰기 시작해요.",
  },
  2: {
    phase: 2,
    title: "버티는 힘 기르기",
    description: "엉덩이와 하체 근력을 더해 아기를 안는 몸을 받쳐요.",
  },
  3: {
    phase: 3,
    title: "일상 체력 되찾기",
    description: "전신 근력과 유산소로 출산 전 활동으로 돌아가요.",
  },
};

/** 3단계로 넘어가기 전에 먼저 가라앉혀야 하는 증상 */
const HOLD_AT_PHASE_2 = ["diastasis", "incontinence", "pelvic_pain"] as const;

export function weeksSince(birthDate: string, today: string): number {
  return Math.floor(daysSince(birthDate, today) / 7);
}

export function getPhase(profile: Profile, today: string): Phase {
  if (!profile.cleared) return 0;

  const weeks = weeksSince(profile.birthDate, today);
  const cesarean = profile.delivery === "cesarean";

  if (weeks < (cesarean ? 6 : 2)) return 0;
  if (weeks < (cesarean ? 8 : 6)) return 1;
  if (weeks < 12) return 2;

  const held = HOLD_AT_PHASE_2.some((symptom) =>
    profile.symptoms.includes(symptom),
  );
  return held ? 2 : 3;
}

/** 지금 이 사람에게 안전하게 권할 수 있는 운동 전체 */
export function allowedExercises(profile: Profile, today: string): Exercise[] {
  if (profile.redFlags.length > 0) return [];

  const phase = getPhase(profile, today);
  const weeks = weeksSince(profile.birthDate, today);

  return EXERCISES.filter((exercise) => {
    if (exercise.phase > phase) return false;
    if (exercise.excludeSymptoms.some((s) => profile.symptoms.includes(s))) {
      return false;
    }
    if (
      profile.delivery === "cesarean" &&
      exercise.cesareanMinWeeks !== undefined &&
      weeks < exercise.cesareanMinWeeks
    ) {
      return false;
    }
    return true;
  });
}

export interface RoutineItem {
  id: string;
  sets: number;
  reps: string;
  /** 이 운동을 넣은 이유 (AI 조정 시에만) */
  reason?: string;
}

function orderIndex(exercise: Exercise): number {
  return CATEGORY_ORDER.indexOf(exercise.category);
}

function sortForSession(items: Exercise[]): Exercise[] {
  return [...items].sort(
    (a, b) => orderIndex(a) - orderIndex(b) || a.phase - b.phase,
  );
}

/** 규칙만으로 만드는 오늘의 기본 루틴 */
export function buildRoutine(profile: Profile, today: string): RoutineItem[] {
  const allowed = allowedExercises(profile, today);
  if (allowed.length === 0) return [];

  const phase = getPhase(profile, today);
  const picked: Exercise[] = [];
  let used = 0;

  const take = (exercise: Exercise, force = false) => {
    if (picked.includes(exercise)) return;
    if (!force && used + exercise.minutes > profile.minutes) return;
    picked.push(exercise);
    used += exercise.minutes;
  };

  // 1) 호흡과 골반저근은 모든 단계의 바탕이라 항상 넣는다.
  for (const id of ["diaphragm-breathing", "pelvic-floor-contraction"]) {
    const exercise = allowed.find((item) => item.id === id);
    if (exercise) take(exercise, true);
  }

  // 2) 겪고 있는 증상에 도움이 되는 운동을 먼저, 높은 단계부터.
  const helpful = allowed
    .filter((exercise) =>
      exercise.helps.some((s) => profile.symptoms.includes(s)),
    )
    .sort((a, b) => b.phase - a.phase);
  for (const exercise of helpful) take(exercise);

  // 3) 현재 단계의 운동, 그다음 아래 단계 순으로 시간을 채운다.
  //    같은 단계 안에서는 종류가 겹치지 않는 운동을 먼저 고른다.
  for (let p = phase; p >= 0; p -= 1) {
    const candidates = allowed
      .filter((exercise) => exercise.phase === p)
      .sort((a, b) => {
        const aDup = picked.some((x) => x.category === a.category) ? 1 : 0;
        const bDup = picked.some((x) => x.category === b.category) ? 1 : 0;
        return aDup - bDup || orderIndex(a) - orderIndex(b);
      });
    for (const exercise of candidates) take(exercise);
  }

  return sortForSession(picked).map((exercise) => ({
    id: exercise.id,
    sets: exercise.sets,
    reps: exercise.reps,
  }));
}

export interface RawPlanItem {
  id: string;
  sets: number;
  reps: string;
  reason: string;
}

const MAX_PLAN_ITEMS = 8;

/**
 * AI가 돌려준 루틴을 검증한다.
 * 허용 목록 밖의 운동은 버리고, 세트 수·문자열 길이·총 시간을 제한한다.
 */
export function sanitizePlan(
  raw: RawPlanItem[],
  allowedIds: ReadonlySet<string>,
  limitMinutes?: number,
): RoutineItem[] {
  const seen = new Set<string>();
  let used = 0;
  const kept: { exercise: Exercise; item: RoutineItem }[] = [];

  for (const entry of raw) {
    if (kept.length >= MAX_PLAN_ITEMS) break;
    if (!allowedIds.has(entry.id) || seen.has(entry.id)) continue;
    const exercise = getExercise(entry.id);
    if (!exercise) continue;
    // AI가 먼저 적은 운동(우선순위가 높은 것)부터 담고, 한도를 넘는 운동은 건너뛴다.
    if (limitMinutes !== undefined && used + exercise.minutes > limitMinutes) {
      continue;
    }
    seen.add(entry.id);
    used += exercise.minutes;

    const sets = Number.isFinite(entry.sets)
      ? Math.min(exercise.sets, Math.max(1, Math.round(entry.sets)))
      : exercise.sets;
    // Free-form repetitions can encode unsafe doses or prompt-injected instructions.
    // AI may select exercises/reduce sets, but cannot invent a prescription.
    const reps = exercise.reps;
    const reason = entry.reason.trim().slice(0, 200);

    kept.push({
      exercise,
      item: { id: exercise.id, sets, reps, ...(reason ? { reason } : {}) },
    });
  }

  return kept
    .sort(
      (a, b) =>
        orderIndex(a.exercise) - orderIndex(b.exercise) ||
        a.exercise.phase - b.exercise.phase,
    )
    .map((entry) => entry.item);
}

export function routineMinutes(items: RoutineItem[]): number {
  return items.reduce(
    (sum, item) => sum + (getExercise(item.id)?.minutes ?? 0),
    0,
  );
}
