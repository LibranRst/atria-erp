import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { groupChatTurns } from "./chat-turns";

function message(id: string, role: "user" | "assistant"): UIMessage {
  return { id, role, parts: [] } as UIMessage;
}

describe("groupChatTurns", () => {
  test("membuat slot asisten dengan key pesan user sebelum balasan tersedia", () => {
    const turns = groupChatTurns([message("user-1", "user")]);

    expect(turns).toEqual([{ key: "user-1", user: message("user-1", "user"), assistant: null }]);
  });

  test("mempertahankan key slot ketika pesan asisten kemudian hadir", () => {
    const before = groupChatTurns([message("user-1", "user")]);
    const after = groupChatTurns([message("user-1", "user"), message("assistant-1", "assistant")]);

    expect(after[0]?.key).toBe(before[0]?.key);
    expect(after[0]?.assistant?.id).toBe("assistant-1");
  });

  test("menjaga setiap giliran lama stabil saat pertanyaan baru ditambahkan", () => {
    const turns = groupChatTurns([
      message("user-1", "user"),
      message("assistant-1", "assistant"),
      message("user-2", "user"),
    ]);

    expect(turns.map((turn) => turn.key)).toEqual(["user-1", "user-2"]);
    expect(turns[0]?.assistant?.id).toBe("assistant-1");
    expect(turns[1]?.assistant).toBeNull();
  });
});
