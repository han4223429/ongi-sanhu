# backend

- 상태: 보안 점검·수정·재검증 3회 완료, API 키 보호 추가 확인 (2026-11-23, Codex)
- 목표: 보안 점검 → 수정 → 재검증을 총 3회 수행하고 과정 기록
- 담당 파일: src/lib, src/app/api, 관련 UI 개인정보 삭제/요청 처리, next.config.ts, .env.example, README.md, docs/SECURITY-REVIEW.md 및 보안 회귀 테스트
- 확인: 다른 역할은 대기 또는 이전 작업 완료 상태. Git 저장소가 아니므로 소스만 임시 사본 보관; 비밀값은 복사하지 않음.
- 기준 검증: npm test 29/29 통과; npm audit 취약점 0.
- 결과: 1차 API 경계, 2차 AI/저장소/UX, 3차 우회·자원 정리·통합 점검 완료. 실제 71개 테스트, lint/typecheck/build, 실행 서버 페이지 6개/API 12개 통과.
- 기록: docs/SECURITY-REVIEW.md에서 회차별 실제 결과 확인.
- 제약: 외부 유료 AI 호출·배포·키 변경 없이 로컬 mock과 실행 서버로 검증.

## 변경과 결정

- `src/lib/http.ts`, `ratelimit.ts`: spoofable IP 헤더 제거, 프로세스 공유 예산, byte/시간/동시 reader 한도, JSON/Origin/Fetch Metadata/custom header 검증, no-store.
- API 2개와 `ai-budget.ts`, `anthropic.ts`: 60초 timeout, retry 0, 동시 4개, 출력 제한, 위험 증상 AI 우회, 응답 검증과 취소/오류 정리. `server-only` 경계 추가.
- `program.ts`, `store.ts`, `chat-history.ts`: AI sets/reps 범위, stale 저장 방지, 삭제 실패 반환, 전송 이력 예산.
- coach/today/me/layout: 취소·삭제 확인·전송 안내, 중복 요청 방지, 이전 루틴 재검증, 확대 허용.
- next.config.ts/.env.example: 보안 헤더와 좁은 개발 Origin 설정. 키 값·자격 증명은 수정하지 않음.
- 테스트 4개 파일 추가 및 기존 program 테스트 보강. `vitest.config.mts`는 Node 서버 테스트에서만 server-only marker를 Next 내장 empty 모듈로 연결.
- `scripts/security-smoke.mjs`, `scripts/check-secrets.mjs`와 README/보안·UX 문서/캡처 9장 추가 또는 갱신.

## 실제 검증

- 기준선 29개 → 1차 54개 → 2차 68개 → 3차 71개 통과. 수정 전 공격 입력 재현 12개 중 10개 실패 → 수정 후 12개 통과.
- 최종 타입 오류 1개를 타입 가드로 해소. lint/typecheck/build 모두 통과. 키 경계 추가 후에도 테스트 71개 통과.
- 키 없는 localhost 프로덕션 서버 3013에서 smoke 18개 통과. 유료 API를 호출하지 않음. 기존 3000 개발 서버는 중지하지 않음.
- 키 검사: .env.local 600, Git 제외, tracked 73개/history blob 73개와 클라이언트·서버 빌드에서 값 일치 0. 검사 스크립트는 값 자체를 출력하지 않음.
- 화면별 실제 조작·증거와 한계는 docs/UX-REVIEW.md. 영구 삭제 UI는 실행하지 않고 저장소 회귀 테스트로 검증.

## 인수인계 / 남은 범위

- 작업 중 다른 세션이 GitHub 저장소를 생성·push함. 이 세션은 commit/push를 하지 않음. 마지막 로컬 기록은 아직 미커밋일 수 있으니 실제 git status 확인.
- 공개 배포 전 인증/공유 비용 제한, 의학적 감수, 실제 휴대폰과 화면 낭독기 검증이 필요. CSP inline script 및 localStorage의 한계는 보안 문서 참조.
- 현재 키는 소스/브라우저/Git에 노출되지 않았지만 이전 대화 등 외부에 전달된 사본까지 회수하지는 않음. 재발급은 제공자에서 별도 수행.
- 공통 인수인계에 이번 결과를 추가하고 기존 lead 기록을 보존함.
- 키 보호 추가 후 최종 재검증: test 71/71, lint/typecheck/build 통과. 재빌드 smoke 18개 통과, .env.local/.env/.git/config HTTP 404. 키 값 일치 0건(723회 파일 검사/73개 이력 blob). 3013 테스트 서버 정상 종료, 기존 3000 유지. 최종 문서·server-only·검사 스크립트는 미커밋 로컬 변경.
