/**
 * CSS 변수를 쓸 수 없는 곳(웹 매니페스트, viewport themeColor)에서만 쓰는 값.
 * globals.css의 --color-bg, --color-primary와 같은 값으로 유지한다.
 */
export const THEME = {
  bg: "#fdf1ec",
  primary: "#8a3b34",
} as const;

export const APP_NAME = "온기산후";
export const APP_TAGLINE = "출산 후 내 몸에 맞춘 회복 운동";
