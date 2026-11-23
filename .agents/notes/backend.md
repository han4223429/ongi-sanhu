# backend

- 상태: 보안 수정 진행 중 (2026-11-23, Codex)
- 목표: 보안 점검 → 수정 → 재검증을 총 3회 수행하고 과정 기록
- 담당 파일: src/lib, src/app/api, 관련 UI 개인정보 삭제/요청 처리, next.config.ts, .env.example, README.md, docs/SECURITY-REVIEW.md 및 보안 회귀 테스트
- 확인: 다른 역할은 대기 또는 이전 작업 완료 상태. Git 저장소가 아니므로 소스만 임시 사본 보관; 비밀값은 복사하지 않음.
- 기준 검증: npm test 29/29 통과; npm audit 취약점 0.
- 진행: 1차 API 경계(횟수 제한, 본문 크기, 교차 사이트 호출) 수정 예정.
- 기록: docs/SECURITY-REVIEW.md에서 회차별 실제 결과 확인.
- 제약: 외부 유료 AI 호출·배포·키 변경 없이 로컬 mock과 실행 서버로 검증.
