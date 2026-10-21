import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { finishChatReply } from "./finish-chat-reply";

const user: UIMessage = {
  id: "question",
  role: "user",
  parts: [{ type: "text", text: "Cek data" }],
};
const partial: UIMessage = {
  id: "reply",
  role: "assistant",
  parts: [
    { type: "tool-getBankBalances", toolCallId: "read", state: "input-available", input: {} },
  ],
};
const completed: UIMessage = {
  ...partial,
  parts: [
    {
      type: "tool-getBankBalances",
      toolCallId: "read",
      state: "output-available",
      input: {},
      output: { accounts: [] },
    },
    { type: "text", text: "Pembacaan selesai." },
  ],
};

test("a completed reply publishes its final text and card over a partial UI snapshot", () => {
  const current = [user, partial];
  const next = finishChatReply(current, completed);
  expect(next[1]?.parts).toEqual(completed.parts);
  expect(next[1]).not.toBe(completed);
  expect(next[1]?.parts).not.toBe(completed.parts);
  expect(current[1]?.parts).toEqual(partial.parts);
  expect(next[0]).toBe(user);
  expect(next).toHaveLength(2);
});

test("late completion cannot restore a cleared or different conversation", () => {
  for (const current of [[], [user], [user, { ...partial, id: "other-reply" }]]) {
    expect(finishChatReply(current, completed)).toBe(current);
  }
});
