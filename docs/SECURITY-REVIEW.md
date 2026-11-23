# 보안 점검 및 수정 기록

대상: 온기산후 `/Users/handak/11.23`, 2026-11-23. 요청에 따라 총 3회 점검·수정·재검증.

## 범위와 기준
- Next.js API, 입력 검증, AI 요청/응답 경계, 브라우저 저장소와 삭제, 보안 헤더, iOS 개발용 WebView, 의존성.
- 로그인·DB가 없는 로컬 MVP. 실제 외부 서비스 공격, 유료 AI 호출, 배포, 자격 증명 변경은 수행하지 않는다.
- Git 저장소 아님. 변경 전 소스 사본을 임시 디렉터리에 보관했다. `.env.local`은 복사하거나 내용 출력하지 않는다.
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

## 3차 — 우회 경로 및 통합 검증 / 진행 중
- 최종 변경을 새로 읽고 경계/동시성/이전 데이터 경로 재검토.
- 실제 build 산출물을 별도 loopback 포트3013에서 실행, 환경변수로 AI 키를 비워 유료 호출을 방지.
- UI, 모바일 레이아웃, 보안 헤더 및 API 응답 검증 예정.

## 참고 기준
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): JSON 및 custom header, Fetch Metadata를 함께 검사. 이는 사용자 인증을 대체하지 않는다.
- [Next.js 공식 보안 공지](https://github.com/vercel/next.js/security): 설치 버전의 알려진 의존성 문제는 npm audit와 함께 점검.
