# 11.23 공통 인수인계

## 현재 목표
산후 회복 셀프케어 PWA "온기산후" MVP. 구현과 로컬 검증, BAZE 게이트웨이(claude-sonnet-5-5) 경유 AI 실응답 확인까지 끝났다.

## 먼저 읽을 것
- README.md: 무엇을 만들었는지, 실행 방법, 현재 상태, 남은 일
- docs/DESIGN.md: 디자인 결정과 검증 기록
- .agents/notes/lead.md: 변경 파일, 실제 검증 결과, 미검증 항목, 다음 행동

## 결정 및 제약
- 스택: Next.js 16.4 App Router, TypeScript, Tailwind 4, @anthropic-ai/sdk, zod, vitest. npm 사용.
- 로그인·DB 없음(localStorage). 운동은 코드 내 목록에서만, 위험 증상은 규칙으로 먼저 감지.
- 필요한 비밀값은 `.env.local`의 `ANTHROPIC_API_KEY` 하나. 기록·코드·채팅에 넣지 않는다.
- Git 저장소가 아니다. commit/push/배포는 사용자 요청이 있을 때만.

## 검증 근거
2026-11-23: lint, typecheck, vitest 28개, build 통과. 키 없는 상태의 API 응답과 6개 화면을 브라우저로 확인.
AI 코치·루틴 조정은 BAZE 게이트웨이로 실제 호출해 확인했다(캐시 적중 포함).

## 다음 행동
1. AI 답변 내용의 의학적 적절성 전문가 검토
2. 실제 휴대폰 기기 확인
3. 운동 내용 전문가 감수, 배포 방식 결정

## 저장소
- GitHub(비공개): https://github.com/han4223429/ongi-sanhu , 브랜치 main, 첫 커밋 a9198e4 (2026-11-23).
- 커밋 작성자는 GitHub noreply 주소. `.env.local`(API 키)은 Git에서 제외되어 올라가지 않았다.
- 푸시 이후 다른 도구(Codex backend 역할)가 보안 작업을 이어가고 있을 수 있다. 이어받기 전에 `git status`로 미커밋 변경을 확인할 것.
- 공개 배포 전에는 docs/SECURITY-REVIEW.md의 트레이드오프(인증 없음, 인스턴스별 예산)를 먼저 해결한다.
