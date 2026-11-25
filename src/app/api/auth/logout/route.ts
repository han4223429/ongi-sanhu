import { guardRequest, json } from "@/lib/http";
import { clearedCookie, sessionCookieName } from "@/lib/session";

export async function POST(request: Request) {
  const rejected = guardRequest(request);
  if (rejected) return rejected;
  const response = json({ ok: true });
  response.headers.append("set-cookie", clearedCookie(sessionCookieName()));
  return response;
}
