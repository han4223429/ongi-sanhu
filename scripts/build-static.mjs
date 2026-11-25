// 서버 없이 열리는 정적 데모 사이트를 만든다 (GitHub Pages용).
//  - 설문, 오늘 루틴, 운동 설명, 내 정보, 개인정보 처리방침은 그대로 동작한다.
//  - AI 코치와 루틴 조정은 서버가 필요해서 꺼진 상태로 보인다. (NEXT_PUBLIC_STATIC_DEMO=1)
//  - 작업 폴더는 건드리지 않고, 임시 폴더에 복사해서 빌드한다.
// 사용법: node scripts/build-static.mjs [기본경로, 예: /ongi-sanhu]   →  결과: static-site/
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const basePath = (process.argv[2] ?? "").replace(/\/+$/, "");
const tmp = mkdtempSync(join(tmpdir(), "ongi-static-"));
const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { cwd: tmp, stdio: "inherit", env: { ...process.env, ...env } });

try {
  for (const name of ["src", "public", "package.json", "package-lock.json", "tsconfig.json"]) {
    cpSync(join(root, name), join(tmp, name), { recursive: true });
  }
  // 서버 라우트와 테스트는 정적 사이트에 넣지 않는다.
  rmSync(join(tmp, "src/app/api"), { recursive: true, force: true });
  const dropTests = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) dropTests(path);
      else if (/\.test\.tsx?$/.test(entry)) rmSync(path);
    }
  };
  dropTests(join(tmp, "src"));

  // 정적 내보내기는 manifest 같은 메타데이터 라우트에 정적 선언이 필요하다.
  // (운영 설정 cacheComponents와는 충돌하므로 원본이 아니라 임시 복사본에만 추가한다.)
  const manifestPath = join(tmp, "src/app/manifest.ts");
  if (existsSync(manifestPath)) {
    appendFileSync(manifestPath, '\nexport const dynamic = "force-static";\n');
  }

  writeFileSync(
    join(tmp, "next.config.ts"),
    `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  basePath: ${JSON.stringify(basePath)},
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
  poweredByHeader: false,
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};
export default nextConfig;
`,
  );

  run("npm", ["ci", "--no-audit", "--no-fund"]);
  run("npx", ["next", "build"], {
    NEXT_PUBLIC_STATIC_DEMO: "1",
    NEXT_PUBLIC_BASE_PATH: basePath,
  });

  const out = join(tmp, "out");
  if (!existsSync(join(out, "index.html"))) throw new Error("정적 빌드 결과(out/index.html)가 없어요.");
  const dest = join(root, "static-site");
  rmSync(dest, { recursive: true, force: true });
  cpSync(out, dest, { recursive: true });
  writeFileSync(join(dest, ".nojekyll"), "");
  console.log(`\n정적 사이트 생성 완료: ${dest} (기본 경로: ${basePath || "/"})`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
