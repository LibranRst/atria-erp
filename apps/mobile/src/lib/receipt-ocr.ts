import { privateAttachmentResultSchema } from "@atria/core/media/private-attachment";
import { z } from "zod";
import { getApiBaseURL } from "@/lib/runtime-config";
import { getSessionBearerToken } from "@/lib/auth-client";
import { inferExpenseCategoryCode } from "@atria/core/expenses/receipt-category";
import type { ExpenseLine, ProjectBudgetCategoryOption } from "@atria/core/types/expenses";
import { createClientId } from "@atria/core/utils/client-id";
import type { ImagePickerAsset } from "expo-image-picker";

import { trpcClient } from "@/lib/trpc-client";

export type ReceiptOcrResult = {
  readonly attachment: {
    readonly fileId: string;
    readonly url: string;
    readonly fileName: string;
    readonly mimeType: string;
    readonly size: number;
  };
  readonly lines: readonly ExpenseLine[];
  readonly warning: string | null;
};

export async function uploadAndParseReceipt(
  asset: ImagePickerAsset,
  categories: readonly ProjectBudgetCategoryOption[],
  projectId: string,
): Promise<ReceiptOcrResult> {
  const fileName = asset.fileName ?? `receipt-${Date.now()}.jpg`;
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const token = getSessionBearerToken();
  if (!token) throw new Error("Silakan masuk kembali.");
  const ticketResponse = await fetch(`${getApiBaseURL()}/api/media/upload-ticket`, {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ purpose: "expense", projectId, fileName, size: blob.size }),
  });
  const ticket = z
    .object({ ticket: z.string(), uploadUrl: z.string().url() })
    .safeParse(await ticketResponse.json());
  if (!ticketResponse.ok || !ticket.success) throw new Error("Tiket unggah belum tersedia.");
  const form = new FormData();
  form.append("file", blob, fileName);
  const response = await fetch(ticket.data.uploadUrl, {
    method: "POST",
    headers: { "x-atria-upload-ticket": ticket.data.ticket },
    signal: AbortSignal.timeout(60_000),
    body: form,
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      z.object({ error: z.string() }).safeParse(data).data?.error ??
        "Gambar bukti belum berhasil diunggah.",
    );
  const attachment = privateAttachmentResultSchema.parse(data);
  const ocr = await trpcClient.ai.processReceipt.mutate({ receiptImageUrl: attachment.url });
  if (!ocr.success) {
    return {
      attachment,
      lines: [],
      warning: `Bukti sudah tersimpan, tetapi belum berhasil dibaca. ${ocr.error.message}`,
    };
  }

  let unmatchedCount = 0;
  const lines: ExpenseLine[] = ocr.data.items.map((item) => {
    const categoryCode = inferExpenseCategoryCode(item.itemName);
    const category = categories.find((candidate) => candidate.code === categoryCode);
    if (!category) unmatchedCount += 1;
    return {
      key: createClientId("expense-line"),
      projectBudgetCategoryId: category?.id ?? "",
      projectBudgetItemId: "",
      materialId: "",
      projectRapItemId: "",
      projectCategoryPlanItemId: "",
      stockHandling: "EXPENSE_ONLY",
      inventoryLocationId: "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || "",
      amount: item.totalPrice || item.unitPrice * item.quantity || "",
      description: `[OCR] ${item.itemName}`,
    };
  });
  if (lines.length === 0) {
    lines.push({
      key: createClientId("expense-line"),
      projectBudgetCategoryId: "",
      projectBudgetItemId: "",
      materialId: "",
      projectRapItemId: "",
      projectCategoryPlanItemId: "",
      stockHandling: "EXPENSE_ONLY",
      inventoryLocationId: "",
      quantity: 1,
      unitPrice: ocr.data.totalAmount,
      amount: ocr.data.totalAmount,
      description: `[OCR] Pembelian di ${ocr.data.vendorName}`,
    });
  }

  return {
    attachment,
    lines,
    warning:
      unmatchedCount > 0
        ? `${unmatchedCount} item belum cocok dengan kategori budget. Periksa sebelum mengajukan.`
        : null,
  };
}

/** Native previews keep bearer credentials on the authenticated API origin. */
export function receiptImageSource(
  url: string,
): string | { readonly uri: string; readonly headers: Readonly<Record<string, string>> } {
  if (!url) return "";
  const parsed = new URL(url);
  if (!parsed.pathname.startsWith("/api/media/attachments/")) return url;
  const token = getSessionBearerToken();
  return {
    uri: new URL(parsed.pathname, getApiBaseURL()).href,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}
