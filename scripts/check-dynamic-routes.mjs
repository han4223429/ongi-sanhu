// 빌드 뒤에 실행한다: 로그인·세션·AI 라우트가 빌드 때 미리 만들어져 굳었는지 검사한다.
// 굳은 라우트는 .next/server/app/<경로>.body 파일로 남는다. (예: 모든 사용자가 같은 로그인 state를 받게 됨)
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), ".next", "server", "app");
const mustBeDynamic = [
  "api/auth/login",
  "api/auth/callback",
  "api/auth/logout",
  "api/auth/me",
  "api/chat",
  "api/plan",
];

const frozen = mustBeDynamic.filter((route) => existsSync(join(root, `${route}.body`)));
if (!existsSync(root)) {
  console.error("빌드 결과가 없어요. 먼저 npm run build를 실행하세요.");
  process.exit(2);
}
if (frozen.length > 0) {
  console.error(`빌드 때 굳은 라우트가 있어요(요청마다 실행돼야 함): ${frozen.join(", ")}`);
  process.exit(1);
}
console.log(`OK: ${mustBeDynamic.length}개 라우트 모두 요청마다 실행돼요.`);
