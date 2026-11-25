"use client";

import { useState } from "react";

const MESSAGES: Record<string, string> = {
  wrong_code: "시연 코드가 맞지 않아요. 다시 확인해 주세요.",
  rate_limited: "틀린 시도가 많아요. 5분 뒤에 다시 해 주세요.",
  demo_unavailable: "시연 코드 입장은 지금 열려 있지 않아요.",
};

/** 시연 코드를 입력해 입장한다. 코드를 아는 사람만 AI를 쓸 수 있다. */
export function DemoCodeForm({ onDone }: { onDone?: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ongi-client": "web" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(MESSAGES[data?.code] ?? "입장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        return;
      }
      setCode("");
      onDone?.();
    } catch {
      setError("연결이 끊겼어요. 인터넷을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="demo-code" className="block text-sm font-medium">
        시연 코드
      </label>
      <input
        id="demo-code"
        type="password"
        autoComplete="off"
        maxLength={64}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="field"
        placeholder="안내받은 코드를 입력해 주세요"
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !code.trim()}>
        {busy ? "확인하는 중…" : "입장하기"}
      </button>
    </form>
  );
}
