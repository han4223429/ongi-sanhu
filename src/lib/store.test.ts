import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { KEYS, captureStore, clearAll, clearChat, saveChat, savePlan, write } from "./store";

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  const target = new EventTarget();
  vi.stubGlobal("window", Object.assign(target, { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } }));
});
afterEach(() => vi.unstubAllGlobals());

it("does not restore a deleted conversation when a late answer finishes", () => {
  saveChat([{ role: "user", content: "질문" }]);
  const snapshot = captureStore(KEYS.chat, KEYS.profile);
  expect(clearChat()).toBe(true);
  expect(saveChat([{ role: "assistant", content: "늦은 응답" }], snapshot)).toBe(false);
  expect(values.has(KEYS.chat)).toBe(false);
});
it("does not overwrite a conversation changed in another tab", () => {
  saveChat([{ role: "user", content: "첫 질문" }]);
  const snapshot = captureStore(KEYS.chat);
  saveChat([{ role: "user", content: "다른 탭 질문" }]);
  expect(saveChat([{ role: "assistant", content: "이전 답변" }], snapshot)).toBe(false);
  expect(values.get(KEYS.chat)).toContain("다른 탭 질문");
});
it("keeps normal answers and prevents stale plans after profile changes", () => {
  saveChat([{ role: "user", content: "질문" }]);
  expect(saveChat([{ role: "assistant", content: "응답" }], captureStore(KEYS.chat))).toBe(true);
  write(KEYS.profile, "old-profile");
  const snapshot = captureStore(KEYS.profile, KEYS.plan);
  write(KEYS.profile, "new-profile");
  expect(savePlan("2026-11-23", [], "늦은 조정", snapshot)).toBe(false);
});
it("reports storage deletion failure and keeps the profile for retry", () => {
  write(KEYS.profile, "profile");
  window.localStorage.removeItem = () => { throw new Error("blocked"); };
  expect(clearAll()).toBe(false);
  expect(values.get(KEYS.profile)).toBe("profile");
});
it("clears all app records on success", () => {
  Object.values(KEYS).forEach((key) => write(key, "record"));
  expect(clearAll()).toBe(true);
  expect(values.size).toBe(0);
});
