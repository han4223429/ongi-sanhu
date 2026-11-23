import type { Metadata, Viewport } from "next";
import { Gowun_Dodum } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { APP_NAME, APP_TAGLINE, THEME } from "@/lib/theme";
import "./globals.css";

const gowun = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gowun",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME.bg,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${gowun.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/*
          휴대폰: 화면 전체를 쓴다.
          넓은 화면(md 이상): 휴대폰 크기의 틀 안에서 스크롤하고, 옆에 소개를 둔다.
        */}
        <div className="md:flex md:h-dvh md:items-center md:justify-center md:gap-16 md:px-8">
          <aside className="hidden max-w-xs lg:block">
            <p className="display text-2xl text-primary">{APP_NAME}</p>
            <p className="display mt-4 text-[2rem] text-ink">
              백일 동안, 내 몸이 돌아오는 속도에 맞춰요
            </p>
            <p className="mt-4 text-muted">
              휴대폰 화면에 맞춘 앱이에요. 휴대폰 브라우저에서 열고 홈 화면에
              추가하면 앱처럼 쓸 수 있어요.
            </p>
          </aside>
          <div
            id="app-scroll"
            className="relative mx-auto flex min-h-dvh pt-[env(safe-area-inset-top)] md:pt-0 w-full max-w-[30rem] flex-col bg-bg md:mx-0 md:h-[min(54rem,calc(100dvh-3rem))] md:min-h-0 md:w-[26.5rem] md:flex-none md:overflow-y-auto md:rounded-[2.25rem] md:border md:border-line"
          >
            {children}
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}
