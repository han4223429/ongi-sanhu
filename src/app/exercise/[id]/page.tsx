import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertIcon, ChevronLeftIcon, ClockIcon } from "@/components/icons";
import { DoneButton } from "@/components/DoneButton";
import { CATEGORY_LABEL, EXERCISES, getExercise } from "@/lib/exercises";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return EXERCISES.map((exercise) => ({ id: exercise.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: getExercise(id)?.name ?? "운동" };
}

export default function ExercisePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 flex-col gap-4 p-6" aria-busy="true">
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-20" />
          <div className="skeleton h-48" />
        </main>
      }
    >
      <ExerciseDetail params={params} />
    </Suspense>
  );
}

async function ExerciseDetail({ params }: Props) {
  const { id } = await params;
  const exercise = getExercise(id);
  if (!exercise) notFound();

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-4">
      <Link
        href="/today"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-lg pr-3 text-muted transition-colors hover:text-ink"
      >
        <ChevronLeftIcon />
        오늘의 루틴
      </Link>

      <p className="mt-6 text-sm font-medium text-primary">
        {CATEGORY_LABEL[exercise.category]}
      </p>
      <h1 className="display mt-1 text-[2rem]">{exercise.name}</h1>
      <p className="mt-3 text-muted">{exercise.summary}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-control)] bg-tint-soft px-4 py-3">
          <dt className="text-sm text-muted">횟수</dt>
          <dd className="mt-1 font-semibold">
            {exercise.sets}세트 × {exercise.reps}
          </dd>
        </div>
        <div className="rounded-[var(--radius-control)] bg-tint-soft px-4 py-3">
          <dt className="flex items-center gap-1 text-sm text-muted">
            <ClockIcon width={16} height={16} />
            걸리는 시간
          </dt>
          <dd className="mt-1 font-semibold">약 {exercise.minutes}분</dd>
        </div>
      </dl>

      <section className="mt-10" aria-labelledby="steps-title">
        <h2 id="steps-title" className="display text-xl">
          이렇게 해요
        </h2>
        <ol className="mt-4 space-y-4">
          {exercise.steps.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span
                className="display grid size-8 flex-none place-items-center rounded-full bg-primary text-on-primary"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <p className="pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="mt-10 rounded-[var(--radius-panel)] bg-sage-soft px-5 py-4"
        aria-labelledby="breath-title"
      >
        <h2 id="breath-title" className="font-semibold text-sage-strong">
          호흡
        </h2>
        <p className="mt-1">{exercise.breathing}</p>
      </section>

      <section className="mt-10" aria-labelledby="caution-title">
        <h2
          id="caution-title"
          className="display flex items-center gap-2 text-xl"
        >
          <AlertIcon className="text-primary" />
          이럴 땐 멈춰요
        </h2>
        <ul className="mt-4 space-y-3">
          {[
            ...exercise.cautions,
            "통증이 날카롭게 오거나 출혈이 늘면 바로 멈추고 쉬어요.",
          ].map((caution) => (
            <li
              key={caution}
              className="border-l-2 border-primary pl-4 text-[0.9375rem]"
            >
              {caution}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 space-y-3">
        <DoneButton id={exercise.id} />
        <Link href="/coach" className="btn btn-quiet w-full">
          이 동작, 코치에게 물어보기
        </Link>
      </div>
    </main>
  );
}
