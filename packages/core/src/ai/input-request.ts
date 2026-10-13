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
  visibleWhen: z
    .object({ fieldKey: z.string(), equals: z.string() })
    .optional()
    .describe("Tampilkan field hanya ketika pilihan field lain memiliki nilai ini."),
  groupWith: z
    .string()
    .optional()
    .describe("Kunci field utama; field ini tampil di bawahnya dalam langkah yang sama."),
});

export type InputField = z.infer<typeof inputFieldSchema>;

export const requestUserInputSchema = z.object({
  workflow: z
    .literal("CREATE_PROJECT")
    .optional()
    .describe(
      "Gunakan CREATE_PROJECT untuk wizard proyek baru. Plafon dan alokasi budget mengikuti Pengaturan ERP, bukan input wizard.",
    ),
  actionTitle: z
    .string()
    .describe("Judul aksi yang sedang dipersiapkan (misal: Buat Proyek Baru, Catat Pengeluaran)"),
  description: z.string().optional().describe("Penjelasan singkat mengapa data ini dibutuhkan"),
  fields: z
    .array(inputFieldSchema)
    .min(1)
    .max(10)
    .describe("Daftar field input yang dibutuhkan dari pengguna"),
});

export type RequestUserInputPayload = z.infer<typeof requestUserInputSchema>;
