import { getRedFlag, type RedFlagId } from "@/lib/redflags";
import { AlertIcon } from "./icons";

/** 위험 증상이 있을 때: 운동 대신 진료 안내 */
export function RedFlagNotice({ ids }: { ids: RedFlagId[] }) {
  if (ids.length === 0) return null;
  const emergency = ids.some((id) => getRedFlag(id).emergency);

  return (
    <section
      role="alert"
      className="rounded-[var(--radius-control)] border-[1.5px] border-danger bg-danger-soft p-4"
    >
      <h2 className="flex items-center gap-2 font-semibold text-danger">
        <AlertIcon className="flex-none" />
        오늘은 운동보다 진료가 먼저예요
      </h2>
      <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed">
        {ids.map((id) => (
          <li key={id}>{getRedFlag(id).advice}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {emergency && (
          <a href="tel:119" className="btn btn-danger">
            119 전화하기
          </a>
        )}
        {ids.includes("mood") && (
          <a href="tel:109" className="btn btn-outline">
            109 상담전화
          </a>
        )}
      </div>
    </section>
  );
}

/** 의료 면책. 과장 없이 한 줄로. */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm leading-relaxed text-muted ${className}`}>
      이 앱은 일반적인 건강 정보를 제공하며 진단이나 치료를 대신하지 않아요.
      몸 상태가 걱정되면 담당 의료진과 상의하세요.
    </p>
  );
}
