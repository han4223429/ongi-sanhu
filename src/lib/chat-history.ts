import type { ChatMessage } from "./store";

/** Bound context separately from the conversation retained on this device. */
export function chatHistory(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let characters = 0;
  for (const message of messages.slice(-30).reverse()) {
    const content = message.content.trim().slice(0, 4000);
    if (!content) continue;
    if (characters + content.length > 26_000) break;
    result.unshift({ role: message.role, content });
    characters += content.length;
  }
  while (result.length && result[0].role !== "user") result.shift();
  return result;
}
