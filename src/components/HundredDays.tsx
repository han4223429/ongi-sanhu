/**
 * 백일 점 달력. 출산 후 100일을 점 100개로 보여준다.
 * 삼칠일(21일)까지는 쑥색, 그 뒤는 대추색으로 채워진다.
 */
export function HundredDays({ days }: { days: number }) {
  // days: 출산일로부터 지난 일수(출산 당일 0). 오늘은 days + 1번째 날.
  const dayNumber = days + 1;
  const filled = Math.min(dayNumber, 100);
  const label =
    dayNumber <= 100
      ? `출산 후 ${dayNumber}일째. 백일까지 ${100 - dayNumber}일 남았어요.`
      : `출산 후 ${dayNumber}일째. 백일을 지났어요.`;

  return (
    <div role="img" aria-label={label} className="grid grid-cols-10 gap-[6px]">
      {Array.from({ length: 100 }, (_, index) => {
        const n = index + 1;
        const isFilled = n <= filled;
        const isToday = n === dayNumber;
        const isMilestone = n === 21 || n === 100;

        let tone = "bg-dot";
        if (isFilled) tone = n <= 21 ? "bg-sage" : "bg-primary";
        else if (isMilestone) tone = "bg-surface ring-[1.5px] ring-inset ring-muted";

        return (
          <span
            key={n}
            className={`aspect-square rounded-full ${tone} ${
              isToday ? "outline-2 outline-offset-2 outline-primary" : ""
            }`}
            style={
              isToday
                ? { animation: "dot-in 500ms 200ms ease-out backwards" }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
