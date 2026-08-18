import { inferExpenseCategoryCode } from "@atria/core/expenses/receipt-category";
import type { ExpenseLine, ProjectBudgetCategoryOption } from "@atria/core/types/expenses";
import { createClientId } from "@atria/core/utils/client-id";
import type { ImagePickerAsset } from "expo-image-picker";

import { trpcClient } from "@/lib/trpc-client";

type ImageKitUploadResponse = {
  readonly fileId: string;
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly fileType?: string;
  readonly message?: string;
};

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
): Promise<ReceiptOcrResult> {
  const signature = await trpcClient.media.signImagekit.mutate();
  if (!signature.success) throw new Error(signature.error.message);

  const fileName = asset.fileName ?? `receipt-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? "image/jpeg";
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("fileName", `receipt-${Date.now()}-${fileName.replaceAll(" ", "_")}`);
  formData.append(
    "publicKey",
    process.env.EXPO_PUBLIC_IMAGEKIT_PUBLIC_KEY ?? "public_PRvr9hXwFetaQx4ZejdGwJ1Ue8=",
  );
  formData.append("signature", signature.data.signature);
  formData.append("token", signature.data.token);
  formData.append("expire", String(signature.data.expire));
  formData.append("folder", "/field-receipts");

  const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: formData,
  });
  const uploadData = (await uploadResponse.json()) as ImageKitUploadResponse;
  if (!uploadResponse.ok) {
    throw new Error(uploadData.message ?? "Gambar bukti belum berhasil diunggah.");
  }

  const attachment = {
    fileId: uploadData.fileId,
    url: uploadData.url,
    fileName: uploadData.name || fileName,
    mimeType: uploadData.fileType || mimeType,
    size: uploadData.size || asset.fileSize || blob.size,
  };
  const ocr = await trpcClient.ai.processReceipt.mutate({ receiptImageUrl: uploadData.url });
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
