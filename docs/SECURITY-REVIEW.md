# 보안 점검 및 수정 기록

대상: 온기산후 `/Users/handak/11.23`, 2026-11-23. 요청에 따라 총 3회 점검·수정·재검증.

## 범위와 기준
- Next.js API, 입력 검증, AI 요청/응답 경계, 브라우저 저장소와 삭제, 보안 헤더, iOS 개발용 WebView, 의존성.
- 로그인·DB가 없는 로컬 MVP. 실제 외부 서비스 공격, 유료 AI 호출, 배포, 자격 증명 변경은 수행하지 않는다.
- 점검 시작 당시 Git 저장소가 아니어서 변경 전 소스 사본을 임시 디렉터리에 보관했다. 작업 도중 다른 세션이 Git 저장소를 생성했다. 이 점검에서는 commit/push를 하지 않았다. `.env.local`은 복사하거나 내용 출력하지 않는다.
- 자동 Deep Scan 기본값(40회/96시간)이 요청한 3회와 맞지 않아 직접 코드 분석과 로컬 회귀 테스트로 수행한다. 자동 Deep Scan 완료 결과로 표시하지 않는다.
- 기준선: `npm test` 29/29 통과, `npm audit --json` 알려진 취약점 0. 이는 애플리케이션 논리 취약점이 없다는 뜻이 아니다.

## 1차 — API 신뢰 경계 / 완료
확인한 문제:
1. `x-forwarded-for` 첫 값을 무조건 신뢰해 요청 제한 키를 임의 변경할 수 있다. 5,000개 키가 차면 전체 제한 기록도 초기화된다.
2. 두 API 모두 `request.text()`로 전체 본문을 메모리에 올린 뒤 문자열 길이를 검사한다. 실제 byte 한도·느린 본문 timeout이 없다.
3. Content-Type/Origin/브라우저 요청 구분 검사가 없어 cross-origin text/plain POST도 처리한다. 유료 AI 호출을 악용할 수 있다.

수정: 공유 요청 예산(chat 30 / plan 10, 5분), 포화 시 fail closed, JSON/custom header/Origin/Fetch Metadata 검사, streaming byte 한도와 10초 timeout, API no-store 공통 처리.
재현: `npm test -- src/lib/api-security.test.ts` 수정 전 12개 중 10개 실패(공격 입력이 503까지 도달), 정상 대조군 2개 통과. 수정 후 12/12 통과.
확장 검증: chunked 업로드, 한글 byte 경계, 느린 요청, 취소, 잘못된 UTF-8, Origin 변형 검사 추가. `npm test` 54/54 통과, `npm run lint` 통과. 초기 lint 오류 1개와 경고 1개는 수정 후 재실행해 해소했다.

트레이드오프: 인증 없는 MVP이므로 IP 헤더를 신뢰하지 않고 모든 사용자가 인스턴스별 한도를 공유한다. 공개 다중 인스턴스 배포에는 인증·공유 예산 저장소가 필요하다.

## 2차 — 응답 및 개인정보 / 완료
- 대화 삭제 후 진행 중이던 응답의 finally 저장이 삭제한 내용을 복원할 수 있음.
- 루틴 요청에 request.signal이 없어 화면 이탈 뒤에도 AI 작업 지속. SDK timeout 120초와 자동 재시도 2회, 최대 출력 16,000 tokens로 자원 사용이 큼.
- 위험 증상 안내 뒤에도 AI가 계속 답하므로 안내와 충돌 가능; 프로필 위험 증상도 결정적 응답에 포함할 필요가 있음.
- UI 검토 범위 추가: 실제 화면 캡처, 오류/취소/삭제 상태, 글자 확대, 버튼 위계. 디자인 변경도 코드/검증 기록에 포함.

2차 수정 결과:
- AI 동시 요청 최대 4개, 60초 deadline, 자동 재시도 0회, 출력 chat 2,048 / plan 4,096 tokens. 취소 signal 전달과 완료/오류 시 슬롯 해제.
- 위험 증상은 프로필+질문으로 결정하고 AI 호출 없이 반환. 유료 예산 소진 뒤에도 이 안내는 반환. 본문 reader는 최대 8개/10초/20KB 또는100KB로 제한.
- AI reps는 라이브러리 값 고정, 세트는 기존 기본값 이내만 허용. 통증/피로 감소 규칙은 허용 목록과 fallback에 강제. 기존 저장 루틴도 현재 규칙으로 재검증.
- 삭제/다른 탭 변경 이후 늦은 응답이 과거 대화·루틴을 덮어쓰지 않도록 저장 직전 snapshot 비교. 페이지 이탈 시 abort. 삭제 실패는 성공처럼 이동하지 않음.
- 긴 대화는 최신 질문을 남기고 메시지/문자/UTF-8 예산 안에서 전송.
- 개발 Origin wildcard 제거, CSP/frame/nosniff/referrer/권한 헤더. 확대 차단 해제, 취소·삭제 확인·전송 안내 UX 반영.
검증: `npm test` 68/68 통과, `npm run typecheck` 통과, `npm run lint` 통과, `npm run build` 성공. AI는 로컬 mock 사용. 독립 읽기 전용 리뷰에서 확인한 횟수 조작, 긴 대화, 위험 안내/한도 결합 문제를 수정하고 회귀 테스트로 확인함.

## 3차 — 우회 경로 및 통합 검증 / 완료

- 첫 스트림 이벤트가 실패할 때 upstream 정리가 누락된 경로를 수정했다. 반복 실패 5회에도 동시 요청 슬롯이 소진되지 않는 테스트를 추가했다.
- 제공자가 token 한도를 지키지 않는 상황을 가정해 스트리밍 본문을 8,000자에서 중단하고 연결을 정리한다. 정상 응답 대조군과 초과 응답 테스트 통과.
- 동시 느린 업로드 8개 뒤 9번째 요청 거부 및 취소 후 슬롯 복구를 확인했다.
- 최종 변경을 다시 읽고 요청 guard, 저장소 snapshot, 이전 루틴 재검증, 취소 경로를 재검토했다. AI 지침의 sets/reps 설명도 실제 강제 규칙과 맞췄다.
- 3차 테스트의 TypeScript `unknown` 오류 1개를 `RequestError` 타입 가드로 수정한 뒤 검사를 다시 통과했다.
- 실제 build를 `127.0.0.1:3013`에서 실행했다. 프로세스에만 `ANTHROPIC_API_KEY=`와 `ANTHROPIC_AUTH_TOKEN=`을 주어 유료 호출 없이 검사했다. 기존 키 파일은 수정하지 않았다.

| 검증 | 실제 결과 |
| --- | --- |
| `npm test` | 5개 파일, 71/71 통과 (기준선 29개에서 회귀 테스트 42개 추가) |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm run build` | 성공, 34개 페이지 생성 |
| `npm audit --json` | 알려진 의존성 취약점 0 (점검 중 의존성 버전 변경 없음) |
| `node scripts/security-smoke.mjs` | 페이지 6개 + API 사례 12개 통과 |
| 일반 정상 형식 API, 키 없는 테스트 서버 | chat/plan 각각 503, no-store |
| 브라우저 조작 | 6개 주요 화면, 설문 검증, 운동 완료, 삭제 확인 취소, AI 실패 복구, 확대 확인. 캡처 9장 |

실행 서버에서는 cross-site 및 custom header 누락 403, simple request 415, 잘못된 schema 400, 초과 본문 413, 위험 증상 안내 200을 확인했다. 각 API 응답은 no-store였다. 페이지 6개의 CSP, X-Frame-Options, nosniff, Referrer-Policy와 확대 제한 제거를 확인했다. 상세 화면별 결과는 [UX 점검 기록](UX-REVIEW.md)에 있다.

## API 키 보호 추가 확인

사용자의 추가 요청에 따라 키 노출 경계를 다시 점검했다.

- 키는 `.env.local` 서버 환경변수에만 보관한다. 권한 `600`, `.gitignore`로 제외, `.env.example`의 키 값은 비어 있다.
- `src/lib/anthropic.ts`에 Next.js `server-only`를 추가했다. Client Component에서 실수로 가져오면 빌드에서 거부하도록 경계를 명시했다. Vitest의 Node 테스트에만 Next가 제공하는 빈 marker 모듈을 연결했다.
- 이 경계 추가 후 테스트 71개, lint/typecheck/build를 다시 통과했다. 재생성된 빌드의 smoke 18개와 `/.env.local`, `/.env`, `/.git/config`의 HTTP 404를 확인했다. 마지막 키 검사 723회 파일 검사/이력 blob 73개에서 일치 0건. 3013 검증 서버는 종료했고 기존 3000 개발 서버는 유지했다.
- 실제 키 값은 메모리에서 비교만 했으며 출력하지 않았다. Git 추적 파일 73개, 전체 이력 blob 73개, `src`, `public`, `docs`, `.agents`, `.next/static`, `.next/server`에서 값 일치 0건.
- `node scripts/check-secrets.mjs --history`로 재검사 가능하다. 파일 권한, Git 제외, 예제 환경변수, 현재 키의 소스·빌드·Git 이력 포함 여부를 검사한다. 범용 secret scanner는 아니며, 이전에 사용한 키나 모든 외부 시스템을 검사하지 않는다.
- 기존 대화나 외부 시스템에 이미 전달한 키의 사본은 소스 수정으로 회수되지 않는다. 그런 키는 제공자에서 재발급·폐기해야 한다. 이번 작업에서 자격 증명 변경은 수행하지 않았다.

## 재실행

```bash
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-secrets.mjs --history
# 별도 터미널에서 AI 키를 비운 로컬 검증 서버 실행
ANTHROPIC_API_KEY= ANTHROPIC_AUTH_TOKEN= npm run start -- --hostname 127.0.0.1 --port 3013
# 실행 중인 검증 서버에 요청
node scripts/security-smoke.mjs
```

smoke 스크립트는 loopback 주소만 허용하고, 잘못된 요청과 AI 없이 처리하는 위험 증상 요청만 사용한다. 실제 개인정보를 전송하지 않는다.

## 남은 범위와 한계

- 로그인 없는 MVP다. custom header/Origin 검사는 브라우저 교차 사이트 악용을 줄이지만 사용자 인증이 아니다. 직접 HTTP 호출은 가능하다. 공개 서비스 전 인증 및 사용자별·전체 비용 한도를 공유 저장소/게이트웨이에 적용해야 한다.
- 현재 요청 수·동시 처리 제한은 프로세스별이며 재시작하면 초기화된다. 공유 한도는 정상 사용자끼리도 영향을 줄 수 있다.
- CSP는 Next 정적/PPR bootstrap 때문에 inline script를 허용한다. nonce 기반 CSP 적용에는 렌더링 구조 검토가 필요하다.
- localStorage는 같은 Origin의 스크립트와 기기 사용자가 읽을 수 있다. snapshot 비교는 관찰한 늦은 저장을 막지만 여러 탭에 대한 원자적 트랜잭션은 아니다.
- 자유형 AI 답변의 의학적 적절성·프롬프트 공격 전체, 실제 유료 AI 재연동, 실제 휴대폰·화면 낭독기·운영 인프라는 이번 검증에 포함되지 않았다. 운동 목록/단계의 전문가 감수도 별도다.
- iOS 코드는 시뮬레이터용 개발 껍데기로 확인했다. 배포용 네이티브 앱 보안 인증을 한 것은 아니다.
- 3회 점검과 통과한 테스트는 확인 범위의 회귀 방지 근거이며, 취약점 0개나 운영 안전을 보증하지 않는다.

## 참고 기준
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): JSON 및 custom header, Fetch Metadata를 함께 검사. 이는 사용자 인증을 대체하지 않는다.
- [Next.js 공식 보안 공지](https://github.com/vercel/next.js/security): 설치 버전의 알려진 의존성 문제는 npm audit와 함께 점검.
