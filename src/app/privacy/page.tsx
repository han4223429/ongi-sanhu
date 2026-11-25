import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";

export const metadata: Metadata = { title: "개인정보 처리방침" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "이 기기에만 저장하는 정보",
    body: [
      "출산일, 분만 방식, 불편한 증상, 운동 기록, 코치와 나눈 대화는 이 휴대폰의 브라우저에만 저장해요. 우리 서버에는 저장하지 않아요.",
      "내 정보 화면의 '기록 지우기'로 언제든 모두 지울 수 있어요.",
    ],
  },
  {
    title: "로그인할 때 서버가 받는 정보",
    body: [
      "GitHub으로 로그인하면 GitHub 숫자 번호와 로그인 이름(공개 프로필)만 받아요. 이메일과 저장소 접근 권한은 요청하지 않아요.",
      "로그인 상태는 이 브라우저의 쿠키에 7일 동안 유지돼요. 로그아웃하면 바로 지워져요.",
    ],
  },
  {
    title: "하루 사용 횟수",
    body: [
      "AI 코치와 루틴 조정을 하루에 몇 번 썼는지만 GitHub 번호별로 세어요. 한국 시간 자정에 새로 시작하고, 이 기록은 하루 이틀 안에 저절로 사라져요.",
    ],
  },
  {
    title: "AI를 쓸 때 전달되는 정보",
    body: [
      "질문, 분만 방식, 산후 주차, 증상이 AI 제공자(Anthropic의 Claude 모델, BAZE API Gateway 경유)에 전달돼요. 우리 서버는 이 내용을 저장하지 않아요.",
      "AI 제공자 쪽에서의 처리와 보관은 이 앱이 정할 수 없어요. 이름과 연락처는 적지 않아도 돼요.",
    ],
  },
  {
    title: "하지 않는 것",
    body: [
      "광고, 행동 분석, 정보 판매는 하지 않아요. 다만 서비스를 올려 둔 호스팅 업체가 접속 기록(IP 주소 등)을 일정 기간 남길 수 있어요.",
    ],
  },
  {
    title: "의료 정보가 아니에요",
    body: [
      "이 앱은 일반적인 건강 정보를 제공하며 진단이나 치료를 대신하지 않아요. 몸 상태가 걱정되면 담당 의료진과 상의해 주세요.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-4">
      <Link
        href="/me"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-lg pr-3 text-muted transition-colors hover:text-ink"
      >
        <ChevronLeftIcon />
        내 정보
      </Link>
      <h1 className="display mt-4 text-[1.75rem]">개인정보 처리방침</h1>
      <p className="mt-2 text-sm text-muted">2026년 11월 25일부터 적용해요.</p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="display text-xl">{section.title}</h2>
            <div className="mt-2 space-y-2 text-[0.9375rem] text-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
