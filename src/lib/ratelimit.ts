/**
 * 인스턴스 공유 요청 제한 (고정 창).
 * 서버 메모리에 두므로 인스턴스가 여러 개인 배포에서는 정확하지 않다.
 * 배포 시 공유 저장소 기반으로 교체해야 한다.
 */
const WINDOW_MS = 5 * 60_000;
const MAX_ENTRIES = 5_000;

const hits = new Map<string, { count: number; resetAt: number }>();

export function clientKey(): string {
  // No authenticated identity or configured trusted proxy exists in this MVP.
  // Use a shared instance budget instead of trusting spoofable forwarding headers.
  return "shared";
}

/** 허용되면 true. limit은 5분 동안의 최대 요청 수. */
export function allow(key: string, limit: number, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= MAX_ENTRIES) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size >= MAX_ENTRIES) return false;
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return entry.count <= limit;
}
