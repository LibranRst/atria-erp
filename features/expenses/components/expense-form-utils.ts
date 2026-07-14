import type {
  ExpenseDraftPayload,
  ExpenseLine,
  ProjectBudgetItem,
} from "@/features/expenses/components/expense-form-types";
import { createClientId } from "@/lib/utils/client-id";

export const STOCK_HANDLING_OPTIONS: ReadonlyArray<{
  readonly value: ExpenseLine["stockHandling"];
  readonly label: string;
  readonly description: string;
}> = [
  {
    value: "EXPENSE_ONLY",
    label: "Biaya saja",
    description: "Catat biaya tanpa mengubah stok.",
  },
  { value: "STOCK_IN", label: "Masuk stok", description: "Tambah barang ke lokasi stok." },
  {
    value: "DIRECT_USE",
    label: "Langsung dipakai",
    description: "Barang langsung terpakai untuk proyek.",
  },
  {
    value: "RESERVE_FOR_PROJECT",
    label: "Reservasi",
    description: "Tahan stok untuk kebutuhan proyek ini.",
  },
];

export function isExpenseLineComplete(
  line: ExpenseLine,
  categoryCode?: string,
): boolean {
  const baseComplete =
    Boolean(line.projectBudgetCategoryId) &&
    line.description.trim().length >= 5 &&
    line.quantity !== "" &&
    Number(line.quantity) > 0 &&
    line.unitPrice !== "" &&
    Number(line.unitPrice) >= 0 &&
    line.amount !== "" &&
    Number(line.amount) > 0;
  if (!baseComplete) return false;
  if (categoryCode !== "MATERIAL" || line.stockHandling === "EXPENSE_ONLY") {
    return true;
  }
  return Boolean(line.materialId) && Boolean(line.inventoryLocationId);
}

export function calculateExpenseLineAmount(
  quantity: ExpenseLine["quantity"],
  unitPrice: ExpenseLine["unitPrice"],
): number {
  return (Number(quantity) || 0) * (Number(unitPrice) || 0);
}

export function mergeExpenseLines(
  current: readonly ExpenseLine[],
  scanned: readonly ExpenseLine[],
  mode: "APPEND" | "REPLACE",
): ExpenseLine[] {
  if (mode === "REPLACE") return [...scanned];
  const meaningfulCurrent = current.filter(
    (line) =>
      line.description.trim().length > 0 ||
      line.projectBudgetCategoryId.length > 0 ||
      Number(line.amount) > 0,
  );
  return [...meaningfulCurrent, ...scanned];
}

export function createBlankExpenseLine(): ExpenseLine {
  return {
    key: createClientId("expense-line"),
    projectBudgetCategoryId: "",
    projectBudgetItemId: "",
    materialId: "",
    projectRapItemId: "",
    projectCategoryPlanItemId: "",
    stockHandling: "EXPENSE_ONLY",
    inventoryLocationId: "",
    quantity: 1,
    unitPrice: "",
    amount: "",
    description: "",
  };
}

export function createBlankExpenseDraft(projectId = ""): ExpenseDraftPayload {
  return {
    projectId,
    inputMode: "MANUAL",
    receipt: null,
    lines: [createBlankExpenseLine()],
    ocrWarning: null,
  };
}

export function findMatchingBudgetItem(
  itemName: string,
  budgetItems: ProjectBudgetItem[],
): ProjectBudgetItem | undefined {
  const normalizedItemName = itemName.toLowerCase().trim();
  if (!normalizedItemName) return undefined;

  let match = budgetItems.find((budgetItem) => {
    const budgetItemName = budgetItem.name.toLowerCase().trim();
    return (
      budgetItemName.includes(normalizedItemName) ||
      normalizedItemName.includes(budgetItemName)
    );
  });

  if (!match) {
    const words = normalizedItemName.split(/\s+/).filter((word) => word.length > 2);
    for (const word of words) {
      match = budgetItems.find((budgetItem) =>
        budgetItem.name.toLowerCase().includes(word),
      );
      if (match) break;
    }
  }

  return match;
}

export function cleanLeadingZeros(value: string): string {
  if (!value) return "";
  let cleaned = value.replace(/^0+(?=\d)/, "");
  if (cleaned.startsWith(".")) {
    cleaned = `0${cleaned}`;
  }
  return cleaned;
}

export function mapBudgetItemToCanonicalCode(
  item: ProjectBudgetItem | undefined,
): string {
  const source =
    `${item?.costCategory?.name ?? ""} ${item?.budgetCategory ?? ""} ${item?.name ?? ""}`.toUpperCase();
  if (
    source.includes("MATERIAL") ||
    source.includes("BAHAN") ||
    source.includes("KAYU") ||
    source.includes("KACA")
  ) {
    return "MATERIAL";
  }
  if (
    source.includes("TUKANG") ||
    source.includes("LABOR") ||
    source.includes("PEKERJA")
  ) {
    return "TUKANG";
  }
  if (
    source.includes("OPERASIONAL") ||
    source.includes("OPERATIONAL") ||
    source.includes("BENSIN") ||
    source.includes("TOLL")
  ) {
    return "OPERASIONAL";
  }
  if (source.includes("SUBCON") || source.includes("SUBKON")) return "SUBCON";
  return "LAIN_LAIN";
}
