import { currentUser } from "@/lib/ai-access";
import { getAuthConfig, isProduction } from "@/lib/auth-config";
import { json } from "@/lib/http";
import { getUsageStore, readUsage } from "@/lib/usage";

/**
 * 화면이 로그인 상태와 남은 횟수를 그리는 데 쓴다.
 * mode: login(로그인 필요) / open(개발용, 로그인 없이 열림) / closed(AI 닫힘)
 */
export async function GET(request: Request) {
  if (
    request.headers.get("x-ongi-client") !== "web" ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return json({ code: "forbidden", message: "앱에서 다시 요청해 주세요." }, { status: 403 });
  }

  if (!getAuthConfig().enabled) {
    return json({ mode: isProduction() ? "closed" : "open", user: null, usage: null });
  }

  const user = await currentUser(request);
  if (!user) return json({ mode: "login", user: null, usage: null });

  const store = getUsageStore();
  const usage = store ? await readUsage(store, user.id).catch(() => null) : null;
  return json({ mode: "login", user: { login: user.login }, usage });
}
