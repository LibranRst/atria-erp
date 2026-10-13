import { tool } from "ai";
import { normalizeInputRequestPayload } from "@atria/core/ai/input-request-flow";
import { AI_CAPABILITIES, capabilityAvailable } from "./capability-catalog";
import type { AiToolContext } from "./context";

export { inputFieldSchema, requestUserInputSchema } from "@atria/core/ai/input-request";
export type { InputField, RequestUserInputPayload } from "@atria/core/ai/input-request";
import { requestUserInputSchema, type RequestUserInputPayload } from "@atria/core/ai/input-request";

/**
 * Tool AI untuk meminta masukan data multi-field dari pengguna secara interaktif.
 * Tool membuka wizard bertahap di composer; draft pesan dan progres tetap
 * tersedia saat pengguna menjeda pengisian untuk menulis pesan.
 */
export function createInputRequestTools(context: AiToolContext) {
  return {
    requestUserInput: tool({
      description:
        "Gunakan tool ini ketika pengguna ingin membuat proyek baru, mencatat pengeluaran, membayar tagihan vendor, mencairkan biaya lapangan, atau menerima barang gudang, namun data/parameter yang dibutuhkan belum lengkap. Wizard bertahap tampil di composer. Pengguna dapat menjeda untuk menulis pesan lalu melanjutkan tanpa kehilangan isian. Hasilnya kembali sebagai jawaban pengguna, bukan persetujuan penyimpanan data bisnis.",
      inputSchema: requestUserInputSchema,
      execute: async (args: RequestUserInputPayload) => {
        const normalized = normalizeInputRequestPayload(args);
        if (
          normalized.workflow === "CREATE_PROJECT" &&
          !capabilityAvailable(context, AI_CAPABILITIES.proposeCreateProject)
        )
          return {
            error:
              "Akun ini belum memiliki akses pembuatan proyek beserta budget melalui chat. Izin membuat proyek dan budget dengan akses global diperlukan. Minta admin memeriksa akses; jangan membuka wizard proyek atau memakai Quick Start yang sudah selesai sebagai jalan lain.",
            toolFailed: true,
            code: "FORBIDDEN",
          };
        if (normalized.fields.length === 0)
          return {
            error:
              "Minta detail proyek seperti nama, nilai kontrak dan klien. Budget awal memakai Pengaturan ERP; plafon bukan isian proyek baru.",
          };
        return {
          status: "INPUT_REQUESTED" as const,
          actionTitle: args.actionTitle,
          description: normalized.description ?? "Silakan lengkapi informasi berikut:",
          fields: normalized.fields,
          workflow: normalized.workflow,
          budgetInstruction:
            normalized.workflow === "CREATE_PROJECT"
              ? "Budget awal otomatis memakai Pengaturan ERP aktif. Jangan meminta plafon, margin atau rasio kategori; lanjutkan ke usulan proyek setelah detail proyek lengkap."
              : undefined,
        };
      },
    }),
  };
}
