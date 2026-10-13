import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { isOwnProfileNameQuestion, profileFactStream } from "./profile-fact-stream";

test("single own-name facts publish the verified row and preserve a real read trace", async (): Promise<void> => {
  expect(isOwnProfileNameQuestion("Siapa nama profil saya sekarang?")).toBe(true);
  expect(isOwnProfileNameQuestion("Bagaimana cara mengubah nama saya?")).toBe(false);
  expect(isOwnProfileNameQuestion("Baca nama saya dan saldo rekening")).toBe(false);
  let saved: UIMessage | undefined;
  const stream = profileFactStream({
    profile: { name: "Actual * QA", imageUrl: null, hasPhoto: false },
    conversationId: crypto.randomUUID(),
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "Siapa nama profil saya?" }],
      },
    ],
    save: async (message): Promise<void> => {
      saved = message;
    },
  });
  const reader = stream.getReader();
  while (!(await reader.read()).done) {
    /* Consume the actual SDK stream and persistence callback. */
  }
  expect(saved?.parts.some((p) => p.type === "text" && p.text.includes("Actual \\* QA"))).toBe(
    true,
  );
  expect(saved?.parts.some((p) => p.type === "tool-getOwnProfileContext")).toBe(true);
});
