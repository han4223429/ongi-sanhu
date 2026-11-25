import type { Metadata, Viewport } from "next";
import { Gowun_Dodum } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { DesktopIntro } from "@/components/DesktopIntro";
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
          <DesktopIntro />
          <div
            id="app-scroll"
            className="relative mx-auto flex min-h-dvh pt-[env(safe-area-inset-top)] md:pt-0 w-full max-w-[30rem] flex-col bg-bg md:mx-0 md:h-[min(54rem,calc(100dvh-3rem))] md:min-h-0 md:w-[26.5rem] 2xl:h-[min(62rem,calc(100dvh-4rem))] 2xl:w-[29rem] md:flex-none md:overflow-y-auto md:rounded-[2.25rem] md:border md:border-line"
          >
            {children}
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}
