import { tool } from "ai";
import { z } from "zod";

export const inputFieldSchema = z.object({
  key: z.string().describe("Kunci pengenal unik field (misal: projectName, amount, category)"),
  label: z.string().describe("Label ramah pengguna untuk field input"),
  type: z
    .enum(["text", "currency", "number", "date", "select"])
    .describe("Tipe masukan data yang dibutuhkan"),
  placeholder: z.string().optional().describe("Teks contoh petunjuk di dalam kotak input"),
  defaultValue: z.string().optional().describe("Nilai bawaan bila ada"),
  options: z
    .array(
      z.object({
        label: z.string().describe("Teks pilihan yang ditampilkan"),
        value: z.string().describe("Nilai dari pilihan"),
      }),
    )
    .optional()
    .describe("Daftar opsi jika tipe input adalah 'select'"),
  required: z.boolean().default(true).describe("Apakah field ini wajib diisi"),
});

export type InputField = z.infer<typeof inputFieldSchema>;

export const requestUserInputSchema = z.object({
  actionTitle: z
    .string()
    .describe("Judul aksi yang sedang dipersiapkan (misal: Buat Proyek Baru, Catat Pengeluaran)"),
  description: z.string().optional().describe("Penjelasan singkat mengapa data ini dibutuhkan"),
  fields: z
    .array(inputFieldSchema)
    .min(1)
    .max(8)
    .describe("Daftar field input yang dibutuhkan dari pengguna"),
});

export type RequestUserInputPayload = z.infer<typeof requestUserInputSchema>;

/**
 * Tool AI untuk meminta masukan data multi-field dari pengguna secara interaktif.
 * Ketika AI memanggil tool ini, bilah chatbar di layar pengguna akan bertransformasi
 * menjadi form input langkah demi langkah.
 */
export function createInputRequestTools() {
  return {
    requestUserInput: tool({
      description:
        "Gunakan tool ini ketika pengguna ingin membuat proyek baru, mencatat pengeluaran, membayar tagihan vendor, mencairkan biaya lapangan, atau menerima barang gudang, namun data/parameter yang dibutuhkan belum lengkap. Pemanggilan tool ini akan mengubah chatbar pengguna menjadi input interaktif langkah-demi-langkah.",
      inputSchema: requestUserInputSchema,
      execute: async (args: RequestUserInputPayload) => {
        return {
          status: "INPUT_REQUESTED" as const,
          actionTitle: args.actionTitle,
          description: args.description ?? "Silakan lengkapi informasi berikut:",
          fields: args.fields,
        };
      },
    }),
  };
}
