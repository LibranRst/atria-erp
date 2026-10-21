import {
  toExpenseSubmission,
  type ExpenseDraftPayloadInput,
} from "@atria/core/validations/expense-draft";
import { submitFieldRequestsSchema } from "@atria/core/validations/finance";

/** Presentation errors reuse the submission schema; totals point at the editable price. */
export function validateExpenseForm(payload: ExpenseDraftPayloadInput): {
  readonly errors: Record<string, string>;
  readonly firstField?: string;
} {
  const result = submitFieldRequestsSchema.safeParse(toExpenseSubmission(payload));
  const errors: Record<string, string> = {};
  const labels: Readonly<Record<string, string>> = {
    project: "Pilih proyek untuk biaya ini.",
    projectBudgetCategoryId: "Pilih kategori budget.",
    materialId: "Pilih material.",
    inventoryLocationId: "Pilih lokasi stok.",
    amount: "Isi harga satuan agar total biaya lebih dari 0.",
  };
  if (!result.success) {
    for (const issue of result.error.issues) {
      const index =
        issue.path[0] === "items" && typeof issue.path[1] === "number" ? issue.path[1] : undefined;
      const line = index === undefined ? undefined : payload.lines[index];
      const property = line ? String(issue.path[2] ?? "description") : "project";
      const target = property === "amount" ? "unitPrice" : property;
      const field = line ? `${line.key}.${target}` : "project";
      errors[field] ??= labels[property] ?? issue.message;
    }
  }
  for (const line of payload.lines) {
    if (line.stockHandling === "EXPENSE_ONLY") continue;
    if (!line.materialId) errors[`${line.key}.materialId`] = labels.materialId;
    if (!line.inventoryLocationId)
      errors[`${line.key}.inventoryLocationId`] = labels.inventoryLocationId;
  }
  const order = [
    "project",
    ...payload.lines.flatMap((line) =>
      [
        "projectBudgetCategoryId",
        "description",
        "quantity",
        "unitPrice",
        "materialId",
        "inventoryLocationId",
      ].map((field) => `${line.key}.${field}`),
    ),
  ];
  return { errors, firstField: order.find((field) => Boolean(errors[field])) };
}
