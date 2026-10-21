import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "@backend/db";
import {
  aiConversation,
  aiMessage,
  aiUserPreference,
  approval,
  auditLog,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  clientInvoice,
  clientPayment,
  expenseCategory,
  goodsReceipt,
  goodsReceiptItem,
  inventoryLocation,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
  materialInventory,
  materialMaster,
  notification,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectCost,
  projectExpenses,
  projectRap,
  projectRapItem,
  stockCount,
  stockCountItem,
  stockMovement,
  vendorBill,
  vendorPayment,
} from "@backend/db/schema";
import { mutateBalance } from "@backend/lib/finance/balance-mutation";
import { syncProjectBudgetCategories } from "@backend/lib/budget/budget-sync";
import { recordStandaloneStockProjectCostTx } from "@backend/app/actions/material/inventory-utils";
import { calculateSuggestedClientPrice } from "@atria/core/project/pricing";
import { DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS } from "@atria/core/finance/approval-thresholds";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import { DEMO_IDS, formatMinorMoney, parseMoneyToMinor, type DemoClock } from "./demo-contract";

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NotificationRow = typeof notification.$inferInsert;

function developmentId(sequence: number): string {
  return `68686868-6868-6868-6868-${String(sequence).padStart(12, "0")}`;
}

function lineAmount(quantity: string, unitCost: string): string {
  return formatMinorMoney((parseMoneyToMinor(quantity) * parseMoneyToMinor(unitCost)) / 100n);
}

async function seedLibrary(tx: SeedTransaction, clock: DemoClock): Promise<void> {
  const categories = await tx.select().from(expenseCategory);
  const materials = await tx.select().from(materialMaster);
  const inventories = await tx.select().from(materialInventory);
  const raps = await tx.select().from(projectRapItem);
  const existing = await tx.select().from(itemPriceLibrary);
  const materialCategory = categories.find((row) => row.code === "MATERIAL");
  const laborCategory = categories.find((row) => row.code === "TUKANG");
  const subconCategory = categories.find((row) => row.code === "SUBCON");
  const operationsCategory = categories.find((row) => row.code === "OPERASIONAL");
  const miscellaneousCategory = categories.find((row) => row.code === "LAIN_LAIN");
  if (
    !materialCategory ||
    !laborCategory ||
    !subconCategory ||
    !operationsCategory ||
    !miscellaneousCategory
  )
    throw new Error("DEVELOPMENT_LIBRARY_CATEGORIES_MISSING");

  for (const [index, material] of materials.entries()) {
    if (existing.some((row) => row.materialId === material.id)) continue;
    const planned = raps.find(
      (row) => row.materialId === material.id && Number(row.estimatedUnitCost) > 0,
    );
    const stocked = inventories.find(
      (row) => row.materialId === material.id && Number(row.lastPurchasePrice) > 0,
    );
    const cost = planned?.estimatedUnitCost ?? stocked?.lastPurchasePrice;
    if (!cost || Number(cost) <= 0)
      throw new Error(`DEVELOPMENT_MATERIAL_PRICE_MISSING:${material.name}`);
    await tx.insert(itemPriceLibrary).values({
      id: developmentId(1000 + index),
      expenseCategoryId: materialCategory.id,
      materialId: material.id,
      defaultVendorId: material.defaultVendorId,
      code: `DEV-MAT-${String(index + 1).padStart(3, "0")}`,
      itemType: "MATERIAL_ITEM",
      itemCategory: "Material Interior",
      name: material.name,
      description: material.specification,
      unit: material.unit,
      defaultInternalCost: cost,
      defaultClientPrice: calculateSuggestedClientPrice(Number(cost), 0.3).toFixed(2),
      pricingMode: "MARGIN_BASED",
      targetGrossPercentage: "0.3000",
      priceSourceType: "VENDOR_QUOTE",
      sourceNote: "Referensi harga skenario development, bukan penawaran vendor aktual.",
      effectiveFrom: clock.day(-35),
      updatedById: DEMO_IDS.users.owner,
      createdAt: clock.day(-35),
      updatedAt: clock.day(-35),
    });
  }

  const packages = [
    {
      id: 1101,
      code: "DEV-WORK-CABINET",
      name: "Fabrikasi kabinet custom per modul",
      category: laborCategory.id,
      type: "WORK_PACKAGE",
      unit: "modul",
      cost: 2_250_000,
      vendorId: null,
    },
    {
      id: 1102,
      code: "DEV-WORK-FINISH",
      name: "Pengerjaan finishing PU kabinet",
      category: laborCategory.id,
      type: "WORK_PACKAGE",
      unit: "m2",
      cost: 325_000,
      vendorId: null,
    },
    {
      id: 1103,
      code: "DEV-WORK-SITE",
      name: "Tim instalasi interior di lokasi",
      category: laborCategory.id,
      type: "WORK_PACKAGE",
      unit: "hari",
      cost: 2_400_000,
      vendorId: null,
    },
    {
      id: 1104,
      code: "DEV-SUBCON-GLASS",
      name: "Pengukuran dan pemasangan kaca custom",
      category: subconCategory.id,
      type: "SUBCON_PACKAGE",
      unit: "m2",
      cost: 875_000,
      vendorId: "55555555-5555-5555-5555-555555555552",
    },
    {
      id: 1105,
      code: "DEV-SUBCON-ELECTRIC",
      name: "Instalasi titik lampu dan testing driver",
      category: subconCategory.id,
      type: "SUBCON_PACKAGE",
      unit: "titik",
      cost: 450_000,
      vendorId: "55555555-5555-5555-5555-555555555552",
    },
    {
      id: 1106,
      code: "DEV-SUBCON-TOP",
      name: "Fabrikasi dan instalasi countertop",
      category: subconCategory.id,
      type: "SUBCON_PACKAGE",
      unit: "meter",
      cost: 850_000,
      vendorId: "55555555-5555-5555-5555-555555555553",
    },
    {
      id: 1107,
      code: "DEV-OPS-DELIVERY",
      name: "Pengiriman material dan mobilisasi lokal",
      category: operationsCategory.id,
      type: "CLIENT_LINE",
      unit: "trip",
      cost: 450_000,
      vendorId: null,
    },
    {
      id: 1108,
      code: "DEV-MISC-SEALANT",
      name: "Consumable pemasangan dan sealant sambungan",
      category: miscellaneousCategory.id,
      type: "CLIENT_LINE",
      unit: "paket",
      cost: 250_000,
      vendorId: null,
    },
  ];
  await tx.insert(itemPriceLibrary).values(
    packages.map((row) => ({
      id: developmentId(row.id),
      expenseCategoryId: row.category,
      defaultVendorId: row.vendorId,
      code: row.code,
      itemType: row.type,
      itemCategory:
        categories.find((category) => category.id === row.category)?.name ?? "Lain-lain",
      name: row.name,
      description:
        "Referensi satuan pekerjaan termasuk mobilisasi dan pemeriksaan akhir sesuai lingkup.",
      unit: row.unit,
      defaultInternalCost: row.cost.toFixed(2),
      defaultClientPrice: calculateSuggestedClientPrice(row.cost, 0.25).toFixed(2),
      pricingMode: "MARGIN_BASED",
      targetGrossPercentage: "0.2500",
      priceSourceType: "COST_BREAKDOWN",
      sourceNote: "Template biaya skenario development; sesuaikan dengan penawaran aktual.",
      effectiveFrom: clock.day(-35),
      updatedById: DEMO_IDS.users.owner,
      createdAt: clock.day(-35),
      updatedAt: clock.day(-35),
    })),
  );

  // Every template has an inspectable cost breakdown whose sum equals its internal cost.
  for (const [index, row] of (await tx.select().from(itemPriceLibrary)).entries()) {
    await tx.insert(itemPriceLibraryCostComponent).values({
      id: developmentId(1200 + index),
      itemPriceLibraryId: row.id,
      vendorId: row.defaultVendorId,
      componentType:
        row.itemType === "MATERIAL_ITEM"
          ? "MATERIAL"
          : row.expenseCategoryId === operationsCategory.id
            ? "LOGISTICS"
            : row.expenseCategoryId === miscellaneousCategory.id
              ? "OTHER"
              : "LABOR",
      label:
        row.itemType === "MATERIAL_ITEM"
          ? "Harga bahan per satuan"
          : "Pekerjaan sesuai lingkup per satuan",
      quantity: "1.00",
      unit: row.unit,
      unitCost: row.defaultInternalCost,
      totalCost: row.defaultInternalCost,
      note: "Dasar perhitungan harga jual dan gross margin template.",
      displayOrder: 0,
      createdAt: clock.day(-35),
      updatedAt: clock.day(-35),
    });
  }
}

async function recordReconciledCash(
  tx: SeedTransaction,
  args: {
    readonly importId: string;
    readonly date: Date;
    readonly type: "INFLOW" | "OUTFLOW";
    readonly amount: string;
    readonly description: string;
    readonly referenceType: "project_cost" | "vendor_payment" | "client_payment";
    readonly referenceId: string;
    readonly bankReference: string;
    readonly reconciledAt: Date;
  },
): Promise<typeof cashTransaction.$inferSelect> {
  const cash = await mutateBalance({
    tx,
    bankAccountId: DEMO_IDS.bankAccounts.mandiriMain,
    type: args.type,
    amount: args.amount,
    description: args.description,
    category: args.referenceType === "project_cost" ? "field_claim" : args.referenceType,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    bankReference: args.bankReference,
    userId: DEMO_IDS.users.finance,
    transactionDate: args.date,
    userAgent: "Atria development seed historical transaction",
  });
  await tx
    .update(cashTransaction)
    .set({
      reconciled: true,
      reconciliationDate: args.reconciledAt,
      reconciledById: DEMO_IDS.users.finance,
    })
    .where(eq(cashTransaction.id, cash.id));
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      `${DEMO_IDS.bankAccounts.mandiriMain}|${args.date.toISOString().slice(0, 10)}|${args.type}|${args.amount}|${args.description.trim().toLocaleLowerCase("id-ID")}`,
    )
    .digest("hex");
  await tx.insert(bankStatementRow).values({
    importId: args.importId,
    transactionDate: args.date,
    type: args.type,
    amount: args.amount,
    description: args.description,
    fingerprint,
    isReconciled: true,
    matchedCashTransactionId: cash.id,
    createdAt: args.reconciledAt,
  });
  await tx.insert(auditLog).values({
    userId: DEMO_IDS.users.finance,
    action: "RECONCILE_CASH_TRANSACTION",
    targetTable: "cash_transaction",
    targetId: cash.id,
    originalState: JSON.stringify({ reconciled: false }),
    newState: JSON.stringify({
      cashTransactionId: cash.id,
      reconciled: true,
      referenceId: args.referenceId,
      amount: args.amount,
    }),
    createdAt: args.reconciledAt,
  });
  await tx.insert(auditLog).values({
    userId: DEMO_IDS.users.finance,
    action: "LINK_HISTORICAL_BALANCE_EVIDENCE",
    targetTable: "bank_account",
    targetId: DEMO_IDS.bankAccounts.mandiriMain,
    newState: JSON.stringify({
      cashTransactionId: cash.id,
      referenceId: args.referenceId,
      amount: args.amount,
      type: args.type,
    }),
    createdAt: args.date,
  });
  return cash;
}

async function seedCompletedProjectHistory(
  tx: SeedTransaction,
  clock: DemoClock,
  projectId: string,
  sequence: number,
): Promise<void> {
  const projectRow = await tx.query.project.findFirst({ where: eq(project.id, projectId) });
  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
  });
  if (!projectRow || !budget) throw new Error(`DEVELOPMENT_COMPLETED_BUDGET_MISSING:${projectId}`);
  const managerId = projectRow.projectManagerId;
  if (!managerId) throw new Error(`DEVELOPMENT_COMPLETED_PM_MISSING:${projectId}`);
  const categories = await tx.query.projectBudgetCategory.findMany({
    where: eq(projectBudgetCategory.projectBudgetId, budget.id),
    with: { expenseCategory: true },
  });
  const materialCategory = categories.find((row) => row.expenseCategory.code === "MATERIAL");
  if (!materialCategory)
    throw new Error(`DEVELOPMENT_COMPLETED_MATERIAL_CATEGORY_MISSING:${projectId}`);
  const raps = await tx.query.projectRap.findMany({
    where: eq(projectRap.projectId, projectId),
    orderBy: (table, { desc }) => [desc(table.revision)],
  });
  const rap = raps[0];
  if (!rap) throw new Error(`DEVELOPMENT_COMPLETED_RAP_MISSING:${projectId}`);
  const lines = await tx.query.projectRapItem.findMany({
    where: eq(projectRapItem.projectRapId, rap.id),
  });
  const packages = await tx.query.projectCategoryPlanItem.findMany({
    where: eq(projectCategoryPlanItem.projectId, projectId),
  });
  const materials = await tx.select().from(materialMaster);
  const receivedAt = clock.day(projectId === DEMO_IDS.projects.bsd ? -112 : -95);
  const paidAt = clock.day(projectId === DEMO_IDS.projects.bsd ? -108 : -91);
  const reconciledAt = clock.day(projectId === DEMO_IDS.projects.bsd ? -67 : -60);
  const prefix = projectId === DEMO_IDS.projects.bsd ? "BSD" : "SEN";
  const importId = developmentId(sequence);
  await tx.insert(bankStatementImport).values({
    id: importId,
    bankAccountId: DEMO_IDS.bankAccounts.mandiriMain,
    fileName: `development-${prefix.toLowerCase()}-historical-statement.csv`,
    fileUrl: "",
    importedById: DEMO_IDS.users.finance,
    startDate: projectId === DEMO_IDS.projects.bsd ? clock.day(-145) : receivedAt,
    endDate: reconciledAt,
    createdAt: reconciledAt,
  });

  // The original demo already records Senopati's full client receipt; BSD needs its own settlement.
  if (projectId === DEMO_IDS.projects.bsd) {
    const contract = parseMoneyToMinor(projectRow.totalContractValue);
    const dp = (contract * 30n) / 100n;
    const progress = (contract * 45n) / 100n;
    const stages = [
      {
        stage: "DP",
        amount: dp,
        date: clock.day(-145),
        note: "Uang muka 30% sebelum pengadaan material dan fabrikasi.",
      },
      {
        stage: "PROGRESS_1",
        amount: progress,
        date: clock.day(-105),
        note: "Termin 45% setelah progres fabrikasi dan mobilisasi disetujui klien.",
      },
      {
        stage: "PELUNASAN",
        amount: contract - dp - progress,
        date: clock.day(-69),
        note: "Pelunasan 25% setelah serah terima area dining dan espresso bar.",
      },
    ];
    for (const [index, stage] of stages.entries()) {
      const invoiceId = developmentId(sequence + 10 + index);
      const paymentId = developmentId(sequence + 20 + index);
      const amount = formatMinorMoney(stage.amount);
      const bankReference = `DEV-${prefix}-CLIENT-${index + 1}`;
      await tx.insert(clientInvoice).values({
        id: invoiceId,
        projectId,
        invoiceNumber: `DEV-INV-${prefix}-${index + 1}`,
        amount,
        status: "PAID",
        stage: stage.stage,
        dueDate: stage.date,
        notes: stage.note,
        createdAt: stage.date,
        updatedAt: stage.date,
      });
      const cash = await recordReconciledCash(tx, {
        importId,
        date: stage.date,
        type: "INFLOW",
        amount,
        description: `Penerimaan ${stage.stage} ${projectRow.name}`,
        referenceType: "client_payment",
        referenceId: paymentId,
        bankReference,
        reconciledAt,
      });
      await tx.insert(clientPayment).values({
        id: paymentId,
        clientInvoiceId: invoiceId,
        bankAccountId: DEMO_IDS.bankAccounts.mandiriMain,
        cashTransactionId: cash.id,
        amountPaid: amount,
        paymentDate: stage.date,
        receivedById: DEMO_IDS.users.finance,
        referenceNumber: bankReference,
        createdAt: stage.date,
      });
    }
  }

  const locationId = developmentId(sequence + 3);
  await tx.insert(inventoryLocation).values({
    id: locationId,
    name: prefix === "BSD" ? "Site BSD Boutique Cafe" : "Site Senopati Executive Suite",
    description:
      "Penerimaan langsung material proyek; seluruh material sudah dipasang atau dicatat sebagai susut setelah serah terima.",
    createdAt: receivedAt,
  });
  for (const [index, line] of lines.entries()) {
    if (!line.materialId) throw new Error(`DEVELOPMENT_COMPLETED_RAP_UNLINKED:${line.id}`);
    const material = materials.find((row) => row.id === line.materialId);
    if (!material?.defaultVendorId)
      throw new Error(`DEVELOPMENT_COMPLETED_VENDOR_MISSING:${line.name}`);
    const amount = lineAmount(line.totalQuantity, line.estimatedUnitCost);
    const billId = developmentId(sequence + 100 + index);
    const paymentId = developmentId(sequence + 200 + index);
    const receiptId = developmentId(sequence + 300 + index);
    const movementId = developmentId(sequence + 400 + index);
    const useId = developmentId(sequence + 500 + index);
    const needsApproval = parseMoneyToMinor(amount) >= DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS;
    await tx.insert(vendorBill).values({
      id: billId,
      vendorId: material.defaultVendorId,
      projectId,
      projectBudgetCategoryId: materialCategory.id,
      materialId: line.materialId,
      projectRapItemId: line.id,
      billNumber: `DEV-${prefix}-MAT-${index + 1}`,
      amount,
      status: "PAID",
      dueDate: paidAt,
      notes: `Pembelian ${line.totalQuantity} ${line.unit} untuk ${line.area}; termasuk buffer RAP ${line.bufferQuantity} ${line.unit}.`,
      createdAt: receivedAt,
      updatedAt: paidAt,
    });
    const cash = await recordReconciledCash(tx, {
      importId,
      date: paidAt,
      type: "OUTFLOW",
      amount,
      description: `Bayar ${line.name} untuk ${projectRow.name}`,
      referenceType: "vendor_payment",
      referenceId: paymentId,
      bankReference: `DEV-${prefix}-MAT-${index + 1}`,
      reconciledAt,
    });
    await tx.insert(vendorPayment).values({
      id: paymentId,
      vendorBillId: billId,
      bankAccountId: DEMO_IDS.bankAccounts.mandiriMain,
      cashTransactionId: cash.id,
      amountPaid: amount,
      status: "COMPLETED",
      requiresOwnerApproval: needsApproval,
      paymentDate: paidAt,
      paidById: DEMO_IDS.users.finance,
      referenceNumber: `DEV-${prefix}-MAT-${index + 1}`,
      createdAt: receivedAt,
    });
    if (needsApproval)
      await tx.insert(approval).values({
        approverId: DEMO_IDS.users.owner,
        referenceType: "vendor_payment",
        referenceId: paymentId,
        status: "APPROVED",
        notes: "Nominal dan penerimaan barang diperiksa sebelum pelunasan vendor.",
        createdAt: clock.day(projectId === DEMO_IDS.projects.bsd ? -109 : -92),
      });
    await tx.insert(projectExpenses).values({
      projectId,
      projectBudgetId: budget.id,
      projectBudgetCategoryId: materialCategory.id,
      expenseCategoryId: materialCategory.expenseCategoryId,
      vendorId: material.defaultVendorId,
      vendorBillId: billId,
      sourceType: "VENDOR_BILL",
      materialId: line.materialId,
      projectRapItemId: line.id,
      requestedById: DEMO_IDS.users.purchasing,
      description: `${line.name} — pembelian sesuai RAP ${line.area}`,
      quantity: line.totalQuantity,
      unitCost: line.estimatedUnitCost,
      amount,
      status: "PAID",
      paymentStatus: "PAID",
      isCashImpact: true,
      expenseDate: receivedAt,
      createdAt: receivedAt,
      updatedAt: paidAt,
    });
    await tx
      .insert(materialInventory)
      .values({
        materialId: line.materialId,
        locationId,
        currentStock: "0.00",
        reservedStock: "0.00",
        minimumStock: "0.00",
        averageCost: "0.00",
        lastPurchasePrice: line.estimatedUnitCost,
        createdAt: receivedAt,
        updatedAt: reconciledAt,
      })
      .onConflictDoNothing();
    await tx.insert(goodsReceipt).values({
      id: receiptId,
      vendorBillId: billId,
      projectId,
      inventoryLocationId: locationId,
      receiptNumber: `DEV-GRN-${prefix}-${index + 1}`,
      status: "POSTED",
      receivedAt,
      note: `Penerimaan langsung di site untuk ${line.area}, jumlah dan kondisi diverifikasi Purchasing.`,
      receivedById: DEMO_IDS.users.purchasing,
      createdAt: receivedAt,
      updatedAt: receivedAt,
    });
    await tx.insert(stockMovement).values({
      id: movementId,
      materialId: line.materialId,
      inventoryLocationId: locationId,
      projectId,
      projectRapItemId: line.id,
      vendorBillId: billId,
      movementType: "GOODS_RECEIPT",
      movementDirection: "IN",
      referenceType: "GOODS_RECEIPT",
      referenceId: receiptId,
      quantity: line.totalQuantity,
      unitCost: line.estimatedUnitCost,
      note: "Barang diterima sesuai tagihan dan RAP.",
      createdById: DEMO_IDS.users.purchasing,
      createdAt: receivedAt,
    });
    await tx.insert(goodsReceiptItem).values({
      goodsReceiptId: receiptId,
      materialId: line.materialId,
      projectRapItemId: line.id,
      stockMovementId: movementId,
      quantity: line.totalQuantity,
      unitCost: line.estimatedUnitCost,
      createdAt: receivedAt,
    });
    await tx.insert(stockMovement).values({
      id: useId,
      materialId: line.materialId,
      inventoryLocationId: locationId,
      projectId,
      projectRapItemId: line.id,
      vendorBillId: billId,
      movementType: "USE",
      movementDirection: "OUT",
      referenceType: "PROJECT_USAGE",
      referenceId: projectId,
      quantity: line.totalQuantity,
      unitCost: line.estimatedUnitCost,
      note: `Input fabrikasi ${line.totalQuantity} ${line.unit}: kebutuhan terpasang ${line.requiredQuantity} ${line.unit} dan allowance produksi normal ${line.bufferQuantity} ${line.unit} terserap dalam pemotongan/fitting untuk ${line.area}. Biaya sudah tercakup pada tagihan material.`,
      createdById: managerId,
      createdAt: paidAt,
    });
    await tx
      .update(projectRapItem)
      .set({ status: "USED", updatedAt: paidAt })
      .where(eq(projectRapItem.id, line.id));
    for (const [action, targetTable, targetId] of [
      ["COMPLETE_VENDOR_PAYMENT", "vendor_payment", paymentId],
      ["POST_GOODS_RECEIPT", "goods_receipt", receiptId],
      ["RECORD_STOCK_RECEIPT", "stock_movement", movementId],
      ["RECORD_STOCK_USAGE", "stock_movement", useId],
    ])
      await tx.insert(auditLog).values({
        userId: DEMO_IDS.users.finance,
        action,
        targetTable,
        targetId,
        newState: JSON.stringify({
          projectId,
          billId,
          cashTransactionId: cash.id,
          amount,
          rapItemId: line.id,
        }),
        createdAt: paidAt,
      });
  }

  // Labor/subcontract costs follow their exact scope and unit-rate baseline.
  const costRows: {
    readonly categoryId: string;
    readonly expenseCategoryId: string;
    readonly packageId: string | null;
    readonly quantity: string;
    readonly unitCost: string;
    readonly description: string;
    readonly vendorId: string | null;
  }[] = packages
    .filter((row) => row.status !== "SUPERSEDED")
    .map((row) => ({
      categoryId: row.projectBudgetCategoryId,
      expenseCategoryId: row.expenseCategoryId,
      packageId: row.id,
      quantity: row.quantity,
      unitCost: row.estimatedUnitCost,
      vendorId: row.vendorId,
      description: `${row.name} — ${row.area}, pekerjaan selesai sesuai lingkup`,
    }));
  for (const category of categories.filter((row) =>
    ["OPERASIONAL", "LAIN_LAIN"].includes(row.expenseCategory.code),
  )) {
    // Site logistics/small consumables are realized below their cap, with a documented scope.
    const allowance = Number(category.allocatedAmount);
    if (allowance <= 0) continue;
    const amount = Math.min(
      allowance * 0.75,
      category.expenseCategory.code === "OPERASIONAL" ? 15_000_000 : 7_500_000,
    );
    costRows.push({
      categoryId: category.id,
      expenseCategoryId: category.expenseCategoryId,
      packageId: null,
      quantity: "1.00",
      unitCost: amount.toFixed(2),
      vendorId: null,
      description:
        category.expenseCategory.code === "OPERASIONAL"
          ? "Mobilisasi, transport material, proteksi area dan pembersihan akhir site"
          : "Consumable instalasi, sealant sambungan dan cadangan aksesori serah terima",
    });
  }
  for (const [index, cost] of costRows.entries()) {
    const id = developmentId(sequence + 700 + index);
    const amount = lineAmount(cost.quantity, cost.unitCost);
    const needsApproval = parseMoneyToMinor(amount) >= DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS;
    const cash = await recordReconciledCash(tx, {
      importId,
      date: paidAt,
      type: "OUTFLOW",
      amount,
      description: `${cost.description} — ${projectRow.name}`,
      referenceType: "project_cost",
      referenceId: id,
      bankReference: `DEV-${prefix}-SCOPE-${index + 1}`,
      reconciledAt,
    });
    await tx.insert(projectCost).values({
      id,
      projectId,
      projectBudgetCategoryId: cost.categoryId,
      requestedById: managerId,
      quantity: cost.quantity,
      unitPrice: cost.unitCost,
      amount,
      description: cost.description,
      status: "PAID",
      budgetOverrun: false,
      requiresOwnerApproval: needsApproval,
      bankAccountId: DEMO_IDS.bankAccounts.mandiriMain,
      cashTransactionId: cash.id,
      verifiedById: DEMO_IDS.users.finance,
      verifiedAt: receivedAt,
      approvedById: needsApproval ? DEMO_IDS.users.owner : DEMO_IDS.users.finance,
      approvedAt: receivedAt,
      paidById: DEMO_IDS.users.finance,
      paidAt,
      createdAt: receivedAt,
      updatedAt: paidAt,
    });
    if (needsApproval)
      await tx.insert(approval).values({
        approverId: DEMO_IDS.users.owner,
        referenceType: "project_cost",
        referenceId: id,
        status: "APPROVED",
        notes: "Lingkup selesai, kuitansi dan nilai pekerjaan diverifikasi sebelum pembayaran.",
        createdAt: receivedAt,
      });
    await tx.insert(projectExpenses).values({
      projectId,
      projectBudgetId: budget.id,
      projectBudgetCategoryId: cost.categoryId,
      expenseCategoryId: cost.expenseCategoryId,
      legacyProjectCostId: id,
      projectCategoryPlanItemId: cost.packageId,
      vendorId: cost.vendorId,
      requestedById: managerId,
      quantity: cost.quantity,
      unitCost: cost.unitCost,
      amount,
      description: cost.description,
      status: "PAID",
      paymentStatus: "PAID",
      expenseDate: receivedAt,
      createdAt: receivedAt,
      updatedAt: paidAt,
    });
    await tx.insert(auditLog).values({
      userId: DEMO_IDS.users.finance,
      action: "PAY_FIELD_REQUEST",
      targetTable: "project_cost",
      targetId: id,
      newState: JSON.stringify({ status: "PAID", cashTransactionId: cash.id, projectId, amount }),
      createdAt: paidAt,
    });
  }
  await syncProjectBudgetCategories({
    tx,
    projectBudgetCategoryIds: categories.map((row) => row.id),
  });
}

async function attributeExistingWarehouseUsage(tx: SeedTransaction): Promise<void> {
  const movements = await tx.select().from(stockMovement);
  const expenses = await tx.select().from(projectExpenses);
  // These original demo rows use warehouse opening stock. New completed-project
  // movements have vendorBillId and are already covered by one procurement expense.
  for (const movement of movements.filter(
    (row) =>
      row.projectId &&
      !row.vendorBillId &&
      !row.projectCostId &&
      ["USE", "RETURN", "WASTE"].includes(row.movementType) &&
      !expenses.some((expense) => expense.stockMovementId === row.id),
  )) {
    if (!movement.projectId) continue;
    const sourceType =
      movement.movementType === "USE"
        ? "STOCK_USAGE"
        : movement.movementType === "RETURN"
          ? "STOCK_RETURN"
          : "STOCK_WASTE";
    await recordStandaloneStockProjectCostTx(tx, {
      movement,
      projectId: movement.projectId,
      requestedById: movement.createdById,
      quantity: Number(movement.quantity),
      unitCost: Number(movement.unitCost),
      description: movement.note ?? "Penggunaan stok gudang pada proyek",
      sourceType,
      sign: movement.movementType === "RETURN" ? -1 : 1,
    });
    await tx.insert(auditLog).values({
      userId: movement.createdById,
      action: "ATTRIBUTE_STOCK_PROJECT_COST",
      targetTable: "stock_movement",
      targetId: movement.id,
      newState: JSON.stringify({ sourceType, isCashImpact: false, projectId: movement.projectId }),
      createdAt: movement.createdAt,
    });
  }
}

async function ensureStockAuditEvidence(tx: SeedTransaction): Promise<void> {
  const movements = await tx.select().from(stockMovement);
  const audits = await tx.select().from(auditLog);
  for (const movement of movements.filter(
    (row) =>
      !audits.some((audit) => audit.targetTable === "stock_movement" && audit.targetId === row.id),
  )) {
    await tx.insert(auditLog).values({
      userId: movement.createdById,
      action: `RECORD_${movement.movementType}`,
      targetTable: "stock_movement",
      targetId: movement.id,
      newState: JSON.stringify({
        movementType: movement.movementType,
        movementDirection: movement.movementDirection,
        materialId: movement.materialId,
        inventoryLocationId: movement.inventoryLocationId,
        projectId: movement.projectId,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        quantity: movement.quantity,
        unitCost: movement.unitCost,
        note: movement.note,
      }),
      createdAt: movement.createdAt,
    });
  }
}

async function alignInventoryCostHistory(tx: SeedTransaction, clock: DemoClock): Promise<void> {
  const inventories = await tx.select().from(materialInventory);
  const movements = await tx.select().from(stockMovement);
  for (const inventory of inventories) {
    const history = movements
      .filter(
        (row) =>
          row.materialId === inventory.materialId &&
          row.inventoryLocationId === inventory.locationId,
      )
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
      );
    let quantity = 0n;
    let averageCost = 0;
    let lastPurchasePrice = inventory.lastPurchasePrice;
    for (const movement of history) {
      const moved = parseMoneyToMinor(movement.quantity);
      if (movement.movementDirection === "IN") {
        const next = quantity + moved;
        // Runtime receiving and transfer-in use moving weighted averages;
        // returns/manual adjustments preserve the existing average cost.
        if (
          ["OPENING_BALANCE", "GOODS_RECEIPT", "STOCK_IN", "TRANSFER"].includes(
            movement.movementType,
          )
        ) {
          averageCost =
            next > 0n
              ? Number(
                  (
                    (Number(quantity) * averageCost + Number(moved) * Number(movement.unitCost)) /
                    Number(next)
                  ).toFixed(2),
                )
              : Number(movement.unitCost);
        }
        if (["GOODS_RECEIPT", "STOCK_IN"].includes(movement.movementType))
          lastPurchasePrice = movement.unitCost;
        quantity = next;
      } else if (movement.movementDirection === "OUT") {
        if (moved > quantity) throw new Error(`DEVELOPMENT_STOCK_HISTORY_NEGATIVE:${movement.id}`);
        if (
          Math.abs(Number(movement.unitCost) - averageCost) >= 0.01 &&
          !movement.note?.includes("lot historis")
        ) {
          await tx
            .update(stockMovement)
            .set({
              note: `${movement.note ?? "Pengeluaran stok"} Biaya satuan mengacu pada lot historis yang dikeluarkan; rata-rata gudang saat itu Rp${averageCost.toLocaleString("id-ID")}.`,
            })
            .where(eq(stockMovement.id, movement.id));
        }
        quantity -= moved;
      }
    }
    if (quantity !== parseMoneyToMinor(inventory.currentStock))
      throw new Error(`DEVELOPMENT_STOCK_HISTORY_DRIFT:${inventory.id}`);
    if (history.length === 0) continue;
    const nextAverage = averageCost.toFixed(2);
    if (nextAverage === inventory.averageCost && lastPurchasePrice === inventory.lastPurchasePrice)
      continue;
    await tx
      .update(materialInventory)
      .set({ averageCost: nextAverage, lastPurchasePrice, updatedAt: clock.day(0) })
      .where(eq(materialInventory.id, inventory.id));
    await tx.insert(auditLog).values({
      userId: DEMO_IDS.users.finance,
      action: "ALIGN_INVENTORY_COST_HISTORY",
      targetTable: "material_inventory",
      targetId: inventory.id,
      originalState: JSON.stringify({
        averageCost: inventory.averageCost,
        lastPurchasePrice: inventory.lastPurchasePrice,
      }),
      newState: JSON.stringify({
        averageCost: nextAverage,
        lastPurchasePrice,
        currentStock: inventory.currentStock,
        method: "RUNTIME_MOVING_WEIGHTED_AVERAGE",
      }),
      createdAt: clock.day(0),
    });
  }
}

async function seedWarehouseDrafts(tx: SeedTransaction, clock: DemoClock): Promise<void> {
  const projects = [DEMO_IDS.projects.menteng, DEMO_IDS.projects.sudirman];
  for (const [index, projectId] of projects.entries()) {
    const rap = await tx.query.projectRap.findFirst({
      where: eq(projectRap.projectId, projectId),
      orderBy: (table, { desc }) => [desc(table.revision)],
    });
    const line = rap
      ? await tx.query.projectRapItem.findFirst({ where: eq(projectRapItem.projectRapId, rap.id) })
      : null;
    if (!line?.materialId) continue;
    const movements = await tx.query.stockMovement.findMany({
      where: eq(stockMovement.projectId, projectId),
    });
    const projection = projectMaterialProjection(
      movements.filter(
        (row) =>
          row.materialId === line.materialId &&
          (!row.projectRapItemId || row.projectRapItemId === line.id),
      ),
      Number(line.totalQuantity),
    );
    const deliveryQuantity = projection.needToBuy;
    if (deliveryQuantity <= 0) continue;
    const receiptId = developmentId(9000 + index);
    await tx.insert(goodsReceipt).values({
      id: receiptId,
      projectId,
      inventoryLocationId: "14141414-1414-1414-1414-141414141401",
      receiptNumber: `DEV-GRN-DRAFT-${index + 1}`,
      status: "DRAFT",
      receivedAt: clock.day(0),
      note: "Draft pemeriksaan barang pada jadwal pengiriman berikutnya; stok belum bertambah dan pembayaran belum dibuat.",
      receivedById: DEMO_IDS.users.purchasing,
      createdAt: clock.day(-1),
      updatedAt: clock.day(-1),
    });
    await tx.insert(goodsReceiptItem).values({
      goodsReceiptId: receiptId,
      materialId: line.materialId,
      projectRapItemId: line.id,
      quantity: deliveryQuantity.toFixed(2),
      unitCost: line.estimatedUnitCost,
      note: "Jumlah rencana diperiksa ulang terhadap surat jalan sebelum posting.",
      createdAt: clock.day(-1),
    });
    await tx.insert(auditLog).values({
      userId: DEMO_IDS.users.purchasing,
      action: "CREATE_GOODS_RECEIPT",
      targetTable: "goods_receipt",
      targetId: receiptId,
      newState: JSON.stringify({ status: "DRAFT", projectId }),
      createdAt: clock.day(-1),
    });
  }
  const countId = developmentId(9010);
  await tx.insert(stockCount).values({
    id: countId,
    countNumber: "DEV-STC-GUDANG-DRAFT",
    inventoryLocationId: "14141414-1414-1414-1414-141414141401",
    status: "DRAFT",
    countedAt: clock.day(0),
    note: "Hitung stok mingguan belum dikirim, qty fisik awal diisi dari stok sistem.",
    createdById: DEMO_IDS.users.purchasing,
    createdAt: clock.day(-1),
    updatedAt: clock.day(-1),
  });
  const inventory = await tx.query.materialInventory.findMany({
    where: eq(materialInventory.locationId, "14141414-1414-1414-1414-141414141401"),
  });
  await tx.insert(stockCountItem).values(
    inventory.map((row) => ({
      stockCountId: countId,
      materialId: row.materialId,
      systemQuantity: row.currentStock,
      countedQuantity: row.currentStock,
      varianceQuantity: "0.00",
      unitCost: row.averageCost,
      createdAt: clock.day(-1),
    })),
  );
  await tx.insert(auditLog).values({
    userId: DEMO_IDS.users.purchasing,
    action: "SAVE_STOCK_COUNT_DRAFT",
    targetTable: "stock_count",
    targetId: countId,
    newState: JSON.stringify({ status: "DRAFT", itemCount: inventory.length }),
    createdAt: clock.day(-1),
  });
}

async function refreshApprovalContext(tx: SeedTransaction): Promise<void> {
  const categories = await tx.select().from(projectBudgetCategory);
  const costs = await tx.select().from(projectCost);
  const approvals = await tx.select().from(approval);
  for (const cost of costs) {
    const category = categories.find((row) => row.id === cost.projectBudgetCategoryId);
    if (!category) throw new Error(`DEVELOPMENT_COST_CATEGORY_MISSING:${cost.id}`);
    const amount = parseMoneyToMinor(cost.amount);
    const recognized = cost.status === "APPROVED" || cost.status === "PAID" ? amount : 0n;
    const budgetOverrun =
      parseMoneyToMinor(category.actualAmount) - recognized + amount >
      parseMoneyToMinor(category.allocatedAmount);
    const requiresOwnerApproval =
      amount >= DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS ||
      budgetOverrun ||
      approvals.some((row) => row.referenceType === "project_cost" && row.referenceId === cost.id);
    await tx
      .update(projectCost)
      .set({ budgetOverrun, requiresOwnerApproval })
      .where(eq(projectCost.id, cost.id));
    if (cost.id === "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f010" && !budgetOverrun) {
      const description = "DP fabrikasi countertop Cipete sebelum pekerjaan produksi dimulai";
      await tx.update(projectCost).set({ description }).where(eq(projectCost.id, cost.id));
      await tx
        .update(projectExpenses)
        .set({ description })
        .where(eq(projectExpenses.legacyProjectCostId, cost.id));
      await tx
        .update(notification)
        .set({
          title: "DP countertop Cipete menunggu keputusan",
          message:
            "DP Rp 18.000.000 sudah diverifikasi Finance dan membutuhkan persetujuan Owner sebelum produksi.",
        })
        .where(eq(notification.referenceId, cost.id));
      for (const row of approvals.filter(
        (record) => record.referenceType === "project_cost" && record.referenceId === cost.id,
      )) {
        await tx
          .update(approval)
          .set({
            notes:
              "DP countertop Cipete Rp 18.000.000 membutuhkan persetujuan Owner sebelum produksi.",
          })
          .where(eq(approval.id, row.id));
      }
    }
  }
  for (const payment of await tx.select().from(vendorPayment)) {
    const ownerApproval = approvals.some(
      (row) => row.referenceType === "vendor_payment" && row.referenceId === payment.id,
    );
    const requiresOwnerApproval =
      parseMoneyToMinor(payment.amountPaid) >= DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS ||
      ownerApproval;
    await tx
      .update(vendorPayment)
      .set({ requiresOwnerApproval })
      .where(eq(vendorPayment.id, payment.id));
    if (payment.status === "COMPLETED" && requiresOwnerApproval && !ownerApproval)
      await tx.insert(approval).values({
        approverId: DEMO_IDS.users.owner,
        referenceType: "vendor_payment",
        referenceId: payment.id,
        status: "APPROVED",
        notes:
          "Pembayaran historis disetujui Owner setelah nilai tagihan dan penerimaan barang diperiksa.",
        createdAt: payment.createdAt,
      });
  }
}

async function seedRoleNotifications(tx: SeedTransaction, clock: DemoClock): Promise<void> {
  const rows: NotificationRow[] = [];
  const allCosts = await tx.select().from(projectCost);
  for (const cost of allCosts.filter((row) => row.status === "SUBMITTED")) {
    rows.push({
      userId: DEMO_IDS.users.finance,
      title: "Biaya lapangan perlu verifikasi",
      message: cost.description,
      category: "ACTION_REQUIRED",
      severity: "WARNING",
      projectId: cost.projectId,
      requiredPermission: "verify:cost",
      referenceType: "project_cost",
      referenceId: cost.id,
      eventKey: `development:project_cost:${cost.id}:VERIFY`,
      actionUrl: "/expenses",
      createdAt: clock.day(-1),
    });
  }
  for (const userId of [DEMO_IDS.users.pmBudi, DEMO_IDS.users.pmSiti]) {
    const paid = allCosts
      .filter((row) => row.requestedById === userId && row.status === "PAID")
      .slice(0, 3);
    for (const cost of paid)
      rows.push({
        userId,
        title: "Pengeluaran proyek sudah dibayar",
        message: cost.description,
        projectId: cost.projectId,
        requiredPermission: "view:cost",
        referenceType: "project_cost",
        referenceId: cost.id,
        category: "INFORMATIONAL",
        severity: "INFO",
        read: false,
        eventKey: `development:project_cost:${cost.id}:PAID`,
        actionUrl: `/projects/${cost.projectId}?tab=budget`,
        createdAt: clock.day(-2),
      });
    const pending = allCosts.find(
      (row) => row.requestedById === userId && ["SUBMITTED", "VERIFIED"].includes(row.status),
    );
    if (pending)
      rows.push({
        userId,
        title: "Pengajuan masih dalam pemeriksaan",
        message: pending.description,
        projectId: pending.projectId,
        requiredPermission: "view:cost",
        referenceType: "project_cost",
        referenceId: pending.id,
        category: "INFORMATIONAL",
        severity: "INFO",
        read: true,
        readAt: clock.day(-1),
        eventKey: `development:project_cost:${pending.id}:WAITING`,
        actionUrl: `/projects/${pending.projectId}?tab=budget`,
        createdAt: clock.day(-2),
      });
  }
  const inventories = await tx.query.materialInventory.findMany({ with: { material: true } });
  for (const inventory of inventories
    .filter(
      (row) => Number(row.currentStock) - Number(row.reservedStock) < Number(row.minimumStock),
    )
    .slice(0, 3)) {
    rows.push({
      userId: DEMO_IDS.users.purchasing,
      title: "Stok tersedia di bawah buffer",
      message: `${inventory.material.name}: stok tersedia ${Number(inventory.currentStock) - Number(inventory.reservedStock)} ${inventory.material.unit}.`,
      requiredPermission: "view:inventory",
      referenceType: "material",
      referenceId: inventory.materialId,
      category: "INFORMATIONAL",
      severity: "WARNING",
      eventKey: `development:inventory:${inventory.id}:LOW`,
      actionUrl: "/materials",
      createdAt: clock.day(-1),
    });
  }
  rows.push({
    userId: DEMO_IDS.users.purchasing,
    title: "Lanjutkan pemeriksaan barang",
    message: "Draft penerimaan Menteng siap dilanjutkan setelah surat jalan diterima.",
    projectId: DEMO_IDS.projects.menteng,
    requiredPermission: "view:inventory",
    referenceType: "goods_receipt",
    referenceId: developmentId(9000),
    category: "INFORMATIONAL",
    severity: "INFO",
    eventKey: "development:goods_receipt:9000:DRAFT",
    actionUrl: "/materials",
    createdAt: clock.day(0),
  });
  await tx.insert(notification).values(
    rows.map((row, index) => ({
      ...row,
      id: developmentId(9300 + index),
      updatedAt: row.createdAt,
    })),
  );
}

async function seedChatHistory(tx: SeedTransaction, clock: DemoClock): Promise<void> {
  const projectRows = await tx.select().from(project);
  const categoryRows = await tx.query.projectBudgetCategory.findMany({
    with: { expenseCategory: true, budget: true },
  });
  const histories = [
    {
      userId: DEMO_IDS.users.owner,
      projectId: DEMO_IDS.projects.menteng,
      focus: "BUDGET_MARGIN",
      question: "Apa yang perlu dicek dari budget Menteng hari ini?",
    },
    {
      userId: DEMO_IDS.users.finance,
      projectId: DEMO_IDS.projects.sudirman,
      focus: "CASH_BILLS",
      question: "Bantu susun checklist budget dan pembayaran Sudirman.",
    },
    {
      userId: DEMO_IDS.users.pmBudi,
      projectId: DEMO_IDS.projects.cipete,
      focus: "BUDGET_MARGIN",
      question: "Apa yang perlu gue siapkan sebelum RAP Cipete difinalisasi?",
    },
    {
      userId: DEMO_IDS.users.pmSiti,
      projectId: DEMO_IDS.projects.sudirman,
      focus: "BUDGET_MARGIN",
      question: "Apa yang perlu tim lapangan cek sebelum pekerjaan Sudirman berikutnya?",
    },
    {
      userId: DEMO_IDS.users.purchasing,
      projectId: DEMO_IDS.projects.menteng,
      focus: "MATERIAL_STOCK",
      question: "Apa checklist pembelian material Menteng yang nyambung dengan budget?",
    },
  ];
  for (const [index, history] of histories.entries()) {
    const projectRow = projectRows.find((row) => row.id === history.projectId);
    const projectCategories = categoryRows.filter(
      (row) => row.budget.projectId === history.projectId,
    );
    const summary = projectCategories
      .map(
        (row) =>
          `${row.expenseCategory.name}: alokasi Rp${Number(row.allocatedAmount).toLocaleString("id-ID")}, tercatat Rp${Number(row.actualAmount).toLocaleString("id-ID")}, pending Rp${Number(row.pendingAmount).toLocaleString("id-ID")}`,
      )
      .join("\n");
    const answer = `Contoh percakapan development yang ditulis dari data seed, tanpa panggilan model AI.\n\n${projectRow?.name ?? "Proyek"}\n${summary}\n\nPeriksa kategori yang menunggu keputusan terlebih dahulu. Sesuaikan daftar kebutuhan RAP dengan stok tersedia, penerimaan barang, dan jadwal kerja. Ajukan persetujuan sebelum pembayaran atau perubahan stok; seluruh angka ini menggambarkan snapshot saat seed dijalankan.`;
    const conversationId = developmentId(9500 + index);
    await tx.insert(aiConversation).values({
      id: conversationId,
      userId: history.userId,
      title: `Contoh development · ${projectRow?.name.split(" - ")[0] ?? "Proyek"}`,
      createdAt: clock.day(-1, 9),
      updatedAt: clock.day(-1, 10),
    });
    await tx.insert(aiMessage).values([
      {
        id: developmentId(9600 + index * 2),
        conversationId,
        role: "user",
        parts: [{ type: "text", text: history.question }],
        createdAt: clock.day(-1, 9),
      },
      {
        id: developmentId(9601 + index * 2),
        conversationId,
        role: "assistant",
        parts: [{ type: "text", text: answer }],
        provider: null,
        inputTokens: null,
        outputTokens: null,
        createdAt: clock.day(-1, 10),
      },
    ]);
    await tx.insert(aiUserPreference).values({
      userId: history.userId,
      responseStyle: "STANDARD",
      primaryFocus: history.focus,
      customNote:
        "Jawab dalam Bahasa Indonesia yang praktis dan sertakan dampak budget sebelum detail material.",
      updatedAt: clock.day(-1),
    });
  }
}

/** Enriches the disposable development profile after its detailed RAP/RAB planning seed. */
export async function seedDevelopmentSupport(tx: SeedTransaction, clock: DemoClock): Promise<void> {
  await seedLibrary(tx, clock);
  // BSD receipt funds its historical costs; Senopati already has its receipt in the original demo.
  await seedCompletedProjectHistory(tx, clock, DEMO_IDS.projects.bsd, 2000);
  await seedCompletedProjectHistory(tx, clock, DEMO_IDS.projects.senopati, 4000);
  await attributeExistingWarehouseUsage(tx);
  await alignInventoryCostHistory(tx, clock);
  await ensureStockAuditEvidence(tx);
  await refreshApprovalContext(tx);
  await seedWarehouseDrafts(tx, clock);
  await seedRoleNotifications(tx, clock);
  await seedChatHistory(tx, clock);
}
