/** 화면을 옮기는 동안 보여 주는 뼈대. 각 화면의 로딩 모양과 같은 톤으로 맞춘다. */
export default function Loading() {
  return (
    <main
      className="flex flex-1 flex-col gap-4 p-6"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      <div className="skeleton h-10 w-1/2" />
      <div className="skeleton h-40" />
      <div className="skeleton h-16" />
      <div className="skeleton h-16" />
    </main>
  );
}
