import type { UIMessage } from "ai";

export type ChatTurn = {
  readonly key: string;
  readonly user: UIMessage | null;
  readonly assistant: UIMessage | null;
};

type MutableChatTurn = {
  key: string;
  user: UIMessage | null;
  assistant: UIMessage | null;
};

/**
 * Mengelompokkan transcript menjadi giliran yang stabil.
 *
 * Slot asisten lahir bersama pesan user dan tidak berganti parent ketika SDK
 * kemudian menambahkan pesan asisten. Itu mencegah placeholder status remount
 * dan menjalankan initial animation lagi di tengah satu balasan.
 */
export function groupChatTurns(messages: readonly UIMessage[]): readonly ChatTurn[] {
  const turns: MutableChatTurn[] = [];

  messages.forEach((message) => {
    if (message.role === "user") {
      turns.push({ key: message.id, user: message, assistant: null });
      return;
    }

    const current = turns[turns.length - 1];
    if (current && current.assistant === null) {
      current.assistant = message;
      return;
    }

    turns.push({
      key: `assistant-${message.id}`,
      user: null,
      assistant: message,
    });
  });

  return turns;
}
