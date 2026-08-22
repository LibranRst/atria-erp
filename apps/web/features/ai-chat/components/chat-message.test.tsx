import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChatMessage,
  projectAssistantTextBubbles,
  resolveAssistantBubbleEntrance,
} from "./chat-message";

function assistant(parts: unknown[]): UIMessage {
  return { id: "assistant-1", role: "assistant", parts } as unknown as UIMessage;
}

function render(message: UIMessage): string {
  return renderToStaticMarkup(
    <ChatMessage
      message={message}
      conversationId={null}
      confirmedProposals={{}}
      showFollowUps={false}
      onFollowUp={() => undefined}
      isBusy
      isStreaming
      handoffFromIndicator={false}
    />,
  );
}

describe("ChatMessage assistant content", () => {
  test("tidak membuat placeholder atau bubble untuk pesan asisten kosong", () => {
    const html = render(assistant([]));

    expect(html).not.toContain("pending-reply");
    expect(html).not.toContain("h-1.5 w-1.5");
    expect(html).not.toContain("rounded-tl-md");
  });

  test("mengabaikan text part yang hanya berisi whitespace", () => {
    expect(render(assistant([{ type: "text", state: "streaming", text: "\n  " }]))).not.toContain(
      "rounded-tl-md",
    );
  });

  test("menjadikan tool trace sebagai konten nyata pertama ketika tool berjalan", () => {
    const html = render(
      assistant([
        {
          type: "tool-getBankBalances",
          toolCallId: "call-1",
          state: "input-available",
        },
      ]),
    );

    expect(html).toContain("0 dari 1 sumber dibaca");
    expect(html).not.toContain("rounded-tl-md");
  });

  test("membuat bubble setelah teks bermakna pertama hadir", () => {
    const html = render(assistant([{ type: "text", state: "streaming", text: "Total kas" }]));

    expect(html).toContain("rounded-tl-md");
    expect(html).toContain("Total kas");
  });

  test("membuat bubble independen untuk setiap text part", () => {
    const html = render(
      assistant([
        { type: "text", state: "done", text: "Saya cek dulu." },
        { type: "step-start" },
        { type: "text", state: "streaming", text: "Ini hasilnya." },
      ]),
    );

    expect(html.match(/rounded-tl-md/g)).toHaveLength(2);
    expect(html).toContain("Saya cek dulu.");
    expect(html).toContain("Ini hasilnya.");
  });

  test("mempertahankan beberapa paragraf Markdown dalam satu bubble", () => {
    const html = render(
      assistant([
        {
          type: "text",
          state: "done",
          text: "Paragraf pertama.\n\nParagraf kedua.",
        },
      ]),
    );

    expect(html.match(/rounded-tl-md/g)).toHaveLength(1);
    expect(html).toContain("Paragraf pertama.");
    expect(html).toContain("Paragraf kedua.");
  });

  test("mempertahankan satu trace di atas dua bubble lintas agent step", () => {
    const html = render(
      assistant([
        { type: "text", state: "done", text: "Saya cek datanya." },
        { type: "step-start" },
        {
          type: "tool-getBankBalances",
          toolCallId: "call-1",
          state: "input-available",
        },
        { type: "step-start" },
        { type: "text", state: "streaming", text: "Saldo sudah ditemukan." },
      ]),
    );

    expect(html.indexOf("0 dari 1 sumber dibaca")).toBeLessThan(html.indexOf("Saya cek datanya."));
    expect(html.match(/rounded-tl-md/g)).toHaveLength(2);
  });
});

describe("assistant text bubble projection", () => {
  test("memakai indeks part sebagai key stabil ketika token bertambah", () => {
    const before = projectAssistantTextBubbles(
      assistant([{ type: "text", state: "streaming", text: "Ha" }]),
    );
    const after = projectAssistantTextBubbles(
      assistant([
        { type: "text", state: "done", text: "Halo" },
        { type: "step-start" },
        { type: "text", state: "streaming", text: "Lanjutan" },
      ]),
    );

    expect(after[0]?.key).toBe(before[0]?.key);
    expect(after.map((bubble) => bubble.key)).toEqual(["assistant-1-text-0", "assistant-1-text-2"]);
    expect(after.map((bubble) => bubble.isFirst)).toEqual([true, false]);
  });
});

describe("assistant bubble entrance", () => {
  test("bubble pertama memakai rise saat parent menangani crossfade", () => {
    expect(
      resolveAssistantBubbleEntrance({
        isStreaming: true,
        isFirst: true,
        handoffFromIndicator: true,
        reduceMotion: false,
      }),
    ).toBe("rise");
  });

  test("bubble live lain memakai rise-fade penuh", () => {
    expect(
      resolveAssistantBubbleEntrance({
        isStreaming: true,
        isFirst: false,
        handoffFromIndicator: false,
        reduceMotion: false,
      }),
    ).toBe("riseFade");
  });

  test("history dan reduced motion tidak memakai entrance", () => {
    expect(
      resolveAssistantBubbleEntrance({
        isStreaming: false,
        isFirst: true,
        handoffFromIndicator: false,
        reduceMotion: false,
      }),
    ).toBe("none");
    expect(
      resolveAssistantBubbleEntrance({
        isStreaming: true,
        isFirst: false,
        handoffFromIndicator: false,
        reduceMotion: true,
      }),
    ).toBe("none");
  });
});
