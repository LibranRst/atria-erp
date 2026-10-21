import { createUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import {
  companyBudgetPolicySchema,
  type CompanyBudgetPolicy,
} from "@atria/core/ai/company-budget-policy";
import { calculateTargetGross } from "@atria/core/budget/excel-budget";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { AiToolContext } from "./tools/context";

const DEFAULT_CONTEXT = /\b(settings?|pengaturan|erp|standar|default)\b/i;
const DEFAULT_FIELDS =
  /\b(plafon|budget cap|gross margin|margin|alokasi|pembagian|kategori|budget|anggaran)\b/i;
const OTHER_CONTEXT =
  /\b(proyek|projects?|rap|rab|saldo|rekening|kas|stok|stock|gudang|inventory|pengeluaran|expense|tagihan|invoice|vendor|supplier|pemasok|klien|client|pelanggan|termin|piutang|utang|hutang|profil|profile|staf|staff|role|peran|izin|permission|riwayat|history|historis|kemarin|dulu|lama|tahun|bulan|bandingkan|perbandingan|dibandingkan|compare|versus|vs|mengapa|kenapa|prediksi|forecast)\b/i;
const ACTION =
  /\b(siapkan|buat|catat|ubah|mengubah|diubah|koreksi|hapus|bayar|ajukan|setujui|tolak|terapkan|impor|import|aktifkan|nonaktifkan|transfer|finalisasi|kunci|revisi|edit|update|create|approve|reject|submit|record|pay|usulan|draft|draf|ekspor|export|ganti|atur|tetapkan|simpan|naikkan|turunkan|perbarui|prepare|change|modify|delete|save|store|add|set|adjust|reallocate|configure)\b/i;
const DEFAULT_QUESTION_WORDS = new Set(
  "berapa apa bagaimana cek periksa lihat tampilkan sebutkan jelaskan baca what show check read is the tolong coba please target gross margin kotor plafon internal budget cap standar default perusahaan company nilai kontrak anggaran alokasi pembagian kategori masing-masing masing setiap tiap dari terhadap berdasarkan menurut memakai mengikuti menggunakan aktif aktual terbaru saat ini sekarang erp setting settings pengaturan dan atau serta persentase persen rasio nya untuk di pada tentang sesuai yang sih ya dong bro aku saya kita jawab singkat saja sumber sumbernya informasi informasinya info mana material tukang operasional lain-lain lain_lain subcon".split(
    " ",
  ),
);

/** Only direct questions about current company defaults can skip model orchestration. */
export function isCompanyBudgetDefaultsQuestion(question: string): boolean {
  const intent = question.replace(/\bjangan\b[^.!?\n]*/gi, "").trim();
  const words = intent.toLocaleLowerCase("id-ID").match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return (
    intent.length > 0 &&
    intent.length <= 600 &&
    /^(?:(?:tolong|coba|please)\s+)?(?:berapa|apa|bagaimana|cek|periksa|lihat|tampilkan|sebutkan|jelaskan|baca|what|show|check|read)\b/i.test(
      intent,
    ) &&
    (DEFAULT_CONTEXT.test(intent) ||
      (/\b(perusahaan|company)\b/i.test(intent) &&
        /\btarget\b/i.test(intent) &&
        /\bmargin\b/i.test(intent))) &&
    DEFAULT_FIELDS.test(intent) &&
    !OTHER_CONTEXT.test(intent) &&
    !ACTION.test(intent) &&
    !/\b(tapi|tetapi|namun|kecuali|lebih|kurang|dibanding\w*)\b/i.test(question) &&
    words.every((word): boolean => DEFAULT_QUESTION_WORDS.has(word)) &&
    !/\b(kontrak|rp|rupiah|nominal|total)\b/i.test(intent.replace(/\bnilai kontrak\b/gi, "")) &&
    !/\b\d{4}\b|\b(?:tahun|thn)\s*\d{4}\b/i.test(intent)
  );
}

function plain(value: string): string {
  return value.replace(/[\\`*_{}[\]<>()#+.!|-]/g, "\\$&");
}

function percent(value: number): string {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 4 })}%`;
}

function answerText(question: string, policy: CompanyBudgetPolicy): string {
  if (policy.status !== "configured") return policy.message;
  const cap = percent(policy.budgetCapRatio * 100),
    margin = percent(policy.targetGrossMarginPercentage);
  const requestedCategories = /\b(alokasi|pembagian|kategori)\b/i.test(question);
  const requestedMargin = /\b(margin)\b/i.test(question);
  const lines: string[] = [];
  if (requestedMargin)
    lines.push(
      `Target gross margin standar perusahaan adalah **${margin}**, dengan plafon budget internal **${cap} dari nilai kontrak**.`,
    );
  else if (!requestedCategories || /\b(plafon|budget cap)\b/i.test(question))
    lines.push(
      `Plafon budget internal standar perusahaan adalah **${cap} dari nilai kontrak**, sehingga target gross margin **${margin}**.`,
    );
  if (requestedCategories) {
    if (!policy.categories.length)
      lines.push("Pembagian kategori belum tersedia pada Pengaturan Budget aktif.");
    else
      lines.push(
        "Alokasi kategori dari **plafon budget internal**:\n" +
          policy.categories
            .map(
              (category): string =>
                `- ${plain(formatBusinessLabel(category.name || category.code))}: **${percent(category.ratioPercentage * 100)}**`,
            )
            .join("\n"),
      );
  }
  lines.push(
    `Sumber: Pengaturan Budget — ${plain(policy.source.settingName)} yang aktif saat pertanyaan ini.`,
  );
  return lines.join("\n\n");
}

/** The caller supplies a freshly authorized server snapshot, never stored chat output. */
export function companyBudgetFactStream(input: {
  readonly question: string;
  readonly policy: CompanyBudgetPolicy;
  readonly permissions: AiToolContext["permissions"];
  readonly conversationId: string;
  readonly messages: UIMessage[];
  readonly signal?: AbortSignal;
  readonly save: (message: UIMessage) => Promise<void>;
}): ReadableStream<UIMessageChunk> {
  if (!isCompanyBudgetDefaultsQuestion(input.question))
    throw new Error("Pertanyaan ini memerlukan pemeriksaan asisten sesuai konteksnya.");
  const permitted =
    input.permissions.includes("use:ai_chat") && input.permissions.includes("view:settings");
  let policy: CompanyBudgetPolicy;
  if (!permitted)
    policy = {
      status: "forbidden",
      message: "Peran Anda tidak memiliki akses ke Pengaturan Budget perusahaan.",
    };
  else {
    const parsed = companyBudgetPolicySchema.safeParse(input.policy);
    policy = parsed.success
      ? parsed.data
      : {
          status: "unavailable",
          message: "Pengaturan Budget belum dapat diverifikasi. Coba lagi.",
        };
    if (policy.status === "configured") {
      const margin =
        Math.round(calculateTargetGross(100, policy.budgetCapRatio * 100).percentage * 10_000) /
        10_000;
      if (margin !== policy.targetGrossMarginPercentage)
        policy = {
          status: "unavailable",
          message:
            "Plafon dan target margin belum konsisten. Periksa Pengaturan Budget terlebih dahulu.",
        };
    }
  }
  const messageId = crypto.randomUUID(),
    callId = crypto.randomUUID(),
    textId = crypto.randomUUID();
  const text = answerText(input.question, policy);
  const missingCategories =
    policy.status === "configured" &&
    /\b(alokasi|pembagian|kategori)\b/i.test(input.question) &&
    policy.categories.length === 0;
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
      writer.write({
        type: "tool-input-available",
        toolCallId: callId,
        toolName: "getCompanyBudgetDefaults",
        input: {},
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: callId,
        output: policy.status === "configured" ? policy : { ...policy, error: policy.message },
      });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: text });
      writer.write({ type: "text-end", id: textId });
      writer.write({
        type: "data-grounded-facts",
        data: {
          status:
            policy.status === "configured" ? (missingCategories ? "partial" : "verified") : "error",
          sources:
            policy.status === "configured"
              ? [
                  {
                    toolName: "getCompanyBudgetDefaults",
                    toolCallId: callId,
                    entityIds: [policy.source.settingId],
                    query: {},
                  },
                ]
              : [],
          coveredDomains: policy.status === "configured" && !missingCategories ? ["budget"] : [],
          missingDomains: policy.status !== "configured" || missingCategories ? ["budget"] : [],
        },
      });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish", finishReason: "stop" });
    },
    onEnd: async ({ responseMessage, isAborted }): Promise<void> => {
      if (!isAborted && !input.signal?.aborted) await input.save(responseMessage);
    },
    onError: (): string => "Pengaturan Budget terbaru belum dapat ditampilkan. Coba lagi.",
  });
}
