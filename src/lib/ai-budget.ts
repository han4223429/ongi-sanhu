// Single-process MVP. Public multi-instance hosting needs a shared gateway budget.
let active = 0;
const MAX_ACTIVE = 4;
export const AI_TIMEOUT_MS = 60_000;

export function acquireAI(): (() => void) | null {
  if (active >= MAX_ACTIVE) return null;
  active++;
  let released = false;
  return () => {
    if (!released) { released = true; active--; }
  };
}

export function aiSignal(request: Request) {
  return AbortSignal.any([request.signal, AbortSignal.timeout(AI_TIMEOUT_MS)]);
}
