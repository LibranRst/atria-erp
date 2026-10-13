import { administrationProposalSchema } from "@atria/core/ai/administration";
import { financeInputProposalSchema } from "@atria/core/ai/finance-input";
import { expect, test } from "bun:test";
import { proposalReviewFlow, type ProposalReviewFlow } from "./proposal-review-flow";
import {
  catalogSettingsProposalSchema,
  type CatalogSettingsInput,
} from "@atria/core/ai/catalog-settings";
import { procurementWarehouseProposalSchema } from "@atria/core/ai/procurement-warehouse";
import { projectStockProposalSchema } from "@atria/core/ai/project-stock";
import { setupProposalSchema } from "@atria/core/ai/rap-finalization";
import { lifecycleProposalSchema } from "@atria/core/ai/rap-lifecycle";
import { rapChangeProposalSchema } from "@atria/core/ai/rap-change";
import { rabWorkflowProposalSchema } from "@atria/core/ai/rab-workflow";
const id = "10000000-0000-4000-8000-000000000001",
  other = "20000000-0000-4000-8000-000000000002",
  hash = "a".repeat(64);
const direct: ProposalReviewFlow = { review: "inline", confirmation: "direct" },
  protectedInline: ProposalReviewFlow = { review: "inline", confirmation: "dialog" };
test("stored vendor documentary changes stay inline; money protects and larger/risk patches retain review", () => {
  const p = procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: "VENDOR_BILL_CORRECT",
    input: {
      action: "VENDOR_BILL_CORRECT",
      vendorBillId: id,
      patch: { notes: "Koreksi dokumen" },
      reason: "Sesuai invoice pemasok terbaru",
    },
    title: "Koreksi tagihan",
    entityName: "Proyek",
    meta: "INV-QA",
    contextHash: hash,
    effect: "Kas tetap",
    projectId: id,
    rows: [
      {
        id: "notes",
        title: "Catatan",
        meta: "Koreksi dokumen",
        amount: null,
        comparisons: [],
        details: [],
      },
    ],
    summary: [],
    budget: null,
  });
  expect(proposalReviewFlow(p)).toEqual(direct);
  const money = {
    ...p,
    rows: [
      { ...p.rows[0], comparisons: [{ label: "Nominal", before: 100, after: 120, money: true }] },
    ],
  };
  expect(proposalReviewFlow(money)).toEqual(protectedInline);
  expect(
    proposalReviewFlow({
      ...money,
      summary: [{ label: "Melebihi alokasi termasuk pending", value: 10, money: true }],
    }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
  expect(
    proposalReviewFlow({
      ...p,
      rows: [p.rows[0], { ...p.rows[0], id: "date" }, { ...p.rows[0], id: "number" }],
    }),
  ).toEqual({ review: "sheet", confirmation: "direct" });
});
test("warehouse receipts and opening posting/reversal protect physical stock; opening requests retain batch review", () => {
  const base = {
    kind: "PROCUREMENT_WAREHOUSE",
    title: "Stok masuk",
    entityName: "Gudang",
    meta: "SJ-QA",
    projectId: null,
    contextHash: hash,
    effect: "Stok berubah; kas tetap.",
    rows: [{ id, title: "Panel", meta: "lembar", amount: 20, comparisons: [], details: [] }],
    summary: [],
    budget: null,
  };
  const input = {
    action: "WAREHOUSE_STOCK_IN",
    inventoryLocationId: id,
    referenceNumber: "SJ-QA",
    receivedAt: "2026-10-11",
    note: "Sumber surat jalan vendor",
    items: [{ materialId: id, quantity: 1, unitCost: 20 }],
  };
  const proposal = procurementWarehouseProposalSchema.parse({
    ...base,
    action: input.action,
    input,
  });
  expect(proposalReviewFlow(proposal)).toEqual(protectedInline);
  expect(
    proposalReviewFlow({
      ...proposal,
      rows: [...proposal.rows, { ...proposal.rows[0], id: other }],
    }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
  for (const action of ["OPENING_APPROVE", "OPENING_REVERSE"]) {
    const p = procurementWarehouseProposalSchema.parse({
      ...base,
      action,
      input: { action, batchId: id, reason: "Dokumen sumber diperiksa ulang" },
    });
    expect(proposalReviewFlow(p)).toEqual(protectedInline);
  }
  const request = procurementWarehouseProposalSchema.parse({
    ...base,
    action: "OPENING_REQUEST",
    input: {
      action: "OPENING_REQUEST",
      batchNumber: "SA-QA",
      referenceNumber: "OPNAME-QA",
      cutoverDate: "2026-10-11",
      note: "Stok awal diukur petugas",
      items: [{ materialInventoryId: id, quantity: 1, unitCost: 20 }],
    },
  });
  expect(proposalReviewFlow(request)).toEqual(direct);
  expect(
    proposalReviewFlow({ ...request, rows: [...request.rows, { ...request.rows[0], id: other }] }),
  ).toEqual({ review: "sheet", confirmation: "direct" });
});
function catalog(input: CatalogSettingsInput) {
  return catalogSettingsProposalSchema.parse({
    kind: "CATALOG_SETTINGS",
    action: input.action,
    input,
    title: "Koreksi",
    entityName: "Contoh",
    meta: "Data",
    contextHash: hash,
    effect: "Data diperbarui; kas tetap.",
    rows: [{ id, title: "Contoh", meta: "Data", amount: null, comparisons: [], details: [] }],
    summary: [],
  });
}
test("small catalog decisions are direct, bank/valuation retain one confirmation, large patches keep review", () => {
  expect(
    proposalReviewFlow(catalog({ action: "VENDOR_STATUS", vendorId: id, isActive: false })),
  ).toEqual(direct);
  expect(
    proposalReviewFlow(
      catalog({ action: "VENDOR_EDIT", vendorId: id, patch: { phone: "081234567" } }),
    ),
  ).toEqual(direct);
  expect(
    proposalReviewFlow(
      catalog({ action: "VENDOR_EDIT", vendorId: id, patch: { bankAccountNumber: "12345" } }),
    ),
  ).toEqual(protectedInline);
  expect(
    proposalReviewFlow(
      catalog({
        action: "INVENTORY_DEFAULTS",
        materialInventoryId: id,
        minimumStock: 5,
        lastPurchasePrice: 20,
      }),
    ),
  ).toEqual(direct);
  expect(
    proposalReviewFlow(
      catalog({
        action: "INVENTORY_VALUATION",
        materialInventoryId: id,
        averageCost: 20,
        reason: "Koreksi berdasarkan bukti",
      }),
    ),
  ).toEqual(protectedInline);
  expect(
    proposalReviewFlow(
      catalog({
        action: "VENDOR_EDIT",
        vendorId: id,
        patch: { name: "Contoh", phone: "081234567", email: null, address: "Alamat baru" },
      }),
    ).review,
  ).toBe("sheet");
  expect(
    proposalReviewFlow(
      catalog({ action: "LIBRARY_EDIT", itemPriceLibraryId: id, patch: { materialId: other } }),
    ).review,
  ).toBe("sheet");
});
const stock = projectStockProposalSchema.parse({
  kind: "PROJECT_STOCK",
  projectId: id,
  projectName: "Proyek",
  action: "USE",
  expectedContext: hash,
  input: {
    projectId: id,
    action: "USE",
    rows: [{ materialId: id, inventoryLocationId: id, quantity: 2, note: "Penggunaan proyek" }],
  },
  rows: [
    {
      id,
      materialName: "Panel",
      locationName: "Gudang",
      unit: "lembar",
      quantity: 2,
      unitCost: 10,
      costOverride: false,
      note: "Penggunaan proyek",
      sourceLabel: "RAP Dapur",
      before: { current: 100, reserved: 10, available: 90, ownReserved: 4, netUsed: 0 },
      after: { current: 98, reserved: 8, available: 90, ownReserved: 2, netUsed: 2 },
    },
  ],
  budget: null,
  costEffect: "DEBIT",
});
test("one physical stock action is protected inline; batch stays in review and quota-only release is direct", () => {
  expect(proposalReviewFlow(stock)).toEqual(protectedInline);
  expect(
    proposalReviewFlow({ ...stock, rows: [stock.rows[0], { ...stock.rows[0], id: other }] }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
  expect(
    proposalReviewFlow({
      ...stock,
      action: "RELEASE_RESERVATION",
      input: { ...stock.input, action: "RELEASE_RESERVATION" },
    }),
  ).toEqual(direct);
});
test("a document request/rejection is inline even with many source items; stock reversal approval reviews multiple effects", () => {
  const p = procurementWarehouseProposalSchema.parse({
    kind: "PROCUREMENT_WAREHOUSE",
    action: "RECEIPT_REVERSAL_REQUEST",
    input: {
      action: "RECEIPT_REVERSAL_REQUEST",
      goodsReceiptId: id,
      reason: "Barang salah diterima",
    },
    title: "Pembatalan",
    entityName: "Proyek",
    meta: "GR-QA",
    projectId: id,
    contextHash: hash,
    effect: "Pengajuan saja.",
    rows: Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      title: "Panel",
      meta: "lembar",
      amount: 20,
      comparisons: [],
      details: [],
    })),
    summary: [],
    budget: null,
  });
  expect(proposalReviewFlow(p)).toEqual(direct);
  expect(
    proposalReviewFlow({
      ...p,
      action: "RECEIPT_REVERSAL_APPROVE",
      input: { action: "RECEIPT_REVERSAL_APPROVE", goodsReceiptId: id },
    }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
});
const budget = {
  projectValue: 1000,
  internalCap: 800,
  planTotal: 300,
  actual: 20,
  pending: 0,
  remaining: 780,
  marginAmount: 980,
  categories: [],
};
const state = {
  stage: "REVIEW",
  status: "DRAFT",
  materialCount: 1,
  tukangSkipped: true,
  subconSkipped: true,
  packages: [],
};
test("single RAP freeze has short confirmation while risk/ordered decisions retain review", () => {
  const p = setupProposalSchema.parse({
    kind: "RAP_SETUP_ACTIONS",
    projectId: id,
    projectName: "Proyek",
    projectRapId: id,
    expectedContext: hash,
    request: { projectId: id, steps: [{ action: "FINALIZE" }] },
    before: state,
    after: { ...state, status: "LOCKED", stage: "COMPLETE" },
    steps: [
      {
        step: { action: "FINALIZE" },
        permission: "lock:rap",
        label: "Finalisasi",
        detail: "Kunci baseline",
        packageIds: [],
      },
    ],
    budget,
  });
  expect(proposalReviewFlow(p)).toEqual(protectedInline);
  expect(proposalReviewFlow({ ...p, budget: { ...budget, planTotal: 900 } }).review).toBe("sheet");
});
test("single package reopening/deletion is inline, revision creation remains a full source review", () => {
  const p = lifecycleProposalSchema.parse({
    kind: "RAP_LIFECYCLE",
    projectId: id,
    projectName: "Proyek",
    projectRapId: id,
    expectedContext: hash,
    request: { action: "PACKAGE_CHANGES", projectId: id, rows: [{ itemId: id, action: "REOPEN" }] },
    nextRapId: null,
    rows: [
      {
        id,
        action: "REOPEN",
        category: "TUKANG",
        name: "Finishing",
        detail: "Dapur",
        beforeStatus: "ACTIVE",
        afterStatus: "DRAFT",
        estimate: 100,
        revision: 1,
        nextId: null,
      },
    ],
    budget,
    materialRows: [],
  });
  expect(proposalReviewFlow(p)).toEqual(direct);
  expect(
    proposalReviewFlow({
      ...p,
      request: {
        action: "PACKAGE_CHANGES",
        projectId: id,
        rows: [{ itemId: id, action: "DELETE" }],
      },
      rows: [{ ...p.rows[0], action: "DELETE", afterStatus: "DELETED" }],
    }),
  ).toEqual(protectedInline);
  expect(
    proposalReviewFlow({
      ...p,
      request: {
        action: "REVISION",
        projectId: id,
        reason: "Perubahan lingkup dapur",
        reviseMaterial: false,
        packageIds: [id],
      },
    }).review,
  ).toBe("sheet");
});
test("saved single RAP edit is direct and deletion protected, without reducing multi-row review", () => {
  const before = {
    itemId: id,
    materialId: id,
    name: "Panel",
    unit: "lembar",
    description: null,
    internalNote: null,
    source: "PURCHASE",
    area: "Dapur",
    requiredQuantity: 2,
    bufferQuantity: 0,
    estimatedUnitCost: 10,
    totalQuantity: 2,
    estimatedTotalCost: 20,
  };
  const p = rapChangeProposalSchema.parse({
    kind: "RAP_MATERIAL_CHANGES",
    projectId: id,
    projectName: "Proyek",
    projectRapId: id,
    expectedContext: hash,
    rows: [
      {
        action: "UPDATE",
        before,
        after: { ...before, requiredQuantity: 3, totalQuantity: 3, estimatedTotalCost: 30 },
      },
    ],
    budget: {
      allocated: 800,
      actual: 20,
      pending: 0,
      remaining: 780,
      beforePlan: 20,
      afterPlan: 30,
      delta: 10,
      overAllocation: 0,
    },
  });
  expect(proposalReviewFlow(p)).toEqual(direct);
  expect(proposalReviewFlow({ ...p, rows: [{ action: "DELETE", before, after: null }] })).toEqual(
    protectedInline,
  );
  expect(
    proposalReviewFlow({
      ...p,
      rows: [...p.rows, { action: "DELETE", before: { ...before, itemId: other }, after: null }],
    }).review,
  ).toBe("sheet");
});
test("RAB approval can confirm from its card, but budget shortfalls and bundles require full review", () => {
  const p = rabWorkflowProposalSchema.parse({
    kind: "RAB_WORKFLOW",
    projectId: id,
    projectName: "Proyek",
    rabEstimateId: id,
    title: "RAB dapur",
    revision: 1,
    request: { action: "APPROVE_INITIAL" },
    expectedContext: hash,
    rows: [
      {
        id,
        title: "RAB dapur",
        detail: "Persetujuan",
        action: "Setujui",
        before: null,
        after: null,
        beforeState: "Draft",
        afterState: "Disetujui",
      },
    ],
    totalBefore: 1000,
    totalAfter: 1000,
    budgetImpact: {
      contractBefore: 900,
      contractAfter: 1000,
      capBefore: 720,
      capAfter: 800,
      categories: [{ name: "Material", before: 300, after: 400, actual: 20, manual: false }],
    },
    warning: null,
  });
  expect(proposalReviewFlow(p)).toEqual(protectedInline);
  if (!p.budgetImpact) throw new Error("Missing budget fixture");
  expect(
    proposalReviewFlow({
      ...p,
      budgetImpact: {
        ...p.budgetImpact,
        categories: [{ name: "Material", before: 300, after: 10, actual: 20, manual: false }],
      },
    }).review,
  ).toBe("sheet");
});

test("vendor schedule is directly reviewable while decisions and cash retain protected confirmation", () => {
  const shared = {
    kind: "VENDOR_PAYMENT_WORKFLOW" as const,
    projectId: id,
    vendorBillId: id,
    title: "Vendor",
    entityName: "QA",
    expectedContext: hash,
    effect: "QA",
    facts: [],
    comparisons: [],
  };
  expect(
    proposalReviewFlow({
      ...shared,
      input: {
        action: "SCHEDULE",
        vendorBillId: id,
        bankAccountId: other,
        amount: 100,
        paymentDate: "2026-10-31",
      },
    }),
  ).toEqual(direct);
  expect(
    proposalReviewFlow({
      ...shared,
      input: { action: "APPROVE", vendorPaymentId: id, notes: "Diverifikasi" },
    }),
  ).toEqual(protectedInline);
  expect(
    proposalReviewFlow({
      ...shared,
      input: { action: "REJECT", vendorPaymentId: id, notes: "Dokumen belum lengkap" },
    }),
  ).toEqual(protectedInline);
  expect(
    proposalReviewFlow({
      ...shared,
      input: {
        action: "PAY",
        vendorPaymentId: id,
        bankAccountId: other,
        referenceNumber: "BANK-123",
      },
    }),
  ).toEqual(protectedInline);
});

test("expense batch decisions are protected inline for one claim and grouped review for multiple", () => {
  const base = {
    kind: "EXPENSE_BATCH_ACTION" as const,
    input: { action: "VERIFY" as const, projectId: id, costIds: [id] },
    title: "Verifikasi",
    projectName: "QA",
    expectedContext: hash,
    effect: "Tidak mencairkan kas",
    summary: [],
    budget: [],
  };
  const one = { ...base, rows: [{ id, title: "Transport", facts: [] }] };
  expect(proposalReviewFlow(one)).toEqual(protectedInline);
  expect(
    proposalReviewFlow({ ...one, rows: [...one.rows, { id: other, title: "Tukang", facts: [] }] }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
});

test("bank cash keeps money protected, uses inline metadata and reviews larger changes", async () => {
  const { bankCashProposalSchema } = await import("@atria/core/ai/bank-cash");
  const make = (input: unknown, comparisons: unknown[] = []) =>
    bankCashProposalSchema.parse({
      kind: "BANK_CASH",
      input,
      title: "Rekening QA",
      entityName: "Kas QA",
      expectedContext: "0".repeat(64),
      effect: "Preview",
      facts: [],
      details: [],
      comparisons,
    });
  const id = "77777777-7777-7777-7777-777777777771";
  const name = make({ action: "EDIT_ACCOUNT", bankAccountId: id, patch: { name: "Nama baru" } }, [
    { label: "Nama rekening", before: "Lama", after: "Baru", money: false },
  ]);
  expect(proposalReviewFlow(name)).toEqual({ review: "inline", confirmation: "direct" });
  const bank = make(
    { action: "EDIT_ACCOUNT", bankAccountId: id, patch: { accountNumber: "QA-002" } },
    [{ label: "Nomor rekening", before: "QA-001", after: "QA-002", money: false }],
  );
  expect(proposalReviewFlow(bank)).toEqual({ review: "inline", confirmation: "dialog" });
  const large = make(
    { action: "EDIT_ACCOUNT", bankAccountId: id, patch: { name: "Nama baru" } },
    ["Nama rekening", "Bank", "Pemegang rekening", "Nomor rekening"].map((label) => ({
      label,
      before: "Lama",
      after: "Baru",
      money: false,
    })),
  );
  expect(proposalReviewFlow(large)).toEqual({ review: "sheet", confirmation: "dialog" });
  const cash = make({
    action: "CASH_MOVEMENT",
    bankAccountId: id,
    type: "INFLOW",
    amount: 100,
    category: "owner_capital",
    description: "Modal dari pemilik",
    transactionDate: "2026-10-11",
    referenceNumber: "CAP-11",
  });
  expect(proposalReviewFlow(cash)).toEqual({ review: "inline", confirmation: "dialog" });
});

test("operational thresholds and allocation protect confirmation; metadata stays direct and large patches use review", () => {
  const base = {
    kind: "FINANCE_INPUT",
    title: "Settings",
    entityName: "Perusahaan",
    projectId: null,
    expectedContext: hash,
    effect: "Pengajuan berikutnya",
    summary: [],
    rows: [],
    changes: [{ label: "Ambang", before: 5000000, after: 0, money: true }],
  };
  const threshold = financeInputProposalSchema.parse({
    ...base,
    input: {
      action: "APPROVAL_THRESHOLDS",
      patch: { fieldCostAmount: 0 },
      reason: "Kebijakan ditinjau Owner",
    },
  });
  expect(proposalReviewFlow(threshold)).toEqual(protectedInline);
  const category = financeInputProposalSchema.parse({
    ...base,
    input: {
      action: "EXPENSE_CATEGORY_SETTINGS",
      expenseCategoryId: id,
      patch: { description: "Koreksi deskripsi" },
      reason: "Kebijakan ditinjau Owner",
    },
    changes: [{ label: "Deskripsi", before: "Lama", after: "Baru" }],
  });
  expect(proposalReviewFlow(category)).toEqual(direct);
  const allocation = financeInputProposalSchema.parse({
    ...category,
    input: { ...category.input, patch: { defaultRatio: 0.2 } },
  });
  expect(proposalReviewFlow(allocation)).toEqual(protectedInline);
  expect(
    proposalReviewFlow({
      ...allocation,
      changes: [category.changes[0], category.changes[0], category.changes[0], category.changes[0]],
    }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
});

test("administration cannot hide access/deletion confirmation and uses review for batches", () => {
  const p = administrationProposalSchema.parse({
    kind: "ADMINISTRATION",
    input: {
      action: "STAFF_CHANGES",
      users: [{ userId: id, patch: { name: "Budi" } }],
      reason: "Penataan staf ditinjau",
    },
    title: "Staf",
    entityName: "Budi",
    effect: "Riwayat tetap",
    expectedContext: hash,
    sensitive: false,
    summary: [],
    rows: [
      {
        id,
        title: "Budi",
        meta: "Email",
        changes: [{ label: "Nama", before: "A", after: "B" }],
        facts: [],
        added: [],
        removed: [],
      },
    ],
  });
  expect(proposalReviewFlow(p)).toEqual(direct);
  expect(
    proposalReviewFlow(
      administrationProposalSchema.parse({
        ...p,
        input: { ...p.input, users: [{ userId: id, patch: { isActive: false } }] },
      }),
    ),
  ).toEqual(protectedInline);
  expect(proposalReviewFlow({ ...p, rows: [p.rows[0], { ...p.rows[0], id: other }] })).toEqual({
    review: "sheet",
    confirmation: "direct",
  });
  expect(
    proposalReviewFlow(
      administrationProposalSchema.parse({
        ...p,
        input: { action: "ROLE_DELETE", roleId: id, reason: "Peran tidak dipakai lagi" },
      }),
    ),
  ).toEqual(protectedInline);
});
