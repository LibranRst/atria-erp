import { processReceipt } from "@/app/actions/ai/process-receipt";
import { uploadToImageKit } from "@/lib/media/upload-to-imagekit";
import type { ExpenseLine, ExpenseFormProject } from "../types/expense-form-types";
import { inferExpenseCategoryCode } from "@/features/expenses/utils/expense-form-utils";

type BudgetCategory = NonNullable<
  NonNullable<ExpenseFormProject["canonicalBudgets"]>[number]["categories"]
>[number];

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
  projectId,
}: {
  readonly file: File;
  readonly budgetCategories: readonly BudgetCategory[];
  readonly projectId: string;
}): Promise<ExpenseReceiptOcrResult> {
  const attachment = await uploadToImageKit({
    file,
    folder: "/field-receipts",
    fileNamePrefix: "receipt",
    subject: "nota",
    projectId,
  });
  const imageUrl = attachment.url;
  const ocrRes = await processReceipt(imageUrl);

  if (!ocrRes.success) {
    return {
      attachment,
      lines: [],
      warning:
        `Nota sudah terunggah, tetapi isinya belum berhasil dibaca. Isi item secara manual atau coba scan lagi. ${ocrRes.error?.message ?? ""}`.trim(),
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
      amount: item.totalPrice || item.unitPrice * item.quantity || "",
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
    warning =
      unmatchedCount === ocrItems.length
        ? `Semua item nota (${ocrItems.length} item) tidak cocok dengan item anggaran proyek. Silakan pilih item anggaran secara manual.`
        : `Terdeteksi ${unmatchedCount} dari ${ocrItems.length} item nota yang tidak cocok dengan anggaran proyek. Silakan pilih item anggaran secara manual.`;
  }

  return {
    attachment,
    lines,
    warning,
  };
}
