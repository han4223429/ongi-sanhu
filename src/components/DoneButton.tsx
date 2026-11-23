"use client";

import { CheckIcon } from "./icons";
import { toggleDone, useLog, useToday } from "@/lib/store";

/** 운동 상세에서 오늘 완료 여부를 바로 체크한다. 오늘 화면의 체크와 같은 기록을 쓴다. */
export function DoneButton({ id }: { id: string }) {
  const log = useLog();
  const today = useToday();

  if (!log || !today) {
    return <div className="skeleton h-[3.25rem]" aria-hidden="true" />;
  }

  const done = (log[today] ?? []).includes(id);

  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => toggleDone(today, id)}
      className={`btn w-full ${done ? "btn-outline" : "btn-primary"}`}
    >
      <CheckIcon width={20} height={20} />
      {done ? "오늘 완료했어요 (취소하기)" : "오늘 했어요"}
    </button>
  );
}
