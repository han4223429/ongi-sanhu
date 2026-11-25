/**
 * 하루 사용량 한도 (한국 시간 기준 자정에 초기화).
 *
 * - 사용자별: AI 코치 20회, 루틴 조정 5회
 * - 전체: 하루 합계 한도(기본 500회). 키 요금이 끝없이 늘지 않게 막는다.
 *
 * 저장소는 Upstash Redis(REST)다. 서버가 여러 대여도 같은 숫자를 본다.
 * 저장소에 닿지 못하면 AI를 막는다(열어 두는 쪽으로 실패하지 않는다).
 */
import { demoEnabled } from "./auth-config";

export type UsageKind = "chat" | "plan";

export const DAILY_LIMITS: Record<UsageKind, number> = { chat: 20, plan: 5 };

export function globalDailyLimit(): number {
  const value = Number(process.env.AI_DAILY_GLOBAL_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 500;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDay(now = Date.now()): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 다음 한국 시간 자정(초기화 시각) */
export function nextResetAt(now = Date.now()): Date {
  const start = Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
  return new Date(start + DAY_MS);
}

export interface UsageStore {
  /** key 값을 delta만큼 바꾸고 새 값을 돌려준다. 처음 만들 때 ttl(초)을 건다. */
  add(key: string, delta: 1 | -1, ttlSeconds: number): Promise<number>;
  read(keys: string[]): Promise<number[]>;
}

export class MemoryUsageStore implements UsageStore {
  private values = new Map<string, { value: number; expiresAt: number }>();

  async add(key: string, delta: 1 | -1, ttlSeconds: number) {
    const now = Date.now();
    const current = this.values.get(key);
    const base = current && current.expiresAt > now ? current : undefined;
    const value = Math.max(0, (base?.value ?? 0) + delta);
    this.values.set(key, {
      value,
      expiresAt: base?.expiresAt ?? now + ttlSeconds * 1000,
    });
    return value;
  }

  async read(keys: string[]) {
    const now = Date.now();
    return keys.map((key) => {
      const current = this.values.get(key);
      return current && current.expiresAt > now ? current.value : 0;
    });
  }
}

export class UpstashUsageStore implements UsageStore {
  constructor(
    private url: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const response = await this.fetchImpl(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`usage store HTTP ${response.status}`);
    const results = (await response.json()) as { result?: unknown; error?: string }[];
    return results.map((item) => {
      if (item.error) throw new Error("usage store command failed");
      return item.result;
    });
  }

  async add(key: string, delta: 1 | -1, ttlSeconds: number) {
    const command = delta === 1 ? ["INCR", key] : ["DECR", key];
    const [value] = await this.pipeline([command, ["EXPIRE", key, ttlSeconds]]);
    return Math.max(0, Number(value));
  }

  async read(keys: string[]) {
    if (keys.length === 0) return [];
    const values = await this.pipeline(keys.map((key) => ["GET", key]));
    return values.map((value) => Number(value ?? 0) || 0);
  }
}

let override: UsageStore | null | undefined;
let memory: MemoryUsageStore | undefined;

/** 테스트에서 저장소를 바꿔 끼운다. undefined면 환경 설정을 따른다. */
export function setUsageStoreForTests(store: UsageStore | null | undefined) {
  override = store;
}

/** 설정된 저장소. 프로덕션에서 Redis 설정이 없으면 null(=AI 닫힘). */
export function getUsageStore(): UsageStore | null {
  if (override !== undefined) return override;
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)
    ?.trim()
    .replace(/\/+$/, "");
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  )?.trim();
  if (url && token && url.startsWith("https://")) {
    return new UpstashUsageStore(url, token);
  }
  // 프로덕션에서 Redis가 없으면 닫는다. 단, 시연 코드 모드는 서버 메모리(인스턴스별)로 센다.
  // 이 경우 한도는 인스턴스마다 따로라 엄밀하지 않지만, 코드를 아는 사람만 들어올 수 있다.
  if (process.env.NODE_ENV === "production" && !demoEnabled()) return null;
  memory ??= new MemoryUsageStore();
  return memory;
}

export interface Ticket {
  userKey: string;
  globalKey: string;
  store: UsageStore;
}

export type ConsumeResult =
  | { ok: true; ticket: Ticket }
  | { ok: false; reason: "user" | "global" | "unavailable"; resetsAt: Date };

export async function consume(
  store: UsageStore,
  userId: number,
  kind: UsageKind,
  now = Date.now(),
): Promise<ConsumeResult> {
  const resetsAt = nextResetAt(now);
  const ttl = Math.ceil((resetsAt.getTime() - now) / 1000) + 3600;
  const day = kstDay(now);
  const globalKey = `ongi:${day}:global`;
  const userKey = `ongi:${day}:u${userId}:${kind}`;

  try {
    const total = await store.add(globalKey, 1, ttl);
    if (total > globalDailyLimit()) {
      await store.add(globalKey, -1, ttl);
      return { ok: false, reason: "global", resetsAt };
    }
    const mine = await store.add(userKey, 1, ttl);
    if (mine > DAILY_LIMITS[kind]) {
      await store.add(userKey, -1, ttl);
      await store.add(globalKey, -1, ttl);
      return { ok: false, reason: "user", resetsAt };
    }
    return { ok: true, ticket: { userKey, globalKey, store } };
  } catch {
    return { ok: false, reason: "unavailable", resetsAt };
  }
}

/** AI 결과를 못 받았을 때 한 번 쓴 것으로 치지 않는다. */
export async function refund(ticket: Ticket): Promise<void> {
  try {
    await ticket.store.add(ticket.userKey, -1, 3600);
    await ticket.store.add(ticket.globalKey, -1, 3600);
  } catch {
    // 환불 실패는 사용자에게 불리하지 않은 쪽(조금 더 쓴 것으로 계산)으로 둔다.
  }
}

export interface UsageSummary {
  chat: { used: number; limit: number };
  plan: { used: number; limit: number };
  resetsAt: string;
}

export async function readUsage(
  store: UsageStore,
  userId: number,
  now = Date.now(),
): Promise<UsageSummary> {
  const day = kstDay(now);
  const [chat, plan] = await store.read([
    `ongi:${day}:u${userId}:chat`,
    `ongi:${day}:u${userId}:plan`,
  ]);
  return {
    chat: { used: Math.min(chat, DAILY_LIMITS.chat), limit: DAILY_LIMITS.chat },
    plan: { used: Math.min(plan, DAILY_LIMITS.plan), limit: DAILY_LIMITS.plan },
    resetsAt: nextResetAt(now).toISOString(),
  };
}
