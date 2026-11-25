# lead

설계·조율: 목표, API 계약, 파일 담당, 작업 순서를 정리하고 HANDOFF.md를 관리한다.

- 상태: MVP 구현 완료, AI 실응답 확인 대기 (2026-11-23, Claude Code 단일 세션이 lead로 frontend·backend 겸임)
- 목표: 산후 회복 셀프케어 PWA "온기산후" — 규칙 기반 맞춤 루틴 + Claude API 코치
- 담당 파일: 프로젝트 전체. 사람용 설명은 README.md, 디자인 근거는 docs/DESIGN.md
- 완료한 변경:
  - create-next-app(Next 16.4.6, React 19.3, Tailwind 4.3) 스캐폴딩 후 루트로 이동
  - src/lib: exercises(21개), program(단계·필터·루틴·sanitizePlan), redflags, profile, store, anthropic, ratelimit
  - 화면: /, /onboarding, /today, /exercise/[id], /coach, /me, not-found
  - API: /api/chat(스트리밍), /api/plan(structured output + 규칙 fallback)
  - 디자인 토큰(globals.css), 백일 점 달력, 넓은 화면용 휴대폰 틀, manifest·아이콘
  - next.config.ts에 allowedDevOrigins(사설 IP) 추가 → 같은 Wi-Fi 휴대폰에서 개발 서버 접속 가능
- 검증 (2026-11-23 실제 실행):
  - `npm run lint` 통과, `npm run typecheck` 통과, `npm test` 28개 통과, `npm run build` 성공
  - curl: 키 없음 → chat/plan 503 no_api_key, 잘못된 입력 400, 메모의 위험 증상 → redFlags 반환, plan 11번째 요청부터 429
  - Chrome 500px/1280px에서 설문 5단계 → 오늘 → 완료 체크 → 운동 상세 → 코치(키 없음 + 위험 증상 안내) → 내 정보 확인
- 앱 모드 (2026-11-23 추가): apple-icon.png·PNG 매니페스트 아이콘, 핀치 확대 금지, 상단 안전 영역 패딩, 채팅 입력창 하단 안전 영역, 당겨서 새로고침/길게 눌러 선택 억제(CSS).
  ios/ 에 WKWebView 껍데기(Swift, 서명 ad-hoc, 시뮬레이터 전용). `ios/build-and-run.sh`로 설치·실행. iPhone 17e(iOS 27.0)에서 실행해 Safari 주소창 없이 뜨는 것을 스크린샷으로 확인.
  이 Mac의 Xcode 27.2에는 Simulator.app(창)이 없어 simctl로만 제어 가능(탭 입력 불가). 홈 화면 아이콘 모양은 눈으로 확인 못 함.
- AI 연결 (2026-11-23): 사용자가 BAZE API Gateway 키를 제공. `.env.local`(Git 제외, 키는 어떤 문서에도 기록하지 않음)에 ANTHROPIC_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway/claude, ANTHROPIC_MODEL=claude-sonnet-5-5 설정.
  게이트웨이 /models/ 로 키 유효·모델 목록 확인. /api/chat 스트리밍, /api/plan(structured output), 두 번째 요청 cacheRead=7984, 종아리 통증 문장 → 규칙 안내 + AI 진료 권유 확인.
  BAZE 안내 문서가 시키는 ~/.zshrc·~/.claude/settings.json 수정, 전역 npm CLI 설치는 하지 않음(요청 범위 밖). 필요하면 사용자 확인 후.
- 화면 개선 (2026-11-23, 시뮬레이터로 6개 화면 확인): fieldset min-width:0(iOS 날짜칸 넘침), 위 여백 축소, 첫 화면 한 화면에 맞춤, 오늘 화면 '시작하기' 버튼, 운동 상세 '오늘 했어요'(DoneButton), loading.tsx·error.tsx, 코치 입력 중 점, devIndicators:false.
  ios/App.swift: 로딩 오버레이, 실행 인자 `-AppURL`, `-SeedDemo 1`(데모 프로필), `-AfterLoadJS`(첫 로딩 후 1회만 실행).
  시뮬레이터 확인용: `xcrun simctl launch booted com.ongi.sanhu -AppURL http://localhost:3000/today -SeedDemo 1`
- 최종 검증 (2026-11-23): lint·typecheck 통과, vitest 29개 통과, build 성공(경고 0), npm audit 취약점 0, 클라이언트 번들·저장소에 키 없음(.env.local만, 권한 600).
  프로덕션 서버(next start)에서 페이지 12종 200, /api/chat·/api/plan 실제 AI 응답. 브라우저 전 과정(설문 검증 → 오늘 → 체크 → 상세 → 코치(멈춤 포함) → 루틴 조정 → 위험 증상 → 기록 삭제), 콘솔 오류 0. 서버 로그 500 없음.
  이번 검증에서 찾아 고친 것: ① 빠른 연속 체크 시 앞 기록 덮어쓰기(toggleDone이 저장 시점 값을 읽도록) ② 위험 증상일 때 "활동으로 돌아가요" 단계 카드가 같이 뜨던 모순(숨김) ③ AI 루틴이 하루 시간 한도 초과(sanitizePlan limitMinutes + 테스트) ④ AI 메모의 시간(분)이 화면 계산값과 달라 메모에서 분 언급 금지.
  알려진 한계: /exercise/없는-id 는 화면은 '찾는 화면이 없어요'지만 HTTP 상태는 200(스트리밍 렌더링 특성).
- 미검증:
  - 실제 안드로이드·아이폰 기기, 화면 낭독기, 큰 글꼴 설정
- 결정/제약:
  - 로그인·DB 없음. 프로필/기록/대화는 localStorage(키 접두사 `ongi.`)
  - 운동은 exercises.ts에서만. AI 응답은 allowedExercises 집합으로 걸러냄
  - 위험 증상은 규칙으로 먼저 감지(redflags.ts). 키가 없어도 안내는 나감
  - 모델 기본값 claude-opus-5-5, `ANTHROPIC_MODEL`로 변경. opus-5/sonnet-5-5/fable-5.x에만 server-side fallback 적용
  - cacheComponents가 켜져 있어 route에 `export const runtime`을 쓰면 빌드 오류. params를 읽는 서버 컴포넌트는 Suspense로 감쌀 것
  - 디자인: "크림+세리프+테라코타" 금지, 살구/대추/쑥 팔레트, 그림자·이모지·영문 대문자 라벨 금지 (docs/DESIGN.md)
  - "전문가 감수" 류 문구는 실제 감수 전까지 넣지 않음
- 다음 행동:
  1. 사용자가 .env.local에 ANTHROPIC_API_KEY를 넣으면 dev 서버 재시작 후 코치·루틴 조정 실응답과 서버 로그의 `[chat] usage` cacheRead 확인
  2. 실제 휴대폰에서 화면 확인
  3. 운동 내용 전문가 감수, 배포 방식 결정

- (2026-11-25) 로그인·사용량 제한 구현은 별도 worktree(../ongi-auth, 브랜치 feat/auth-quota)에서 진행해 Codex 작업과 충돌 없이 main에 합쳤다. 상세는 HANDOFF.md.
