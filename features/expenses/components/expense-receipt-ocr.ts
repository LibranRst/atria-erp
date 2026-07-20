import { processReceipt } from "@/app/actions/ai/process-receipt";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import type { ExpenseLine, ExpenseFormProject } from "./expense-form-types";
import { inferExpenseCategoryCode } from "./expense-form-utils";

type BudgetCategory = NonNullable<NonNullable<ExpenseFormProject["canonicalBudgets"]>[number]["categories"]>[number];

type ImageKitUploadResponse = {
  readonly fileId: string;
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly fileType?: string;
  readonly message?: string;
};

export type ExpenseReceiptOcrResult = {
  readonly attachment: {
    readonly fileId: string;
    readonly url: string;
    readonly fileName: string;
    readonly mimeType: string;
    readonly size: number;
  };
  readonly lines: ExpenseLine[];
  readonly warning: string | null;
};

export async function uploadAndParseExpenseReceipt({
  file,
  budgetCategories,
}: {
  readonly file: File;
  readonly budgetCategories: readonly BudgetCategory[];
}): Promise<ExpenseReceiptOcrResult> {
  const signRes = await signImagekit();
  if (!signRes.success) {
    throw new Error(signRes.error.message || "Gagal melakukan otentikasi unggah berkas.");
  }

  const { token, expire, signature } = signRes.data;
  const safeFileName = `receipt-${new Date().getTime()}-${file.name.replaceAll(" ", "_")}`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", safeFileName);
  formData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_PRvr9hXwFetaQx4ZejdGwJ1Ue8=");
  formData.append("signature", signature);
  formData.append("token", token);
  formData.append("expire", expire.toString());
  formData.append("folder", "/field-receipts");

  const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const errData = (await uploadRes.json()) as Partial<ImageKitUploadResponse>;
    throw new Error(errData.message || "Gagal mengunggah gambar ke storage CDN.");
  }

  const uploadData = (await uploadRes.json()) as ImageKitUploadResponse;
  const imageUrl = uploadData.url;
  const attachment = {
    fileId: uploadData.fileId,
    url: imageUrl,
    fileName: uploadData.name || safeFileName,
    mimeType: file.type || uploadData.fileType || "image/jpeg",
    size: uploadData.size || file.size,
  };
  const ocrRes = await processReceipt(imageUrl);

  if (!ocrRes.success) {
    return {
      attachment,
      lines: [],
      warning: `Nota sudah terunggah, tetapi isinya belum berhasil dibaca. Isi item secara manual atau coba scan lagi. ${ocrRes.error?.message ?? ""}`.trim(),
    };
  }

  const parsedData = ocrRes.data;
  const ocrItems = parsedData.items || [];
  let unmatchedCount = 0;
  const lines: ExpenseLine[] = ocrItems.map((item) => {
    const categoryCode = inferExpenseCategoryCode(item.itemName);
    const matchingCategory = budgetCategories.find((category) => category.code === categoryCode);
    if (!matchingCategory) unmatchedCount++;

    return {
      key: crypto.randomUUID(),
      projectBudgetCategoryId: matchingCategory?.id ?? "",
      projectBudgetItemId: "",
      materialId: "",
      projectRapItemId: "",
      projectCategoryPlanItemId: "",
      stockHandling: "EXPENSE_ONLY",
      inventoryLocationId: "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || "",
      amount: item.totalPrice || (item.unitPrice * item.quantity) || "",
      description: `[OCR] ${item.itemName}`,
    };
  });

  if (lines.length === 0) {
    lines.push({
      key: crypto.randomUUID(),
      projectBudgetCategoryId: "",
      projectBudgetItemId: "",
      materialId: "",
      projectRapItemId: "",
      projectCategoryPlanItemId: "",
      stockHandling: "EXPENSE_ONLY",
      inventoryLocationId: "",
      quantity: 1,
      unitPrice: parsedData.totalAmount || "",
      amount: parsedData.totalAmount || "",
      description: `[OCR] Pembelian di ${parsedData.vendorName}`,
    });
  }

  let warning: string | null = null;
  if (unmatchedCount > 0) {
    warning = unmatchedCount === ocrItems.length
      ? `Semua item nota (${ocrItems.length} item) tidak cocok dengan item anggaran proyek. Silakan pilih item anggaran secara manual.`
      : `Terdeteksi ${unmatchedCount} dari ${ocrItems.length} item nota yang tidak cocok dengan anggaran proyek. Silakan pilih item anggaran secara manual.`;
  }

  return {
    attachment,
    lines,
    warning,
  };
}
