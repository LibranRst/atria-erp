import { db } from "@backend/db";
import { aiRun } from "@backend/db/schema";
import { assertPermission } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import { documentModel, requireDocumentProvider } from "@backend/lib/ai/document-model";
import { getErrorMessage } from "@atria/core/utils/error-message";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { readPrivateAttachment } from "@backend/server/usecases/media/private-attachments";
import { checkRateLimit } from "@backend/lib/ai/rate-limit";

export interface ParsedReceiptItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedReceipt {
  vendorName: string;
  transactionDate: string;
  subtotal: number;
  tax: number;
  totalAmount: number;
  items: ParsedReceiptItem[];
}

const parsedReceiptItemSchema = z.object({
  itemName: z.string().min(1),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
});

const parsedReceiptSchema = z.object({
  vendorName: z.string().min(1),
  transactionDate: z.string().datetime(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  totalAmount: z.number().positive(),
  items: z.array(parsedReceiptItemSchema),
});

/**
 * Memproses gambar nota PM lapangan menggunakan provider dan model AI terkonfigurasi.
 * Mengekstrak total biaya, nama toko, tanggal transaksi, dan rincian item belanja.
 *
 * @param actor Identitas pengguna yang sudah diverifikasi server
 * @param receiptImageUrl URL gambar nota dari ImageKit
 * @returns Status respons aksi dan hasil data ekstraksi
 */
export async function processReceiptUseCase(
  actor: Actor,
  receiptImageUrl: string,
): Promise<ActionResponse<ParsedReceipt>> {
  if (!receiptImageUrl) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "URL gambar nota wajib disediakan." },
    };
  }

  try {
    // 1. Verifikasi Hak Akses PM Lapangan (atau Finance/Owner)
    try {
      await assertPermission({ id: actor.userId, roleId: actor.roleId }, "create:cost");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // 2. Unduh gambar nota dari URL dan ubah menjadi Base64
    let imageBase64: string;
    let mimeType = "image/jpeg";
    try {
      if (!checkRateLimit(`ocr:${actor.userId}`).allowed)
        throw new Error("Terlalu banyak scan. Coba lagi sebentar.");
      requireDocumentProvider();
      const privateFile = await readPrivateAttachment(actor, receiptImageUrl, "expense");
      imageBase64 = privateFile.bytes.toString("base64");
      mimeType = privateFile.row.mimeType;
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: getErrorMessage(err, "Gagal membaca gambar nota belanja dari storage privat."),
        },
      };
    }

    // 3. Catat status awal RUNNING ke tabel ai_run
    const [runLog] = await db
      .insert(aiRun)
      .values({
        runType: "OCR_RECEIPT",
        runById: actor.userId,
        status: "PROCESSING",
        payload: JSON.stringify({ receiptImageUrl }),
        createdAt: new Date(),
      })
      .returning();

    // 4. Panggil model AI terkonfigurasi untuk ekstraksi teks nota multimodal
    try {
      const response = await documentModel.models.generateContent({
        contents: [
          {
            inlineData: {
              data: imageBase64,
              mimeType,
            },
          },
          "Ekstrak rincian bukti transaksi dari foto nota/struk belanja di atas. Pastikan format tanggal berupa ISO 8601 UTC string (contoh: 2026-06-10T00:00:00.000Z). Jika nama barang di nota ditulis tidak lengkap, lengkapi sebisanya sesuai konteks belanja.",
        ],
        config: {
          abortSignal: AbortSignal.timeout(40_000),
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              vendorName: { type: "string" },
              transactionDate: { type: "string", description: "Format ISO 8601 UTC string" },
              subtotal: { type: "number" },
              tax: { type: "number" },
              totalAmount: { type: "number" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    itemName: { type: "string" },
                    quantity: { type: "number" },
                    unitPrice: { type: "number" },
                    totalPrice: { type: "number" },
                  },
                  required: ["itemName", "quantity", "unitPrice", "totalPrice"],
                },
              },
            },
            required: ["vendorName", "transactionDate", "subtotal", "tax", "totalAmount", "items"],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Model AI mengembalikan respons kosong.");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseError: unknown) {
        await db
          .update(aiRun)
          .set({
            status: "FAILED",
            errorMessage: getErrorMessage(
              parseError,
              "AI mengembalikan JSON nota yang tidak valid.",
            ),
          })
          .where(eq(aiRun.id, runLog.id));

        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "AI mengembalikan format JSON nota yang tidak valid. Silakan isi formulir secara manual.",
          },
        };
      }

      const parsedReceipt = parsedReceiptSchema.safeParse(parsedJson);
      if (!parsedReceipt.success) {
        await db
          .update(aiRun)
          .set({
            status: "FAILED",
            errorMessage: parsedReceipt.error.message,
          })
          .where(eq(aiRun.id, runLog.id));

        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "AI tidak berhasil membaca struktur nota secara lengkap. Silakan isi formulir secara manual.",
          },
        };
      }

      // 5. Update status ai_run menjadi COMPLETED dengan hasil
      await db
        .update(aiRun)
        .set({
          status: "COMPLETED",
          result: rawText,
          tokensUsed: response.usageMetadata?.totalTokenCount || 0,
        })
        .where(eq(aiRun.id, runLog.id));

      return {
        success: true,
        data: parsedReceipt.data,
      };
    } catch (genError: unknown) {
      const genErrorMessage = getErrorMessage(genError, "Gagal memanggil provider AI.");
      // Update status ai_run menjadi FAILED
      await db
        .update(aiRun)
        .set({
          status: "FAILED",
          errorMessage: genErrorMessage,
        })
        .where(eq(aiRun.id, runLog.id));

      throw genError;
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: getErrorMessage(
          error,
          "Terjadi kesalahan internal saat memproses nota belanja dengan AI.",
        ),
      },
    };
  }
}
