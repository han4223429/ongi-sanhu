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

## 최신 보안·UX 인수인계 (Codex backend, 2026-11-23)

- 보안 점검 → 수정 → 재검증 3회 완료. [backend 메모](notes/backend.md), [보안 기록](../docs/SECURITY-REVIEW.md), [화면 점검·9장 캡처](../docs/UX-REVIEW.md) 참조.
- 71개 테스트, lint, typecheck, build 및 키 없는 실행 서버 smoke 18개 통과. 초기 29개 이후 보안 회귀 테스트 42개 추가.
- API 경계·자원 한도, AI 응답 강제 검증, 위험 증상 처리, 개인정보 삭제/늦은 응답, 취소·확대·전송 안내를 수정함.
- API 키는 .env.local/권한 600/Git 제외. AI 모듈 server-only. 소스·빌드·Git 이력에서 현재 키 값 일치 0. 재검사: `node scripts/check-secrets.mjs --history`.
- 이번 보안 변경의 외부 유료 AI 실호출/실기기/배포 검증은 미실행. 기존 lead의 실호출 기록과 구분할 것.
- 이 세션은 commit/push/배포/자격 증명 변경을 하지 않음. 다른 세션이 만든 저장소 이후의 최종 문서와 키 보호 변경은 git status로 확인.

## 로그인·사용량 제한 (2026-11-25)
- GitHub OAuth 로그인 + 하루 사용량 제한(코치 20 / 루틴 조정 5 / 전체 500)을 구현해 main에 합쳤다. 테스트 118개, lint·typecheck·build·`npm run check:routes` 통과. 프로덕션 모드 서버로 state 요청마다 변경, 쿠키 Secure/__Host-, 로그인 없는 AI 401을 확인했다.
- 로그인·콜백 라우트는 `await connection()`이 없으면 빌드 때 굳는다(모든 사용자가 같은 state). 삭제하지 말 것. 빌드 뒤 `npm run check:routes`로 확인한다.
- **미완료**: 실제 배포. GitHub OAuth 앱(콜백 URL 필요), Vercel, Upstash Redis를 본인 계정으로 만드는 일이 남았다. 순서는 docs/AUTH-AND-DEPLOY.md.
- 실제 GitHub 로그인은 OAuth 앱이 없어 끝까지 해 보지 못했다. 코드 경로는 GitHub 응답을 가짜로 만든 테스트로 검증했다.
- 개인정보 처리방침(/privacy)에는 운영자 이름·연락처가 없다. 공개 전에 넣을 것.

## 데스크톱 시연 (2026-11-25)
- 시연은 컴퓨터 화면으로 한다(사용자 확인). 넓은 화면(lg 이상)에서 폰 틀 옆에 DesktopIntro 패널이 보이고, 프로필이 없을 때만 '예시 프로필로 바로 둘러보기'(산후 7주·제왕절개·허리 통증)가 있다. 2xl 이상에서는 폰 틀을 조금 키운다.
- Codespaces: .devcontainer/devcontainer.json. 개발 모드에서만 TLS 종료 프록시 뒤 https Origin 허용(src/lib/http.ts). 실제 Codespaces에서 열어 보지는 못했다.
