import { createUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

const DOCUMENT_WORDS = new Set(
  "tolong coba please baca bacakan ekstrak ambil tampilkan sebutkan tulis salin transkrip read extract show transcribe invoice nota struk faktur receipt dokumen document doc file berkas lampiran gambar foto pdf ini this attached terlampir data teks tabel isi seluruh semua informasi keterangan rincian detail vendor pemasok supplier nomor tanggal jatuh tempo barang item daftar deskripsi jumlah kuantitas quantity qty satuan unit harga price per subtotal total pajak tax diskon discount nominal nilai biaya mata uang bank rekening nama alamat telepon email referensi reference lengkap secara dengan dan serta yang di pada dari dalam hasil tanpa menghitung analisis hanya saja jawab singkat rapikan tuliskan kemudian persis".split(
    " ",
  ),
);
const NON_READING_REQUEST =
  /\b(siapkan|buat|usulan|draft|draf|ajukan|simpan|catat|ubah|koreksi|hapus|bayar|pembayaran|setujui|tolak|terapkan|impor|import|aktifkan|nonaktifkan|transfer|revisi|edit|update|create|approve|reject|submit|record|pay|prepare|change|save|add|ekspor|export|rab|rap|klien|client|pelanggan|penawaran|hitung|hitungkan|calculate|compute|banding\w*|compare|versus|vs|analisis|analisa|analyze|saldo|budget|anggaran|stok|stock|inventory|sistem|database|erp|aktual|terbaru|tadi|sebelumnya|barusan|ulang|itu|tersebut|tapi|tetapi|namun|kecuali)\b/i;

/** A pure extraction request for the one current file, not an ERP/action request. */
export function isPlainDocumentReadQuestion(question: string): boolean {
  const intent = question.replace(/\bjangan\b[^.!?\n]*/gi, "").trim();
  const words = intent.toLocaleLowerCase("id-ID").match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return (
    intent.length > 0 &&
    intent.length <= 700 &&
    /^(?:(?:tolong|coba|please)\s+)?(?:baca|bacakan|ekstrak|ambil|tampilkan|sebutkan|tulis|salin|transkrip|read|extract|show|transcribe)\b/i.test(
      intent,
    ) &&
    /\b(invoice|nota|struk|faktur|receipt|dokumen|document|doc|file|berkas|lampiran|gambar|foto|pdf)\b/i.test(
      intent,
    ) &&
    !NON_READING_REQUEST.test(intent) &&
    !/\b(tapi|tetapi|namun|kecuali)\b/i.test(question) &&
    words.every((word): boolean => DOCUMENT_WORDS.has(word))
  );
}

export interface CompleteDocumentReadExtraction {
  readonly text: string;
  /** Actual server-side OCR completion; text length or absence of errors is not proof. */
  readonly complete: boolean;
}

const UNCERTAIN_OR_INCOMPLETE =
  /\[\?\]|\b(?:ambigu\w*|uncertain\w*|incomplete|unreadable|illegible|unclear|partially|missing)\b|\b(?:cannot|could not|unable to)\s+(?:read|extract)\b|\b(?:tidak|belum|kurang)\s+(?:terbaca|jelas|lengkap)|\b(?:belum berhasil|gagal membaca|tidak dapat dibaca|tidak bisa dibaca|halaman hilang|preview tidak lengkap|ekstraksi belum berhasil)\b/i;

export function isCompleteDocumentReadExtraction(
  extraction: CompleteDocumentReadExtraction,
): boolean {
  return (
    extraction.complete === true &&
    extraction.text.trim().length > 0 &&
    !UNCERTAIN_OR_INCOMPLETE.test(extraction.text)
  );
}

function plain(value: string): string {
  // The chat's light renderer does not interpret Markdown backslash escapes.
  // Keep ordinary filename punctuation exact; only remove formatting delimiters.
  return value.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();
}

function tableCells(line: string): readonly string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|") || trimmed.includes("\\|")) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell): string => cell.trim());
}

/** Changes only table presentation; cell strings, order and surrounding text stay intact. */
export function formatDocumentReadText(text: string): string {
  const lines = text.split("\n"),
    result: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = tableCells(lines[index] ?? ""),
      separator = tableCells(lines[index + 1] ?? "");
    if (
      !header ||
      !separator ||
      header.length < 2 ||
      header.some((cell) => !cell) ||
      separator.length !== header.length ||
      !separator.every((cell): boolean => /^:?-{3,}:?$/.test(cell))
    ) {
      result.push(lines[index] ?? "");
      continue;
    }
    const rows: string[][] = [];
    let next = index + 2,
      valid = true;
    while (next < lines.length && (lines[next] ?? "").trim().startsWith("|")) {
      const cells = tableCells(lines[next] ?? "");
      if (!cells || cells.length !== header.length) valid = false;
      else rows.push([...cells]);
      next += 1;
    }
    if (!valid || rows.length === 0) {
      result.push(lines[index] ?? "");
      continue;
    }
    result.push(`**${header.join(" · ")}**`);
    for (const row of rows)
      result.push(
        `- ${row.map((cell, column): string => `${header[column] ?? ""}: ${cell}`).join("; ")}`,
      );
    index = next - 1;
  }
  return result.join("\n");
}

/** The caller has already authorized/read the current private file and completed OCR. */
export function documentReadFactStream(input: {
  readonly question: string;
  readonly extraction: CompleteDocumentReadExtraction;
  readonly source: {
    readonly fileName: string;
    readonly attachmentUrl: string;
    readonly mimeType: string;
  };
  readonly conversationId: string;
  readonly messages: UIMessage[];
  readonly signal?: AbortSignal;
  readonly save: (message: UIMessage) => Promise<void>;
}): ReadableStream<UIMessageChunk> {
  if (
    !isPlainDocumentReadQuestion(input.question) ||
    !isCompleteDocumentReadExtraction(input.extraction)
  )
    throw new Error("Pembacaan ini masih memerlukan pemeriksaan asisten sesuai konteksnya.");
  const messageId = crypto.randomUUID(),
    textId = crypto.randomUUID();
  const text = `**Hasil pembacaan ${plain(input.source.fileName)}**\n\n${formatDocumentReadText(input.extraction.text)}\n\nSumber: lampiran privat · hasil OCR.`;
  return createUIMessageStream({
    originalMessages: input.messages,
    execute: ({ writer }): void => {
      input.signal?.throwIfAborted();
      writer.write({
        type: "data-conversation",
        data: { conversationId: input.conversationId },
        transient: true,
      });
      writer.write({ type: "start", messageId });
      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({
        type: "data-document-read",
        data: {
          status: "extracted",
          method: "ocr",
          complete: true,
          semanticVerification: false,
          source: input.source,
        },
      });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish", finishReason: "stop" });
    },
    onEnd: async ({ responseMessage, isAborted }): Promise<void> => {
      if (!isAborted && !input.signal?.aborted) await input.save(responseMessage);
    },
    onError: (): string => "Hasil pembacaan dokumen belum dapat ditampilkan. Coba lagi.",
  });
}
