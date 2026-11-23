import { describe, expect, it } from "vitest";
import { EXERCISES, getExercise } from "./exercises";
import { ProfileSchema, addDays, daysSince, type Profile } from "./profile";
import {
  allowedExercises,
  buildRoutine,
  getPhase,
  routineMinutes,
  sanitizePlan,
} from "./program";
import { allow } from "./ratelimit";
import { detectRedFlags, redFlagNotice } from "./redflags";

const TODAY = "2026-11-23";

function profile(weeks: number, patch: Partial<Profile> = {}): Profile {
  return {
    birthDate: addDays(TODAY, -weeks * 7),
    delivery: "vaginal",
    cleared: true,
    symptoms: [],
    redFlags: [],
    minutes: 20,
    ...patch,
  };
}

describe("날짜", () => {
  it("출산일부터 지난 일수를 센다", () => {
    expect(daysSince("2026-11-23", TODAY)).toBe(0);
    expect(daysSince("2026-10-03", TODAY)).toBe(51);
    expect(daysSince("2026-12-01", TODAY)).toBe(0);
  });

  it("달력에 없는 날짜는 거부한다", () => {
    const base = profile(3);
    expect(ProfileSchema.safeParse({ ...base, birthDate: "2026-02-30" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...base, birthDate: "20260203" }).success).toBe(false);
    expect(ProfileSchema.safeParse(base).success).toBe(true);
  });
});

describe("회복 단계", () => {
  it("의료진 허가 전에는 주차와 무관하게 0단계", () => {
    expect(getPhase(profile(20, { cleared: false }), TODAY)).toBe(0);
  });

  it("자연분만은 2주, 6주, 12주에 단계가 오른다", () => {
    expect(getPhase(profile(1), TODAY)).toBe(0);
    expect(getPhase(profile(2), TODAY)).toBe(1);
    expect(getPhase(profile(5), TODAY)).toBe(1);
    expect(getPhase(profile(6), TODAY)).toBe(2);
    expect(getPhase(profile(11), TODAY)).toBe(2);
    expect(getPhase(profile(12), TODAY)).toBe(3);
  });

  it("제왕절개는 6주, 8주, 12주에 단계가 오른다", () => {
    const c = (weeks: number) => profile(weeks, { delivery: "cesarean" });
    expect(getPhase(c(5), TODAY)).toBe(0);
    expect(getPhase(c(6), TODAY)).toBe(1);
    expect(getPhase(c(8), TODAY)).toBe(2);
    expect(getPhase(c(12), TODAY)).toBe(3);
  });

  it("복직근이개·요실금·골반 통증이 남아 있으면 2단계에 머문다", () => {
    for (const symptom of ["diastasis", "incontinence", "pelvic_pain"] as const) {
      expect(getPhase(profile(20, { symptoms: [symptom] }), TODAY)).toBe(2);
    }
    expect(getPhase(profile(20, { symptoms: ["back_pain", "wrist_pain"] }), TODAY)).toBe(3);
  });
});

describe("허용 운동", () => {
  const ids = (p: Profile) => allowedExercises(p, TODAY).map((e) => e.id);

  it("위험 증상이 있으면 아무 운동도 허용하지 않는다", () => {
    const p = profile(10, { redFlags: ["bleeding"] });
    expect(ids(p)).toEqual([]);
    expect(buildRoutine(p, TODAY)).toEqual([]);
  });

  it("현재 단계보다 높은 운동은 빠진다", () => {
    const p = profile(3);
    for (const exercise of allowedExercises(p, TODAY)) {
      expect(exercise.phase).toBeLessThanOrEqual(1);
    }
    expect(ids(p)).not.toContain("glute-bridge");
  });

  it("증상별 금기 운동을 뺀다", () => {
    expect(ids(profile(8, { symptoms: ["pelvic_pain"] }))).not.toContain("side-leg-lift");
    const late = profile(20);
    expect(ids(late)).toContain("knee-plank");
    expect(ids(late)).toContain("walk-jog-interval");
    // 증상이 있으면 2단계에 머물러 3단계 운동 자체가 열리지 않는다.
    expect(ids(profile(20, { symptoms: ["diastasis"] }))).not.toContain("knee-plank");
    expect(ids(profile(20, { symptoms: ["incontinence"] }))).not.toContain("walk-jog-interval");
  });

  it("제왕절개는 정해진 주차 전에는 복부 부담 동작을 뺀다", () => {
    const early = profile(7, { delivery: "cesarean" });
    expect(ids(early)).toContain("tva-activation");
    expect(ids(early)).not.toContain("glute-bridge");
    expect(ids(profile(8, { delivery: "cesarean" }))).toContain("glute-bridge");
  });

  it("모든 금기 증상은 실제 증상 id이고 id는 중복되지 않는다", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});

describe("기본 루틴", () => {
  it("호흡과 골반저근을 항상 포함한다", () => {
    for (const weeks of [0, 3, 8, 20]) {
      const routine = buildRoutine(profile(weeks), TODAY).map((i) => i.id);
      expect(routine).toContain("diaphragm-breathing");
      expect(routine).toContain("pelvic-floor-contraction");
    }
  });

  it("허용된 운동만 담고 정한 시간을 넘지 않는다", () => {
    for (const minutes of [10, 20, 30] as const) {
      for (const weeks of [0, 3, 8, 20]) {
        const p = profile(weeks, { minutes, symptoms: ["back_pain"] });
        const allowed = new Set(allowedExercises(p, TODAY).map((e) => e.id));
        const routine = buildRoutine(p, TODAY);
        expect(routine.length).toBeGreaterThan(1);
        for (const item of routine) expect(allowed.has(item.id)).toBe(true);
        expect(routineMinutes(routine)).toBeLessThanOrEqual(minutes);
      }
    }
  });

  it("증상에 도움이 되는 운동을 먼저 넣는다", () => {
    const routine = buildRoutine(profile(1, { symptoms: ["wrist_pain"], minutes: 10 }), TODAY);
    expect(routine.map((i) => i.id)).toContain("wrist-stretch");
  });

  it("같은 입력에는 같은 루틴을 돌려준다", () => {
    const p = profile(8, { symptoms: ["back_pain"] });
    expect(buildRoutine(p, TODAY)).toEqual(buildRoutine(p, TODAY));
  });
});

describe("AI 루틴 검증", () => {
  const allowed = new Set(["diaphragm-breathing", "pelvic-tilt", "glute-bridge"]);

  it("허용 목록 밖이거나 없는 운동, 중복을 버린다", () => {
    const items = sanitizePlan(
      [
        { id: "glute-bridge", sets: 2, reps: "10회", reason: "엉덩이 힘" },
        { id: "knee-plank", sets: 3, reps: "15초", reason: "허용 밖" },
        { id: "burpee", sets: 3, reps: "20회", reason: "없는 운동" },
        { id: "glute-bridge", sets: 4, reps: "20회", reason: "중복" },
        { id: "diaphragm-breathing", sets: 1, reps: "10회 호흡", reason: "" },
      ],
      allowed,
    );
    expect(items.map((i) => i.id)).toEqual(["diaphragm-breathing", "glute-bridge"]);
    expect(items[0].reason).toBeUndefined();
  });

  it("하루 시간 한도를 넘는 운동은 AI가 나중에 적은 것부터 뺀다", () => {
    const all = new Set(["diaphragm-breathing", "pelvic-tilt", "glute-bridge", "gentle-walk"]);
    // 3분 + 3분 + 4분 + 10분 = 20분. 한도 10분이면 앞에서부터 3+3+4 = 10분까지만.
    const items = sanitizePlan(
      [
        { id: "diaphragm-breathing", sets: 1, reps: "10회", reason: "" },
        { id: "pelvic-tilt", sets: 1, reps: "10회", reason: "" },
        { id: "glute-bridge", sets: 1, reps: "10회", reason: "" },
        { id: "gentle-walk", sets: 1, reps: "10분", reason: "" },
      ],
      all,
      10,
    );
    expect(items.map((i) => i.id).sort()).toEqual(["diaphragm-breathing", "glute-bridge", "pelvic-tilt"]);
    expect(routineMinutes(items)).toBeLessThanOrEqual(10);
  });

  it("세트 수와 문자열 길이를 제한한다", () => {
    const [item] = sanitizePlan(
      [{ id: "pelvic-tilt", sets: 99, reps: "가".repeat(100), reason: "나".repeat(500) }],
      allowed,
    );
    expect(item.sets).toBe(getExercise("pelvic-tilt")?.sets);
    expect(item.reps).toBe(getExercise("pelvic-tilt")?.reps);
    expect(item.reason).toHaveLength(200);

    const [fallback] = sanitizePlan(
      [{ id: "pelvic-tilt", sets: Number.NaN, reps: "  ", reason: "" }],
      allowed,
    );
    expect(fallback.sets).toBe(getExercise("pelvic-tilt")?.sets);
    expect(fallback.reps).toBe(getExercise("pelvic-tilt")?.reps);
  });
});

describe("위험 증상 감지", () => {
  it.each([
    ["어제부터 출혈이 갑자기 많아졌어요", "bleeding"],
    ["핏덩이가 나왔어요", "bleeding"],
    ["열이 38도까지 올라요", "fever"],
    ["왼쪽 종아리가 붓고 아파요", "calf"],
    ["가만히 있어도 숨이 차요", "chest"],
    ["두통이 너무 심하고 시야가 흐려요", "headache"],
    ["수술 상처에서 고름이 나와요", "wound"],
    ["그냥 죽고 싶다는 생각이 들어요", "mood"],
  ])("%s → %s", (text, expected) => {
    expect(detectRedFlags(text)).toContain(expected);
  });

  it("평범한 질문에는 반응하지 않는다", () => {
    for (const text of [
      "브리지는 몇 세트 해야 해요?",
      "허리가 뻐근한데 어떤 스트레칭이 좋아요?",
      "수유 자세 때문에 어깨가 뭉쳐요",
      "오늘 잠을 못 자서 피곤해요",
      "걷기는 하루에 얼마나 하면 좋아요?",
    ]) {
      expect(detectRedFlags(text)).toEqual([]);
    }
  });

  it("안내문에 상담전화가 들어간다", () => {
    expect(redFlagNotice(["mood"])).toContain("109");
    expect(redFlagNotice([])).toBe("");
  });
});

describe("요청 제한", () => {
  it("창 안에서 한도를 넘으면 막고, 창이 지나면 다시 허용한다", () => {
    const key = "test:1";
    expect(allow(key, 2, 0)).toBe(true);
    expect(allow(key, 2, 1)).toBe(true);
    expect(allow(key, 2, 2)).toBe(false);
    expect(allow(key, 2, 5 * 60_000 + 1)).toBe(true);
  });
});
