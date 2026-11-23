import assert from "node:assert/strict";

// Run against a local test server. Only rejected input and deterministic safety
// requests are sent; no ordinary AI request or real personal data is used.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3013");
assert(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Use a loopback test server");
const profile = { birthDate: "2026-10-01", delivery: "vaginal", cleared: true, symptoms: [], redFlags: ["bleeding"], minutes: 20 };
const body = JSON.stringify({ profile, today: "2026-11-23", messages: [{ role: "user", content: "오늘 안내" }], condition: { pain: 0, fatigue: "low", note: "" } });
const headers = { "content-type": "application/json", "x-ongi-client": "web" };

for (const path of ["/", "/onboarding", "/today", "/coach", "/me", "/exercise/diaphragm-breathing"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("x-frame-options"), "DENY", path);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", path);
  assert(response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"), path);
  assert(!/user-scalable=no|maximum-scale=1(?:[,"\s])/.test(await response.text()), path);
  console.log(`PASS ${path}: 200, security headers, zoom enabled`);
}

for (const path of ["/api/chat", "/api/plan"]) {
  for (const [name, init, status] of [
    ["cross-site", { headers: { ...headers, origin: "https://evil.example", "sec-fetch-site": "cross-site" }, body }, 403],
    ["missing-client-header", { headers: { "content-type": "application/json" }, body }, 403],
    ["simple-request", { headers: { ...headers, "content-type": "text/plain" }, body }, 415],
    ["invalid-schema", { headers, body: "{}" }, 400],
    ["oversized-body", { headers, body: " ".repeat(100_001) }, 413],
    ["safety-guidance", { headers, body }, 200],
  ]) {
    const response = await fetch(new URL(path, base), { method: "POST", ...init });
    assert.equal(response.status, status, `${path} ${name}`);
    assert.equal(response.headers.get("cache-control"), "no-store", `${path} ${name}`);
    const result = await response.text();
    if (name === "safety-guidance") {
      if (path.endsWith("plan")) {
        assert.deepEqual(JSON.parse(result).items, []);
        assert.deepEqual(JSON.parse(result).redFlags, ["bleeding"]);
      } else assert(result.includes("진료"));
    }
    console.log(`PASS ${path} ${name}: ${status}, no-store`);
  }
}
