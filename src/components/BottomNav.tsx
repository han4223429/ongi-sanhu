"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoachIcon, MeIcon, TodayIcon } from "./icons";

const TABS = [
  { href: "/today", label: "오늘", Icon: TodayIcon },
  { href: "/coach", label: "코치", Icon: CoachIcon },
  { href: "/me", label: "내 정보", Icon: MeIcon },
] as const;

/** 설문과 첫 화면에서는 탭을 숨긴다. */
const HIDDEN = ["/", "/onboarding"];

export function BottomNav() {
  const raw = usePathname();
  // 정적 사이트는 주소 끝에 /가 붙을 수 있어 같은 화면으로 본다.
  const pathname = raw.length > 1 ? raw.replace(/\/$/, "") : raw;
  if (HIDDEN.includes(pathname)) return null;

  return (
    <nav
      aria-label="주요 메뉴"
      className="sticky bottom-0 z-20 mt-auto border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href === "/today" && pathname.startsWith("/exercise"));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm transition-colors ${
                  active
                    ? "font-semibold text-primary"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
