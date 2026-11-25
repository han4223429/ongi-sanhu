# 로그인, 사용량 제한, 배포

## 동작 방식
- **로그인**: GitHub OAuth. 권한(scope)을 요청하지 않아 공개 프로필(숫자 번호, 로그인 이름)만 받는다. 이메일은 받지 않는다.
  세션은 서명된 쿠키(HttpOnly, SameSite=Lax, 프로덕션에서는 Secure와 `__Host-` 접두사)이고 7일 유지된다.
- **로그인 없이 되는 것**: 설문, 오늘의 루틴, 운동 설명, 위험 증상 안내, 기록(기기 저장). 로그인은 AI 코치와 루틴 조정에만 필요하다.
- **사용량 제한**: 사용자별 하루 코치 20회, 루틴 조정 5회. 전체 하루 합계 한도(기본 500회)도 함께 건다. 한국 시간 자정에 초기화된다.
  AI 답을 받지 못한 요청은 횟수에서 되돌려 준다. 위험 증상 안내는 한도와 무관하게 항상 나온다.
- **저장소**: Upstash Redis(REST). 카운터만 저장하고 하루 이틀 뒤 자동 삭제된다. 저장소에 닿지 못하면 AI를 닫는다(열어 두는 쪽으로 실패하지 않음).
- **닫힘 규칙**: 프로덕션에서 로그인 설정이나 저장소가 없으면 AI 기능은 닫힌다. 키가 있어도 누구나 쓰는 일이 없다.
  개발·테스트(`NODE_ENV`가 production이 아님)에서는 로그인 없이 열려 있다.

## 배포 순서 (Vercel 기준, 약 15분)
GitHub 저장소를 Vercel이 가져가는 방식이라 서버 코드와 키가 제3자 도구를 거치지 않는다. 값은 모두 Vercel 화면에 직접 입력한다.

1. **Vercel에서 가져오기**: https://vercel.com/new 에서 "Continue with GitHub"로 로그인하고 `ongi-sanhu` 저장소를 Import한다.
   환경변수는 일단 `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`만 넣고 Deploy한다.
   이 단계의 앱은 AI가 닫힌 채로 뜬다(로그인 설정이 아직 없으므로). 배포 주소가 정해진다. 예: `https://ongi-sanhu.vercel.app`
2. **사용량 저장소**: Vercel 프로젝트의 Storage 탭 → Marketplace → Upstash for Redis를 만들어 프로젝트에 연결한다.
   `KV_REST_API_URL`, `KV_REST_API_TOKEN`이 자동으로 들어간다(코드가 두 이름을 모두 읽는다).
3. **GitHub OAuth 앱**: https://github.com/settings/developers → New OAuth App
   - Homepage URL: 1단계 배포 주소
   - Authorization callback URL: `<배포 주소>/api/auth/callback`
   생성 뒤 Client ID와 Client secret을 복사한다.
4. **환경변수 추가**: Vercel → Settings → Environment Variables에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   `AUTH_SECRET`(무작위 32자 이상), `AUTH_URL`(1단계 배포 주소, 끝에 `/` 없이)을 넣고 Redeploy한다.
5. **확인**: 배포 주소에서 설문을 마치고 코치 탭 → GitHub로 로그인 → 질문이 가는지, 내 정보에서 남은 횟수가 줄어드는지 본다.

주소를 바꾸면(커스텀 도메인 등) `AUTH_URL`과 GitHub OAuth 앱의 callback URL을 함께 바꿔야 한다.

## 비용과 위험
- AI 요금은 `ANTHROPIC_API_KEY`를 만든 계정에 청구된다. 사용자 한도(20/5)와 전체 한도(500회/일)가 상한이지만,
  GitHub 계정이 있는 누구나 로그인할 수 있으므로 공개 전에 `AI_DAILY_GLOBAL_LIMIT`를 예산에 맞게 조정한다.
- 이 앱의 주 사용자(산모)는 GitHub 계정이 없을 가능성이 높다. 일반 사용자에게 열려면 카카오·구글 같은 로그인을 추가해야 한다.
- 운영자 이름과 연락처는 개인정보 처리방침(`/privacy`)에 아직 없다. 공개 전에 넣어야 한다.
- 운동 내용의 전문가 감수는 여전히 필요하다.
