import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-12">
      <h1 className="display text-[1.75rem]">찾는 화면이 없어요</h1>
      <p className="text-muted">
        주소가 바뀌었거나 없는 운동이에요. 오늘의 루틴에서 다시 골라 주세요.
      </p>
      <Link href="/today" className="btn btn-primary mt-4">
        오늘의 루틴으로 가기
      </Link>
    </main>
  );
}
