import { readFile, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Exact local credential matching. Never print secret values or source contents.
const secretName = /(?:KEY|TOKEN|SECRET|PASSWORD)/i;
function fields(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/i);
    if (!match || !secretName.test(match[1])) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
  });
}
const failures = [];
let local = [];
try {
  local = fields(await readFile(".env.local", "utf8"));
  if ((await stat(".env.local")).mode & 0o077) failures.push(".env.local: permissions must be 600");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (local.some(([name]) => name.startsWith("NEXT_PUBLIC_"))) failures.push("Public credential environment variable");
if (fields(await readFile(".env.example", "utf8")).some(([, value]) => value)) failures.push(".env.example: credential value must be empty");
const secrets = local.map(([, value]) => value).filter((value) => value.length > 8).map((value) => Buffer.from(value));
let files = 0;
async function checkFile(path) {
  const bytes = await readFile(path);
  files++;
  if (secrets.some((value) => bytes.includes(value))) failures.push(`Credential match: ${path}`);
}
async function walk(path) {
  let entries;
  try { entries = await readdir(path, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile()) await checkFile(file);
  }
}
for (const path of ["src", "public", "docs", "scripts", ".agents", ".next/static", ".next/server"]) await walk(path);
const git = (...args) => execFileSync("git", args, { stdio: ["ignore", "pipe", "pipe"] });
const tracked = git("ls-files", "-z").toString().split("\0").filter(Boolean);
if (tracked.includes(".env.local")) failures.push(".env.local is tracked by Git");
try { git("check-ignore", "--quiet", ".env.local"); }
catch { failures.push(".env.local is not ignored by Git"); }
for (const path of tracked) await checkFile(path);
let blobs = 0;
if (process.argv.includes("--history")) {
  for (const row of git("rev-list", "--objects", "--all").toString().trim().split("\n")) {
    const [oid, ...name] = row.split(" ");
    if (git("cat-file", "-t", oid).toString().trim() !== "blob") continue;
    blobs++;
    if (secrets.some((value) => git("cat-file", "blob", oid).includes(value))) failures.push(`History credential match: ${name.join(" ")}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`PASS: ${files} file checks, ${blobs} history blobs; no configured credential matches. Environment is private and Git-ignored.`);
if (!secrets.length) console.log("No local credential value available: exact-value exposure scan is incomplete.");
