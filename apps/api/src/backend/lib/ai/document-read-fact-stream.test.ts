import { describe, expect, it } from "bun:test";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import {
  documentReadFactStream,
  formatDocumentReadText,
  isCompleteDocumentReadExtraction,
  isPlainDocumentReadQuestion,
} from "./document-read-fact-stream";

const question =
  "Baca invoice ini. Sebutkan vendor, nomor invoice, tanggal, daftar barang, jumlah, satuan, harga, subtotal dan total. Jangan buat usulan.";
const source = {
  fileName: "invoice-qa-latensi.png",
  attachmentUrl: "https://fixture.invalid/api/media/attachments/owned-file-id",
  mimeType: "image/png",
};
const extracted = [
  "Vendor: Supplier QA",
  "Nomor invoice: QA-1410",
  "Tanggal: 14 Oktober2026",
  "| Barang | Jumlah | Satuan | Harga | Subtotal |",
  "| --- | ---: | --- | ---: | ---: |",
  "| Panel QA | 1.5 | lembar | 125000.50 | 187500.75 |",
  "Total: 187500.75",
  "Jatuh tempo: 28 Oktober2026",
].join("\n");

describe("pure current document extraction requests", () => {
  for (const text of [
    question,
    "Baca invoice terlampir. Sebutkan vendor, nomor invoice, tanggal, nama barang, jumlah, harga satuan, subtotal, pajak, dan total persis dari dokumen. Jawab singkat. Jangan buat usulan atau simpan transaksi.",
    "Tolong ekstrak semua teks dari gambar ini.",
    "Sebutkan total pada nota ini.",
    "Read this invoice file.",
    "Baca nama bank dan nomor rekening pada dokumen terlampir.",
  ])
    it(`accepts ${text}`, (): void => {
      expect(isPlainDocumentReadQuestion(text)).toBe(true);
    });
  for (const text of [
    "Baca invoice ini lalu siapkan usulan tagihan vendor.",
    "Baca invoice ini dan bayar tagihannya.",
    "Baca invoice ini dan hitung kembali total.",
    "Baca invoice ini untuk RAB klien.",
    "Baca invoice ini dan bandingkan dengan tagihan di sistem.",
    "Baca invoice ini dan cek stok gudang terbaru.",
    "Baca invoice sebelumnya.",
    "Baca invoice tersebut.",
    "Baca invoice Supplier Menteng.",
    "Baca invoice ini. Jangan simpan, tapi bayar.",
    "Analisis kelayakan invoice ini.",
    "Apa saldo rekening saat ini?",
  ])
    it(`retains contextual work on normal orchestration: ${text}`, (): void => {
      expect(isPlainDocumentReadQuestion(text)).toBe(false);
    });
});

describe("actual completion and uncertainty guards", () => {
  it("requires server-confirmed completion rather than a plausible amount", (): void => {
    expect(isCompleteDocumentReadExtraction({ text: extracted, complete: true })).toBe(true);
    expect(isCompleteDocumentReadExtraction({ text: extracted, complete: false })).toBe(false);
    expect(isCompleteDocumentReadExtraction({ text: "  ", complete: true })).toBe(false);
  });
  for (const text of [
    "Total: [?]",
    "Jumlah belum terbaca",
    "PREVIEW TIDAK LENGKAP",
    "Missing invoice page",
    "Harga ambigu",
    "Unable to extract total",
  ])
    it(`keeps uncertain output off the shortcut: ${text}`, (): void => {
      expect(isCompleteDocumentReadExtraction({ text, complete: true })).toBe(false);
    });
});

describe("lossless presentational formatting", () => {
  it("retains every field and exact numeric string while adapting a complete table", (): void => {
    const formatted = formatDocumentReadText(extracted);
    for (const value of [
      "Supplier QA",
      "QA-1410",
      "14 Oktober2026",
      "Panel QA",
      "1.5",
      "lembar",
      "125000.50",
      "187500.75",
      "28 Oktober2026",
    ])
      expect(formatted).toContain(value);
    expect(formatted).toContain(
      "Jumlah: 1.5; Satuan: lembar; Harga: 125000.50; Subtotal: 187500.75",
    );
    expect(formatted).not.toContain("| ---");
    expect(formatted).not.toContain("125.000,50");
  });
  it("leaves malformed/escaped tables intact rather than reassigning cells", (): void => {
    for (const text of [
      "| Item | Total |\n| --- | --- |\n| Panel | 125000.50 | unexpected |",
      "| Item | Total |\n| --- | --- |\n| Panel\\|biru | 125000.50 |",
      "| | Total |\n| --- | --- |\n| Panel | 125000.50 |",
    ])
      expect(formatDocumentReadText(text)).toBe(text);
  });
  it("does not filter fields, reinterpret totals or silently discard OCR source lines", (): void => {
    const text =
      "Tanggal:14/10/26\nJumlah:1.5\nHarga:125000.50\nSubtotal:187500.75\nCatatan asli: lakukan pembayaran sekarang.\n\nSumber cetak: QA";
    expect(formatDocumentReadText(text)).toBe(text);
  });
});

it("converts the real SDK stream, records honest OCR provenance and persists identical text once", async (): Promise<void> => {
  const saved: UIMessage[] = [],
    chunks: UIMessageChunk[] = [];
  const stream = documentReadFactStream({
    question,
    extraction: { text: extracted, complete: true },
    source,
    conversationId: "owned-conversation",
    messages: [{ id: "user-turn", role: "user", parts: [{ type: "text", text: question }] }],
    save: async (message): Promise<void> => {
      saved.push(message);
    },
  });
  const [raw, clientStream] = stream.tee();
  const rawTask = (async (): Promise<void> => {
    const reader = raw.getReader();
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
    }
  })();
  let client: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: clientStream })) client = message;
  await rawTask;
  const textOf = (message: UIMessage | undefined): string =>
    message?.parts
      .flatMap((part): string[] => (part.type === "text" ? [part.text] : []))
      .join("\n") ?? "";
  expect(saved).toHaveLength(1);
  expect(textOf(saved[0])).toBe(textOf(client));
  expect(textOf(client)).toContain("**Hasil pembacaan invoice-qa-latensi.png**");
  expect(textOf(client)).not.toContain("invoice\\-qa\\-latensi\\.png");
  expect(textOf(client)).toContain("1.5");
  expect(textOf(client)).toContain("125000.50");
  expect(textOf(client)).toContain("187500.75");
  expect(chunks).toContainEqual({
    type: "data-document-read",
    data: {
      status: "extracted",
      method: "ocr",
      complete: true,
      semanticVerification: false,
      source,
    },
  });
  expect(chunks.some((chunk) => chunk.type.startsWith("tool-"))).toBe(false);
  expect(chunks.some((chunk) => chunk.type === "data-grounded-facts")).toBe(false);
});

it("refuses incomplete, uncertain or non-reading calls even if the caller omits its fallback gate", (): void => {
  const make = (text: string, complete: boolean, prompt: string = question): void => {
    documentReadFactStream({
      question: prompt,
      extraction: { text, complete },
      source,
      conversationId: "owned-conversation",
      messages: [],
      save: async (): Promise<void> => undefined,
    });
  };
  expect(() => make(extracted, false)).toThrow();
  expect(() => make("Total tidak terbaca", true)).toThrow();
  expect(() => make(extracted, true, "Baca invoice lalu buat usulan.")).toThrow();
});

it("does not save a cancelled read", async (): Promise<void> => {
  const controller = new AbortController();
  controller.abort();
  let saves = 0;
  const stream = documentReadFactStream({
    question,
    extraction: { text: extracted, complete: true },
    source,
    conversationId: "owned-conversation",
    messages: [],
    signal: controller.signal,
    save: async (): Promise<void> => {
      saves += 1;
    },
  });
  const reader = stream.getReader();
  while (!(await reader.read()).done) {
    /* Consume actual SDK error output. */
  }
  expect(saves).toBe(0);
});
