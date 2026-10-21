import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { readAssistantIntroduction } from "./assistant-introduction";
import { groupChatTurns } from "./chat-turns";

type Part = UIMessage["parts"][number];

function assistant(parts: Part[]): UIMessage {
  return { id: "assistant-qa", role: "assistant", parts };
}

test("model commentary preserves one stable slot as streamed data grows", (): void => {
  const first = readAssistantIntroduction(
    assistant([{ type: "data-assistant-introduction", id: "intro", data: { text: "Aku cek" } }]),
  );
  const next = readAssistantIntroduction(
    assistant([
      {
        type: "data-assistant-introduction",
        id: "intro",
        data: { text: "Aku cek saldo rekening terbarunya dulu." },
      },
      { type: "text", text: "Saldo tersedia Rp 10.000." },
    ]),
  );
  expect(first?.key).toBe(next?.key);
  expect(next?.text).toBe("Aku cek saldo rekening terbarunya dulu.");
});

test("history without an introduction and malformed or reasoning parts invent no commentary", (): void => {
  for (const message of [
    null,
    assistant([{ type: "text", text: "Jawaban tersimpan." }]),
    assistant([{ type: "reasoning", text: "Private reasoning must never become commentary." }]),
    assistant([{ type: "data-assistant-introduction", data: { text: 42 } }]),
    assistant([{ type: "data-assistant-introduction", data: { text: " \n " } }]),
    { id: "user-qa", role: "user" as const, parts: [{ type: "text" as const, text: "Cek stok" }] },
  ]) {
    expect(readAssistantIntroduction(message)).toBeNull();
  }
});

test("last valid data update is read without mutating the transcript or adding an assistant turn", (): void => {
  const user: UIMessage = {
    id: "user-qa",
    role: "user",
    parts: [{ type: "text", text: "Cek stok" }],
  };
  const message = assistant([
    { type: "data-assistant-introduction", id: "intro", data: { text: "Aku cek stok" } },
    {
      type: "data-assistant-introduction",
      id: "intro",
      data: { text: "Aku cek stok gudangnya dulu." },
    },
    { type: "data-assistant-introduction", data: { malformed: true } },
    { type: "text", text: "Stok tersedia 5 lembar." },
  ]);
  const snapshot = JSON.stringify(message);
  expect(readAssistantIntroduction(message)?.text).toBe("Aku cek stok gudangnya dulu.");
  expect(JSON.stringify(message)).toBe(snapshot);
  expect(groupChatTurns([user, message])).toEqual([{ key: user.id, user, assistant: message }]);
  expect(readAssistantIntroduction(JSON.parse(snapshot))?.text).toBe(
    "Aku cek stok gudangnya dulu.",
  );
});
