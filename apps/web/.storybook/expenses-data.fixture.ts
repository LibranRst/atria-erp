import type { PermissionKey } from "@atria/core/auth/permissions";
import type {
  BankAccountItem,
  ExpenseCostItem,
  VendorListBill,
  VendorListPayment,
  VendorListVendor,
} from "@atria/core/types/expenses";
import type { ProjectForExpense } from "@/app/actions/project/budget";
import type { ExpenseDraftRecord, ExpenseDraftSummary } from "@/app/actions/finance/expense-drafts";

export type ExpensesFixtureScenario =
  | "complete"
  | "empty"
  | "read-only"
  | "vendor-only"
  | "assigned"
  | "drafts-error"
  | "drafts-loading";
export const expensesFixtureId = (id: number): string =>
  `edf10000-0000-4000-8000-${String(id).padStart(12, "0")}`;

export const EXPENSES_FIXTURE_PERMISSIONS: readonly PermissionKey[] = [
  "view:cost",
  "create:cost",
  "verify:cost",
  "update:cost",
  "pay:cost",
  "approve:cost",
  "view:vendor_bill",
  "create:vendor_bill",
  "update:vendor_bill",
  "pay:vendor_bill",
  "view:bank_account",
  "view:approval_queue",
  "decide:all_approvals",
  "manage:vendors",
];
export const EXPENSES_FIXTURE_READ_PERMISSIONS: readonly PermissionKey[] = [
  "view:cost",
  "view:vendor_bill",
];
export const EXPENSES_FIXTURE_VENDOR_PERMISSIONS: readonly PermissionKey[] = ["view:vendor_bill"];
export const EXPENSES_FIXTURE_ASSIGNED_PERMISSIONS: readonly PermissionKey[] = [
  "view:cost",
  "create:cost",
  "view:vendor_bill",
  "create:vendor_bill",
];

const categories = [
  { code: "MATERIAL", name: "Material" },
  { code: "TUKANG", name: "Tukang" },
  { code: "OPERASIONAL", name: "Operasional" },
  { code: "LAIN_LAIN", name: "Lain-lain" },
  { code: "SUBCON", name: "Subcon" },
] as const;
const projectNames = [
  "Menteng Villa · Kitchen & Living Room",
  "Cipete House · Renovasi Interior",
  "BSD Office · Lantai 2",
];
export const EXPENSES_FIXTURE_PROJECTS: ProjectForExpense[] = projectNames.map((name, index) => ({
  id: expensesFixtureId(100 + index),
  name,
  canonicalBudgets: [
    {
      id: expensesFixtureId(200 + index),
      status: "APPROVED",
      categories: categories.map((category, categoryIndex) => ({
        ...category,
        id: expensesFixtureId(300 + index * 10 + categoryIndex),
        allocatedAmount: "90000000.00",
        pendingAmount: "1200000.25",
        actualAmount: "31500000.25",
        paidAmount: "28400000.00",
        remainingAmount: "58499999.75",
        usedPercentage: "35.00",
        status: "HEALTHY",
        sortOrder: categoryIndex,
      })),
    },
  ],
  materialOptions: [
    { id: expensesFixtureId(550), name: "Multipleks 18 mm", unit: "lembar", availableStock: 14 },
  ],
  rapItems: [],
  categoryPlanItems: [],
  inventoryLocations: [{ id: expensesFixtureId(600), name: "Gudang Workshop" }],
}));
export const EXPENSES_FIXTURE_VENDORS: VendorListVendor[] = [
  "CV Batu Prima Countertop",
  "PT Papan Kayu Nusantara",
  "Budi Interior Subcon",
  "Sentosa Hardware",
].map((name, index) => ({ id: expensesFixtureId(700 + index), name }));
export const EXPENSES_FIXTURE_ACCOUNTS: BankAccountItem[] = [
  {
    id: expensesFixtureId(800),
    name: "BCA Operasional",
    bankName: "BCA",
    accountNumber: "1234567890",
    balance: "425000000.25",
  },
  {
    id: expensesFixtureId(801),
    name: "Mandiri Proyek",
    bankName: "Mandiri",
    accountNumber: "0987654321",
    balance: "182000000.50",
  },
  {
    id: expensesFixtureId(802),
    name: "Kas Workshop",
    bankName: "Kas",
    accountNumber: "",
    balance: "12250000.00",
  },
];
const descriptions = [
  "Multipleks 18 mm untuk kabinet kitchen",
  "Upah instalasi kabinet dan finishing",
  "Transportasi material ke lokasi proyek",
  "Perlengkapan proteksi area kerja",
  "Fabrikasi solid surface countertop",
  "Engsel soft-close dan rel laci",
  "Sewa scaffolding area instalasi",
  "Konsumsi tim pemasangan",
];
const statuses: readonly ExpenseCostItem["status"][] = [
  "SUBMITTED",
  "VERIFIED",
  "APPROVED",
  "SUBMITTED",
  "APPROVED",
  "VERIFIED",
  "PAID",
  "REJECTED",
];
export const EXPENSES_FIXTURE_COSTS: ExpenseCostItem[] = Array.from(
  { length: 36 },
  (_, index): ExpenseCostItem => {
    const projectIndex = index % projectNames.length;
    const project = EXPENSES_FIXTURE_PROJECTS[projectIndex]!;
    const categoryIndex = index % categories.length;
    const category = categories[categoryIndex]!;
    return {
      id: expensesFixtureId(1000 + index),
      amount: ((index + 1) * 475_000 + (index % 3 === 0 ? 0.25 : 0)).toFixed(2),
      description: `${descriptions[index % descriptions.length]} · tahap ${Math.floor(index / descriptions.length) + 1}`,
      receiptImageUrl: index % 3 === 0 ? "/receipt_test.png" : null,
      status: statuses[index % statuses.length]!,
      budgetOverrun: index === 0 || index === 10,
      createdAt: new Date(Date.UTC(2026, 9, 14 - Math.floor(index / 2), 3)),
      project: { id: project.id, name: project.name },
      budgetCategory: {
        id: expensesFixtureId(300 + projectIndex * 10 + categoryIndex),
        expenseCategory: category,
      },
      budgetItem:
        index % 4 === 0
          ? {
              id: expensesFixtureId(1500 + index),
              name: descriptions[index % descriptions.length]!,
              allocatedAmount: "25000000.00",
              actualSpent: "17000000.25",
              costCategory: { name: category.name },
            }
          : null,
      requestedBy: { name: index % 2 === 0 ? "Budi Santoso" : "Agus Pratama" },
    };
  },
);
export const EXPENSES_FIXTURE_PAYMENTS: VendorListPayment[] = Array.from(
  { length: 30 },
  (_, index): VendorListPayment => {
    const project = EXPENSES_FIXTURE_PROJECTS[index % 3]!;
    const vendor = EXPENSES_FIXTURE_VENDORS[index % 4]!;
    const account = EXPENSES_FIXTURE_ACCOUNTS[index % 3]!;
    const status =
      index % 7 === 0
        ? "COMPLETED"
        : index % 7 === 5
          ? "PROCESSING"
          : index % 7 === 6
            ? "FAILED"
            : "PENDING";
    return {
      id: expensesFixtureId(2000 + index),
      vendorBillId: expensesFixtureId(3000 + index),
      bankAccountId: account.id,
      amountPaid: ((index + 1) * 825_000 + 0.25).toFixed(2),
      status,
      paymentDate: new Date(Date.UTC(2026, 9, 12 + (index % 14), 3)),
      referenceNumber: status === "COMPLETED" ? `BCA-202610-${index + 1}` : null,
      approvalStatus: index % 7 === 1 ? "PENDING" : index % 7 === 2 ? "REJECTED" : "APPROVED",
      bankAccount: { name: account.name },
      vendorBill: {
        billNumber: `INV-2026-${String(index + 1).padStart(3, "0")}`,
        vendor: { name: vendor.name },
        project: { name: project.name },
      },
    };
  },
);
export const EXPENSES_FIXTURE_BILLS: VendorListBill[] = Array.from(
  { length: 30 },
  (_, index): VendorListBill => {
    const projectIndex = index % 3;
    const project = EXPENSES_FIXTURE_PROJECTS[projectIndex]!;
    const vendor = EXPENSES_FIXTURE_VENDORS[index % 4]!;
    const payment = EXPENSES_FIXTURE_PAYMENTS[index]!;
    return {
      id: expensesFixtureId(3000 + index),
      vendorId: vendor.id,
      projectId: project.id,
      projectBudgetItemId: null,
      projectBudgetCategoryId: expensesFixtureId(
        300 + projectIndex * 10 + (index % 2 === 0 ? 0 : 4),
      ),
      billNumber: `INV-2026-${String(index + 1).padStart(3, "0")}`,
      amount: (
        Number(payment.amountPaid) * (payment.status === "COMPLETED" && index % 2 === 0 ? 1 : 2)
      ).toFixed(2),
      status:
        payment.status === "COMPLETED"
          ? index % 2 === 0
            ? "PAID"
            : "PARTIALLY_PAID"
          : index === 29
            ? "VOID"
            : "UNPAID",
      dueDate: new Date(Date.UTC(2026, 9, 5 + (index % 24), 3)),
      notes:
        index % 2 === 0
          ? "Tagihan material tahap pemasangan. Cocokkan dengan barang yang diterima."
          : "Termin fabrikasi dan instalasi sesuai lingkup yang disepakati.",
      vendor: { name: vendor.name },
      project: { name: project.name },
      budgetItem: null,
      payments: [payment],
    };
  },
);
export const EXPENSES_FIXTURE_DRAFTS: readonly ExpenseDraftSummary[] = [0, 1].map((index) => ({
  id: expensesFixtureId(4000 + index),
  revision: 2,
  projectId: EXPENSES_FIXTURE_PROJECTS[index]!.id,
  projectName: EXPENSES_FIXTURE_PROJECTS[index]!.name,
  itemCount: 2,
  totalAmount: 1_900_000.25,
  hasReceipt: index === 0,
  lastSavedAt: new Date(Date.UTC(2026, 9, 14, 2, 20 + index)),
}));

export function expensesFixtureDraft(id: string): ExpenseDraftRecord {
  const summary =
    EXPENSES_FIXTURE_DRAFTS.find((draft) => draft.id === id) ?? EXPENSES_FIXTURE_DRAFTS[0]!;
  const project = EXPENSES_FIXTURE_PROJECTS.find(
    (candidate) => candidate.id === summary.projectId,
  )!;
  return {
    id: summary.id,
    revision: summary.revision,
    lastSavedAt: summary.lastSavedAt,
    payload: {
      projectId: summary.projectId,
      inputMode: "MANUAL",
      receipt: null,
      ocrWarning: null,
      lines: [0, 1].map((index) => ({
        key: `fixture-line-${index}`,
        projectBudgetCategoryId: project.canonicalBudgets![0]!.categories![2]!.id,
        projectBudgetItemId: "",
        materialId: "",
        projectRapItemId: "",
        projectCategoryPlanItemId: "",
        stockHandling: "EXPENSE_ONLY",
        inventoryLocationId: "",
        quantity: 1,
        unitPrice: index === 0 ? 950_000.25 : 950_000,
        amount: index === 0 ? 950_000.25 : 950_000,
        description: index === 0 ? "Transportasi material ke lokasi" : "Sewa alat instalasi",
      })),
    },
  };
}

export function expensesFixtureData(scenario: ExpensesFixtureScenario): {
  readonly costs: ExpenseCostItem[];
  readonly bills: VendorListBill[];
  readonly payments: VendorListPayment[];
  readonly accounts: BankAccountItem[];
  readonly projects: ProjectForExpense[];
  readonly vendors: VendorListVendor[];
} {
  if (scenario === "empty")
    return {
      costs: [],
      bills: [],
      payments: [],
      accounts: EXPENSES_FIXTURE_ACCOUNTS,
      projects: EXPENSES_FIXTURE_PROJECTS,
      vendors: EXPENSES_FIXTURE_VENDORS,
    };
  const assigned = scenario === "assigned";
  const exposeBanks = scenario !== "read-only" && scenario !== "vendor-only" && !assigned;
  const bills = assigned
    ? EXPENSES_FIXTURE_BILLS.filter((bill) => bill.projectId === EXPENSES_FIXTURE_PROJECTS[0]!.id)
    : EXPENSES_FIXTURE_BILLS;
  const billIds = new Set(bills.map((bill) => bill.id));
  const redact = (payment: VendorListPayment): VendorListPayment =>
    exposeBanks ? payment : { ...payment, bankAccountId: "", bankAccount: null };
  return {
    costs:
      scenario === "vendor-only"
        ? []
        : assigned
          ? EXPENSES_FIXTURE_COSTS.filter((cost) => cost.requestedBy?.name === "Budi Santoso")
          : EXPENSES_FIXTURE_COSTS,
    bills: bills.map((bill) => ({ ...bill, payments: bill.payments?.map(redact) })),
    payments: EXPENSES_FIXTURE_PAYMENTS.filter((payment) => billIds.has(payment.vendorBillId)).map(
      redact,
    ),
    accounts: exposeBanks ? EXPENSES_FIXTURE_ACCOUNTS : [],
    projects: assigned ? EXPENSES_FIXTURE_PROJECTS.slice(0, 1) : EXPENSES_FIXTURE_PROJECTS,
    vendors: EXPENSES_FIXTURE_VENDORS,
  };
}
