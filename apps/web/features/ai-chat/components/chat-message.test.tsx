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

function render(message: UIMessage, isStreaming = true): string {
  return renderToStaticMarkup(
    <ChatMessage
      message={message}
      conversationId={null}
      confirmedProposals={{}}
      showFollowUps={false}
      onFollowUp={() => undefined}
      isBusy
      isStreaming={isStreaming}
      handoffFromIndicator={false}
    />,
  );
}

describe("ChatMessage assistant content", () => {
  test("a displayed cash card owns its rows while the final bubble uses the verified complement", () => {
    const fullText =
      "Saldo lengkap perusahaan:\n- Kas Audit Satu: Rp 100.000.\n- Kas Audit Dua: Rp 200.000.";
    const cardText =
      "Posisi kas terkini sudah diperiksa. Rincian per rekening ada pada kartu Saldo rekening.";
    const message: UIMessage = {
      id: "card-complement",
      role: "assistant",
      parts: [
        { type: "text", text: `Data dari pembacaan terbaru:\n\n${fullText}` },
        {
          type: "tool-getBankBalances",
          toolCallId: "cash-read",
          state: "output-available",
          input: {},
          output: {
            scope: "Seluruh rekening aktif perusahaan ini",
            accountCount: 2,
            totalAvailable: { amount: 300000, formatted: "Rp 300.000" },
            accounts: [
              {
                accountId: "00000000-0000-4000-8000-000000000001",
                accountName: "Kas Audit Satu",
                bankName: "Bank QA",
                balance: { amount: 100000, formatted: "Rp 100.000" },
              },
              {
                accountId: "00000000-0000-4000-8000-000000000002",
                accountName: "Kas Audit Dua",
                bankName: "Bank QA",
                balance: { amount: 200000, formatted: "Rp 200.000" },
              },
            ],
          },
        },
        {
          type: "data-grounded-facts",
          data: {
            status: "verified",
            sources: [
              {
                toolName: "getBankBalances",
                toolCallId: "cash-read",
                entityIds: [
                  "00000000-0000-4000-8000-000000000001",
                  "00000000-0000-4000-8000-000000000002",
                ],
                query: {},
              },
            ],
            cardNarratives: [
              { toolName: "getBankBalances", toolCallId: "cash-read", fullText, cardText },
            ],
          },
        },
      ],
    };
    const html = render(message, false);
    expect(html).toContain(cardText);
    expect(html).not.toContain("Saldo lengkap perusahaan:");
    expect(html).toContain("Kas Audit Satu");
    expect(html).toContain("Kas Audit Dua");
    expect(message.parts[0]).toEqual({
      type: "text",
      text: `Data dari pembacaan terbaru:\n\n${fullText}`,
    });

    const streaming = render(message, true);
    expect(streaming).toContain("Saldo lengkap perusahaan:");
    expect(streaming).not.toContain(cardText);

    const noUsableCard: UIMessage = {
      ...message,
      parts: message.parts.filter((part) => part.type !== "tool-getBankBalances"),
    };
    expect(render(noUsableCard, false)).toContain("Saldo lengkap perusahaan:");
    expect(render(noUsableCard, false)).not.toContain(cardText);
  });

  test.each(["waiting", "partial", "verified"])(
    "an unsourced cash card cannot answer a grounded request: %s",
    (status) => {
      const html = render(
        assistant([
          { type: "text", text: "Rekening yang diminta belum terverifikasi." },
          {
            type: "tool-getBankBalances",
            toolCallId: "company-cash",
            state: "output-available",
            input: {},
            output: {
              totalAvailable: { amount: 1000000, formatted: "Rp 1.000.000" },
              accounts: [
                {
                  accountId: "00000000-0000-4000-8000-000000000003",
                  accountName: "Kas perusahaan lain",
                  bankName: "Bank QA",
                  balance: { amount: 1000000, formatted: "Rp 1.000.000" },
                },
              ],
            },
          },
          { type: "data-grounded-facts", data: { status, sources: [], missingDomains: ["cash"] } },
        ]),
        false,
      );
      expect(html).toContain("Rekening yang diminta belum terverifikasi");
      expect(html).not.toContain("Kas perusahaan lain");
      expect(html).not.toContain("Saldo rekening");
      expect(html).not.toContain("1.000.000");
    },
  );
  test("a named-account answer keeps scoped text instead of a broader company-total card", () => {
    const html = render(
      assistant([
        { type: "text", text: "Saldo Rekening Tujuan: Rp 100.000." },
        {
          type: "tool-getBankBalances",
          toolCallId: "company-cash",
          state: "output-available",
          input: {},
          output: {
            totalAvailable: { amount: 300000, formatted: "Rp 300.000" },
            accounts: [
              {
                accountId: "00000000-0000-4000-8000-000000000001",
                accountName: "Rekening Tujuan",
                bankName: "Bank QA",
                balance: { amount: 100000, formatted: "Rp 100.000" },
              },
              {
                accountId: "00000000-0000-4000-8000-000000000002",
                accountName: "Rekening Lain",
                bankName: "Bank Lain",
                balance: { amount: 200000, formatted: "Rp 200.000" },
              },
            ],
          },
        },
        {
          type: "data-grounded-facts",
          data: {
            status: "verified",
            sources: [
              {
                toolName: "getBankBalances",
                toolCallId: "company-cash",
                entityIds: ["00000000-0000-4000-8000-000000000001"],
                query: {},
              },
            ],
            coveredDomains: ["cash"],
            missingDomains: [],
          },
        },
      ]),
      false,
    );
    expect(html).toContain("Saldo Rekening Tujuan");
    expect(html).toContain("100.000");
    expect(html).not.toContain("Rekening Lain");
    expect(html).not.toContain("300.000");
  });
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

    expect(html).toContain("Membaca saldo rekening");
    expect(html).not.toContain("rounded-tl-md");
  });

  test("menampilkan status menyusun jawaban ketika seluruh tool selesai namun teks belum mengalir", () => {
    const html = render(
      assistant([
        {
          type: "tool-getBankBalances",
          toolCallId: "call-1",
          state: "output-available",
          output: { accounts: [] },
        },
      ]),
    );

    expect(html).toContain("1 sumber diperiksa");
    expect(html).toContain("Menyusun jawaban…");
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

    expect(html.indexOf("Membaca saldo rekening")).toBeLessThan(html.indexOf("Saya cek datanya."));
    expect(html.match(/rounded-tl-md/g)).toHaveLength(2);
  });

  test("batas riwayat yang tidak didukung tidak menampilkan kartu saldo saat ini, tetapi error aktivitas tetap terlihat", () => {
    const html = render(
      assistant([
        {
          type: "tool-getBankBalances",
          toolCallId: "current-bank",
          state: "output-available",
          input: {},
          output: {
            totalAvailable: { amount: 1000000, formatted: "Rp 1.000.000" },
            accounts: [
              {
                accountId: "00000000-0000-4000-8000-000000000001",
                accountName: "Rekening saat ini",
                bankName: "Bank QA",
                balance: { amount: 1000000, formatted: "Rp 1.000.000" },
              },
            ],
          },
        },
        {
          type: "tool-getFinancialHistory",
          toolCallId: "failed-history",
          state: "output-error",
          input: {},
          errorText: "Laporan gagal dibaca.",
        },
        {
          type: "text",
          text: "Saldo pada tanggal lampau belum tersedia sebagai snapshot terverifikasi.",
        },
        {
          type: "data-grounded-facts",
          data: { status: "error", sources: [], coveredDomains: [], missingDomains: ["history"] },
        },
      ]),
      false,
    );
    expect(html).toContain("snapshot terverifikasi");
    expect(html).toContain("1 gagal");
    expect(html).not.toContain("Rekening saat ini");
    expect(html).not.toContain("Saldo rekening");
    expect(html).not.toContain("1.000.000");
  });

  test("menunggu pilihan tetap menampilkan kandidat proyek dan pesan lama tetap menampilkan hasilnya", () => {
    const choice = {
      type: "tool-listProjects",
      toolCallId: "project-choice",
      state: "output-available",
      input: { query: "Proyek QA" },
      output: {
        projects: [
          {
            projectId: "00000000-0000-4000-8000-000000000002",
            name: "Proyek kandidat QA",
            status: "ACTIVE",
            storedHealth: "HEALTHY",
            clientName: "Klien QA",
            contractValue: { amount: 250000, formatted: "Rp 250.000" },
          },
        ],
      },
    };
    const waiting = render(
      assistant([
        choice,
        { type: "text", text: "Pilih proyek untuk melanjutkan." },
        {
          type: "data-grounded-facts",
          data: {
            status: "waiting",
            sources: [],
            coveredDomains: [],
            missingDomains: ["documents"],
          },
        },
      ]),
      false,
    );
    expect(waiting).toContain("Proyek kandidat QA");
    expect(waiting).toContain("Pilih proyek untuk melanjutkan");
    const legacy = render(assistant([choice]), false);
    expect(legacy).toContain("Proyek kandidat QA");
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
