"use server";

import { db } from "@/db";
import { aiRun } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import { ai } from "@/lib/ai/gemini";
import { getErrorMessage } from "@/lib/utils/error-message";
import { Type } from "@google/genai";
import { eq } from "drizzle-orm";
import { z } from "zod";

interface ParsedReceiptItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ParsedReceipt {
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
 * Memproses gambar nota PM lapangan menggunakan model Gemini 3 Flash Preview.
 * Mengekstrak total biaya, nama toko, tanggal transaksi, dan rincian item belanja.
 *
 * @param receiptImageUrl URL gambar nota dari ImageKit
 * @returns Status respons aksi dan hasil data ekstraksi
 */
export async function processReceipt(
  receiptImageUrl: string,
): Promise<ActionResponse<ParsedReceipt>> {
  if (!receiptImageUrl) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "URL gambar nota wajib disediakan." },
    };
  }

  try {
    // 1. Verifikasi Sesi
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    // 2. Verifikasi Hak Akses PM Lapangan (atau Finance/Owner)
    try {
      await assertPermission(session.user, "create:cost");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // 3. Unduh gambar nota dari URL dan ubah menjadi Base64
    let imageBase64: string;
    let mimeType = "image/jpeg";
    try {
      const imageRes = await fetch(receiptImageUrl);
      if (!imageRes.ok) {
        throw new Error(`Gagal mengunduh gambar nota. Status: ${imageRes.status}`);
      }
      const arrayBuffer = await imageRes.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString("base64");
      mimeType = imageRes.headers.get("content-type") || "image/jpeg";
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: getErrorMessage(err, "Gagal mengunduh gambar nota belanja dari storage CDN."),
        },
      };
    }

    // 4. Catat status awal RUNNING ke tabel ai_run
    const [runLog] = await db
      .insert(aiRun)
      .values({
        runType: "OCR_RECEIPT",
        runById: session.user.id,
        status: "PROCESSING",
        payload: JSON.stringify({ receiptImageUrl }),
        createdAt: new Date(),
      })
      .returning();

    // 5. Panggil Gemini 3 Flash Preview untuk ekstraksi teks nota multimodal
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              vendorName: { type: Type.STRING },
              transactionDate: { type: Type.STRING, description: "Format ISO 8601 UTC string" },
              subtotal: { type: Type.NUMBER },
              tax: { type: Type.NUMBER },
              totalAmount: { type: Type.NUMBER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unitPrice: { type: Type.NUMBER },
                    totalPrice: { type: Type.NUMBER },
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
        throw new Error("Model Gemini mengembalikan respons kosong.");
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
              "Gemini mengembalikan JSON nota yang tidak valid.",
            ),
          })
          .where(eq(aiRun.id, runLog.id));

        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Gemini mengembalikan format JSON nota yang tidak valid. Silakan isi formulir secara manual.",
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
              "Gemini tidak berhasil membaca struktur nota secara lengkap. Silakan isi formulir secara manual.",
          },
        };
      }

      // 6. Update status ai_run menjadi COMPLETED dengan hasil
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
      const genErrorMessage = getErrorMessage(genError, "Gagal memanggil API Gemini.");
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
