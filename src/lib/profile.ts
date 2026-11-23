import { z } from "zod";
import { RED_FLAG_IDS } from "./redflags";

export const SYMPTOM_IDS = [
  "diastasis",
  "incontinence",
  "pelvic_pain",
  "back_pain",
  "wrist_pain",
] as const;

export type SymptomId = (typeof SYMPTOM_IDS)[number];

export const SYMPTOMS: { id: SymptomId; label: string; hint: string }[] = [
  {
    id: "diastasis",
    label: "배 가운데가 벌어진 느낌",
    hint: "복직근이개. 윗몸을 일으킬 때 배 가운데가 솟아요",
  },
  {
    id: "incontinence",
    label: "소변이 새거나 아래가 묵직함",
    hint: "기침·재채기할 때 새거나 밑이 빠지는 느낌",
  },
  {
    id: "pelvic_pain",
    label: "골반·치골 통증",
    hint: "걷거나 돌아누울 때 골반 앞뒤가 아파요",
  },
  {
    id: "back_pain",
    label: "허리 통증",
    hint: "수유하거나 아기를 안고 나면 뻐근해요",
  },
  {
    id: "wrist_pain",
    label: "손목 통증",
    hint: "아기를 들 때 손목·엄지 쪽이 시큰해요",
  },
];

export const DELIVERY_LABEL = {
  vaginal: "자연분만",
  cesarean: "제왕절개",
} as const;

export const MINUTE_OPTIONS = [10, 20, 30] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DateKeySchema = z
  .string()
  .regex(DATE_PATTERN)
  .refine((value) => !Number.isNaN(parseDateKey(value)), "invalid date");

export const ProfileSchema = z.object({
  birthDate: DateKeySchema,
  delivery: z.enum(["vaginal", "cesarean"]),
  /** 의료진에게 운동해도 된다는 말을 들었는지 */
  cleared: z.boolean(),
  symptoms: z.array(z.enum(SYMPTOM_IDS)).max(SYMPTOM_IDS.length),
  redFlags: z.array(z.enum(RED_FLAG_IDS)).max(RED_FLAG_IDS.length),
  minutes: z.union([z.literal(10), z.literal(20), z.literal(30)]),
});

export type Profile = z.infer<typeof ProfileSchema>;

/** 'YYYY-MM-DD'를 UTC 자정 타임스탬프로. 달력에 없는 날짜면 NaN. */
export function parseDateKey(key: string): number {
  if (!DATE_PATTERN.test(key)) return Number.NaN;
  const [year, month, day] = key.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return Number.NaN;
  }
  return time;
}

/** 기기 현지 날짜 기준 'YYYY-MM-DD' */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** key에서 days일 뒤(음수면 앞)의 날짜 키 */
export function addDays(key: string, days: number): string {
  const time = parseDateKey(key) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

/** 출산일부터 지난 일수. 출산 당일이 0, 미래 날짜는 0으로 본다. */
export function daysSince(birthDate: string, today: string): number {
  const diff = parseDateKey(today) - parseDateKey(birthDate);
  if (Number.isNaN(diff)) return 0;
  return Math.max(0, Math.round(diff / 86_400_000));
}

export function parseProfile(raw: string | null | undefined): Profile | null {
  if (!raw) return null;
  try {
    const result = ProfileSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
