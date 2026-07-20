import { auth } from "@/lib/auth";
import { db } from "./index";
import { eq } from "drizzle-orm";
import {
  role,
  user,
  client,
  vendor,
  bankAccount,
  projectCostCategory,
  expenseCategory,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  projectBudgets,
  projectBudgetCategory,
  projectCategoryPlanItem,
  projectExpenses,
  projectProfitabilitySnapshot,
  project,
  projectBudget,
  projectBudgetItem,
  clientInvoice,
  cashTransaction,
  clientPayment,
  vendorBill,
  vendorPayment,
  projectCost,
  materialCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  itemPriceLibrary,
  itemPriceLibraryCostComponent,
  projectRap,
  projectRapItem,
  stockMovement,
  rabEstimate,
  rabEstimateItem,
  approval,
  aiRun,
  notification,
  auditLog,
  account,
  projectChangeOrder,
  goodsReceiptItem,
  goodsReceipt,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  stockTransfer,
  stockTransferItem,
  stockCount,
  stockCountItem,
  rabEstimateBundle,
  attachment,
  bankStatementImport,
  bankStatementRow,
  formDraft,
  appConfig,
  session,
  verification,
} from "./schema";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXCEL_BUDGET_CAP_RATIO,
  calculateInternalBudget,
  calculateTargetGross,
  calculateUsedPercentage,
  getBudgetCategoryStatus,
} from "@/lib/budget/excel-budget";

async function main(): Promise<void> {
  console.log("Starting clean sandbox database seeding...");

  await db.transaction(async (tx) => {
    // Cleanup existing data in reverse dependency order
    console.log("Cleaning up database tables...");
    await tx.delete(auditLog);
    await tx.delete(notification);
    await tx.delete(aiRun);
    await tx.delete(approval);
    await tx.delete(attachment);
    await tx.delete(formDraft);
    await tx.delete(bankStatementRow);
    await tx.delete(bankStatementImport);
    await tx.delete(appConfig);
    await tx.delete(session);
    await tx.delete(verification);
    await tx.delete(projectChangeOrder);
    await tx.delete(rabEstimateItem);
    await tx.delete(rabEstimateBundle);
    await tx.delete(rabEstimate);
    await tx.delete(projectProfitabilitySnapshot);
    await tx.delete(projectExpenses);
    await tx.delete(goodsReceiptItem);
    await tx.delete(goodsReceipt);
    await tx.delete(inventoryOpeningItem);
    await tx.delete(inventoryOpeningBatch);
    await tx.delete(stockTransferItem);
    await tx.delete(stockCountItem);
    await tx.delete(stockTransfer);
    await tx.delete(stockCount);
    await tx.delete(stockMovement);
    await tx.delete(projectCost);
    await tx.delete(vendorPayment);
    await tx.delete(vendorBill);
    await tx.delete(projectCategoryPlanItem);
    await tx.delete(projectRapItem);
    await tx.delete(projectRap);
    await tx.delete(itemPriceLibraryCostComponent);
    await tx.delete(itemPriceLibrary);
    await tx.delete(materialInventory);
    await tx.delete(inventoryLocation);
    await tx.delete(materialMaster);
    await tx.delete(materialCategory);
    await tx.delete(clientPayment);
    await tx.delete(cashTransaction);
    await tx.delete(clientInvoice);
    await tx.delete(projectBudgetCategory);
    await tx.delete(projectBudgets);
    await tx.delete(projectBudgetItem);
    await tx.delete(projectBudget);
    await tx.delete(project);
    await tx.delete(budgetAllocationSettingCategory);
    await tx.delete(budgetAllocationSetting);
    await tx.delete(expenseCategory);
    await tx.delete(projectCostCategory);
    await tx.delete(bankAccount);
    await tx.delete(vendor);
    await tx.delete(client);
    await tx.delete(account);
    await tx.delete(user);
    await tx.delete(role);
    console.log("Database cleaned!");

    // 1. Seed Roles
    console.log("Seeding roles...");
    await tx.insert(role).values([
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "owner",
        description: "Pemilik Perusahaan (Full Access & Approver)",
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "finance_admin",
        description: "Finance & Bookkeeper (Verifikator & Rekonsiliasi)",
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        name: "project_manager",
        description: "Manajer Proyek Lapangan (Pengaju Biaya & Operator)",
      },
      {
        id: "00000000-0000-0000-0000-000000000004",
        name: "purchasing",
        description: "Tim Purchasing & Material Control",
      },
    ]);

    const defaultPassword = "password123";
    const hashedDefaultPassword = await auth.$context.then((context) =>
      context.password.hash(defaultPassword)
    );

    // 2. Seed Users
    console.log("Seeding users...");
    await tx.insert(user).values([
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Ronald Wijaya",
        email: "ronald@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Lisa Permata",
        email: "lisa@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000002",
      },
      {
        id: "33333333-3333-3333-3333-333333333331",
        name: "Budi Santoso",
        email: "budi@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000003",
      },
      {
        id: "33333333-3333-3333-3333-333333333332",
        name: "Siti Aminah",
        email: "siti@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000003",
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        name: "Agus Pratama",
        email: "agus@dekoria.com",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000004",
      },
    ]);

    console.log("Seeding auth accounts...");
    await tx.insert(account).values([
      {
        id: "account-11111111-1111-1111-1111-111111111111",
        accountId: "11111111-1111-1111-1111-111111111111",
        providerId: "credential",
        userId: "11111111-1111-1111-1111-111111111111",
        password: hashedDefaultPassword,
      },
      {
        id: "account-22222222-2222-2222-2222-222222222222",
        accountId: "22222222-2222-2222-2222-222222222222",
        providerId: "credential",
        userId: "22222222-2222-2222-2222-222222222222",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333331",
        accountId: "33333333-3333-3333-3333-333333333331",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333331",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333332",
        accountId: "33333333-3333-3333-3333-333333333332",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333332",
        password: hashedDefaultPassword,
      },
      {
        id: "account-33333333-3333-3333-3333-333333333333",
        accountId: "33333333-3333-3333-3333-333333333333",
        providerId: "credential",
        userId: "33333333-3333-3333-3333-333333333333",
        password: hashedDefaultPassword,
      },
    ]);

    // 3. Seed Clients
    console.log("Seeding clients...");
    await tx.insert(client).values([
      {
        id: "44444444-4444-4444-4444-444444444441",
        name: "Adrian Hartanto",
        companyName: "PT Graha Indah",
        email: "adrian@graha.com",
        phone: "081122334455",
        address: "Jl. Teuku Umar No. 12, Menteng, Jakarta Pusat",
      },
      {
        id: "44444444-4444-4444-4444-444444444442",
        name: "Haryanto Wijaya",
        companyName: "PT Sinar Sejahtera",
        email: "haryanto@sejahtera.com",
        phone: "081234567890",
        address: "Sudirman Suites Penthouse A, Jakarta Selatan",
      },
      {
        id: "44444444-4444-4444-4444-444444444443",
        name: "Nadia Prameswari",
        companyName: "Nadia Residence",
        email: "nadia.prameswari@example.com",
        phone: "081298765432",
        address: "Jl. Brawijaya No. 18, Kebayoran Baru, Jakarta Selatan",
      },
    ]);

    // 4. Seed Vendors
    console.log("Seeding vendors...");
    await tx.insert(vendor).values([
      {
        id: "55555555-5555-5555-5555-555555555551",
        name: "PT Cahaya Mas Panel",
        email: "sales@cahayamas.com",
        phone: "021-5559876",
        address: "Kawasan Industri Pulogadung Blok F, Jakarta Timur",
        bankName: "BCA",
        bankAccountNumber: "0955512345",
        bankAccountHolder: "PT Cahaya Mas Panel",
      },
      {
        id: "55555555-5555-5555-5555-555555555553",
        name: "CV Batu Prima Countertop",
        email: "admin@batuprima.example",
        phone: "021-5557788",
        address: "Jl. Raya Ciledug No. 21, Tangerang",
        bankName: "Mandiri",
        bankAccountNumber: "133009887766",
        bankAccountHolder: "CV Batu Prima Countertop",
      },
      {
        id: "55555555-5555-5555-5555-555555555552",
        name: "PT Sinar Kaca & Electrical",
        email: "project@sinarkaca.example",
        phone: "021-5556644",
        address: "Jl. Daan Mogot KM 12, Jakarta Barat",
        bankName: "BCA",
        bankAccountNumber: "0955524680",
        bankAccountHolder: "PT Sinar Kaca & Electrical",
      },
    ]);

    console.log("Seeding material master and inventory...");
    await tx.insert(materialCategory).values([
      {
        id: "12121212-1212-1212-1212-121212121201",
        name: "Panel Kayu",
        description: "Multipleks, MDF, blockboard, dan panel interior",
      },
      {
        id: "12121212-1212-1212-1212-121212121202",
        name: "Finishing",
        description: "HPL, veneer, cat, dan finishing permukaan",
      },
      {
        id: "12121212-1212-1212-1212-121212121203",
        name: "Countertop",
        description: "Solid surface, granit, dan material top table",
      },
      { id: "12121212-1212-1212-1212-121212121204", name: "Hardware", description: "Engsel, drawer runner, handle, dan fitting cabinetry" },
      { id: "12121212-1212-1212-1212-121212121205", name: "Electrical & Lighting", description: "Kabel, LED strip, driver, dan aksesori listrik interior" },
      { id: "12121212-1212-1212-1212-121212121206", name: "Glass & Mirror", description: "Kaca, cermin, dan aksesori pemasangan" },
    ]);

    await tx.insert(materialMaster).values([
      {
        id: "13131313-1313-1313-1313-131313131301",
        categoryId: "12121212-1212-1212-1212-121212121201",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        name: "Multipleks 18mm Meranti",
        specification: "Panel 1220 x 2440 mm, grade interior",
        brand: "Cahaya Mas",
        code: "PLY-18-MRT",
        unit: "lembar",
      },
      {
        id: "13131313-1313-1313-1313-131313131302",
        categoryId: "12121212-1212-1212-1212-121212121202",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        name: "HPL Taco Light Oak T-123",
        specification: "HPL sheet motif kayu terang",
        brand: "Taco",
        code: "T-123",
        color: "Light Oak",
        unit: "lembar",
      },
      {
        id: "13131313-1313-1313-1313-131313131303",
        categoryId: "12121212-1212-1212-1212-121212121203",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        name: "Solid Surface White Countertop",
        specification: "Solid surface putih untuk top table kitchen",
        brand: "Dekoria Select",
        code: "SS-WHT-12",
        color: "White",
        unit: "meter",
      },
      { id: "13131313-1313-1313-1313-131313131304", categoryId: "12121212-1212-1212-1212-121212121201", defaultVendorId: "55555555-5555-5555-5555-555555555551", name: "MDF 12mm Moisture Resistant", specification: "1220 x 2440 mm, MR grade", brand: "Dekoria Select", code: "MDF-12-MR", unit: "lembar" },
      { id: "13131313-1313-1313-1313-131313131305", categoryId: "12121212-1212-1212-1212-121212121204", defaultVendorId: "55555555-5555-5555-5555-555555555552", name: "Cabinet Hardware Set Soft-close", specification: "Engsel, runner, connector, dan handle per modul", brand: "Hafele Mix", code: "HW-SC-SET", unit: "set" },
      { id: "13131313-1313-1313-1313-131313131306", categoryId: "12121212-1212-1212-1212-121212121202", defaultVendorId: "55555555-5555-5555-5555-555555555551", name: "PU Finishing System", specification: "Sealer, color coat, clear coat, dan consumable", brand: "Dekoria Workshop", code: "FIN-PU-SYS", unit: "paket" },
      { id: "13131313-1313-1313-1313-131313131307", categoryId: "12121212-1212-1212-1212-121212121205", defaultVendorId: "55555555-5555-5555-5555-555555555552", name: "LED Strip & Driver 24V", specification: "Warm white 3000K lengkap aluminium profile", brand: "Philips Mix", code: "LED-24V-3K", unit: "meter" },
      { id: "13131313-1313-1313-1313-131313131308", categoryId: "12121212-1212-1212-1212-121212121206", defaultVendorId: "55555555-5555-5555-5555-555555555552", name: "Mirror 5mm Bevel", specification: "Cermin 5mm polished/bevel edge", brand: "Asahimas", code: "MIR-5-BVL", unit: "m2" },
    ]);

    await tx.insert(inventoryLocation).values([
      {
        id: "14141414-1414-1414-1414-141414141401",
        name: "Gudang Dekoria",
        description: "Gudang utama material dan sisa proyek reusable",
      },
    ]);

    await tx.insert(materialInventory).values([
      {
        id: "15151515-1515-1515-1515-151515151501",
        materialId: "13131313-1313-1313-1313-131313131301",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "35.00",
        reservedStock: "20.00",
        minimumStock: "10.00",
        averageCost: "245000.00",
        lastPurchasePrice: "250000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151502",
        materialId: "13131313-1313-1313-1313-131313131302",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "12.00",
        reservedStock: "8.00",
        minimumStock: "15.00",
        averageCost: "190000.00",
        lastPurchasePrice: "200000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151503",
        materialId: "13131313-1313-1313-1313-131313131303",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "4.00",
        reservedStock: "0.00",
        minimumStock: "2.00",
        averageCost: "1950000.00",
        lastPurchasePrice: "2000000.00",
      },
      { id: "15151515-1515-1515-1515-151515151504", materialId: "13131313-1313-1313-1313-131313131304", locationId: "14141414-1414-1414-1414-141414141401", currentStock: "18.00", reservedStock: "0.00", minimumStock: "8.00", averageCost: "180000.00", lastPurchasePrice: "185000.00" },
      { id: "15151515-1515-1515-1515-151515151505", materialId: "13131313-1313-1313-1313-131313131305", locationId: "14141414-1414-1414-1414-141414141401", currentStock: "24.00", reservedStock: "0.00", minimumStock: "10.00", averageCost: "725000.00", lastPurchasePrice: "750000.00" },
      { id: "15151515-1515-1515-1515-151515151506", materialId: "13131313-1313-1313-1313-131313131306", locationId: "14141414-1414-1414-1414-141414141401", currentStock: "3.00", reservedStock: "0.00", minimumStock: "2.00", averageCost: "3800000.00", lastPurchasePrice: "4000000.00" },
      { id: "15151515-1515-1515-1515-151515151507", materialId: "13131313-1313-1313-1313-131313131307", locationId: "14141414-1414-1414-1414-141414141401", currentStock: "35.00", reservedStock: "0.00", minimumStock: "20.00", averageCost: "210000.00", lastPurchasePrice: "225000.00" },
      { id: "15151515-1515-1515-1515-151515151508", materialId: "13131313-1313-1313-1313-131313131308", locationId: "14141414-1414-1414-1414-141414141401", currentStock: "8.00", reservedStock: "0.00", minimumStock: "4.00", averageCost: "475000.00", lastPurchasePrice: "500000.00" },
    ]);

    // 5. Seed Bank Accounts
    console.log("Seeding bank accounts...");
    await tx.insert(bankAccount).values([
      {
        id: "66666666-6666-6666-6666-666666666661",
        name: "BCA Operasional",
        accountNumber: "8889991122",
        bankName: "BCA",
        holderName: "PT Dekoria Desain Estetika",
        balance: "225000000.00", // DP termin (240M) - Transfer Petty Cash (15M)
        cardColorFrom: "#0F2B5C",
        cardColorTo: "#1E40AF",
        cardTextColor: "light",
      },
      {
        id: "66666666-6666-6666-6666-666666666662",
        name: "Kas Kecil PM Budi",
        accountNumber: "9990001112",
        bankName: "BCA Cashier",
        holderName: "Budi Santoso (Petty Cash)",
        balance: "15000000.00",
        cardColorFrom: "#0B4F43",
        cardColorTo: "#0D9488",
        cardTextColor: "light",
      },
    ]);

    // 6. Seed Cost Categories
    console.log("Seeding project cost categories...");
    await tx.insert(projectCostCategory).values([
      {
        id: "99999999-9999-9999-9999-999999999991",
        name: "MATERIAL",
        description: "Pembelian bahan bangunan & material finishing interior",
      },
      {
        id: "99999999-9999-9999-9999-999999999993",
        name: "OPERATIONAL",
        description: "Biaya operasional lapangan, bensin, konsumsi, dan koordinasi",
      },
    ]);

    console.log("Seeding canonical budget expense categories...");
    await tx.insert(expenseCategory).values(
      DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
        id: [
          "31313131-3131-3131-3131-313131313101",
          "31313131-3131-3131-3131-313131313102",
          "31313131-3131-3131-3131-313131313103",
          "31313131-3131-3131-3131-313131313104",
          "31313131-3131-3131-3131-313131313105",
        ][index],
        code: category.code,
        name: category.name,
        description: category.description,
        defaultRatio: category.defaultRatio.toFixed(6),
        sortOrder: category.sortOrder,
      }))
    );

    console.log("Seeding Settings defaults...");
    await tx.insert(budgetAllocationSetting).values({
      id: "41414141-4141-4141-4141-414141414101",
      name: "Default Project Budget Allocation",
      status: "ACTIVE",
      budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
      notes: "Default allocation used when creating a new Project Budget. Project-level values can still be overridden.",
      isActive: true,
      updatedById: "11111111-1111-1111-1111-111111111111",
    });

    await tx.insert(budgetAllocationSettingCategory).values(
      DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
        id: [
          "42424242-4242-4242-4242-424242424101",
          "42424242-4242-4242-4242-424242424102",
          "42424242-4242-4242-4242-424242424103",
          "42424242-4242-4242-4242-424242424104",
          "42424242-4242-4242-4242-424242424105",
        ][index],
        budgetAllocationSettingId: "41414141-4141-4141-4141-414141414101",
        expenseCategoryId: [
          "31313131-3131-3131-3131-313131313101",
          "31313131-3131-3131-3131-313131313102",
          "31313131-3131-3131-3131-313131313103",
          "31313131-3131-3131-3131-313131313104",
          "31313131-3131-3131-3131-313131313105",
        ][index],
        ratioPercentage: category.defaultRatio.toFixed(6),
        isEnabled: true,
        sortOrder: category.sortOrder,
      }))
    );

    await tx.insert(itemPriceLibrary).values([
      {
        id: "43434343-4343-4343-4343-434343434101",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        materialId: "13131313-1313-1313-1313-131313131301",
        code: "LIB-MAT-PLY18",
        itemType: "MATERIAL_ITEM",
        itemCategory: "Panel Kayu",
        name: "Multipleks 18mm Meranti",
        description: "Panel plywood interior untuk kabinet dan panel custom.",
        unit: "lembar",
        defaultClientPrice: "357142.86",
        defaultInternalCost: "250000.00",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.3000",
        priceSourceType: "COST_BREAKDOWN",
        sourceNote: "Harga panel referensi vendor Cahaya Mas, efektif Juni 2026.",
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
      {
        id: "43434343-4343-4343-4343-434343434102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        materialId: "13131313-1313-1313-1313-131313131302",
        code: "LIB-MAT-HPL-T123",
        itemType: "MATERIAL_ITEM",
        itemCategory: "Finishing",
        name: "HPL Taco Light Oak T-123",
        description: "Finishing HPL motif kayu terang untuk kabinet atau wall panel.",
        unit: "lembar",
        defaultClientPrice: "285714.29",
        defaultInternalCost: "200000.00",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.3000",
        priceSourceType: "COST_BREAKDOWN",
        sourceNote: "Harga HPL berdasarkan purchase reference vendor utama, efektif Juni 2026.",
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
      {
        id: "43434343-4343-4343-4343-434343434103",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        code: "LIB-WORK-INSTALL",
        itemType: "WORK_PACKAGE",
        itemCategory: "Tukang",
        name: "Installation Crew Package",
        description: "Paket jasa pemasangan, fitting, adjustment, dan finishing lapangan.",
        unit: "ls",
        defaultClientPrice: "56250000.00",
        defaultInternalCost: "45000000.00",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.2000",
        priceSourceType: "COST_BREAKDOWN",
        sourceNote: "Paket 10 hari instalasi: kepala tukang, empat installer, transport, alat, dan overhead lapangan.",
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
      {
        id: "43434343-4343-4343-4343-434343434104",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        code: "LIB-SUBCON-STONE",
        itemType: "SUBCON_PACKAGE",
        itemCategory: "Subcon",
        name: "Countertop Fabrication Package",
        description: "Paket subcon fabrikasi dan instalasi top table.",
        unit: "ls",
        defaultClientPrice: "51250000.00",
        defaultInternalCost: "41000000.00",
        defaultVendorId: "55555555-5555-5555-5555-555555555553",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.2000",
        priceSourceType: "VENDOR_QUOTE",
        sourceNote: "Quotation CV Batu Prima Countertop termasuk fabrikasi, edge profile, delivery, dan instalasi.",
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
      {
        id: "43434343-4343-4343-4343-434343434105",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        code: "LIB-CLIENT-COORD",
        itemType: "CLIENT_LINE",
        itemCategory: "Project Coordination",
        name: "Project Coordination and Logistics",
        description: "Koordinasi proyek, logistik lapangan, dan administrasi pelaksanaan.",
        unit: "ls",
        defaultClientPrice: "20000000.00",
        defaultInternalCost: "12000000.00",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.4000",
        priceSourceType: "COST_BREAKDOWN",
        sourceNote: "Estimasi koordinasi PM, administrasi, dokumentasi, dan allowance logistik.",
        effectiveFrom: new Date("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
      { id: "43434343-4343-4343-4343-434343434106", expenseCategoryId: "31313131-3131-3131-3131-313131313102", materialId: "13131313-1313-1313-1313-131313131304", defaultVendorId: "55555555-5555-5555-5555-555555555551", code: "LIB-MAT-MDF12", itemType: "MATERIAL_ITEM", itemCategory: "Panel Kayu", name: "MDF 12mm Moisture Resistant", description: "Panel MR untuk backing, drawer, dan profile interior.", unit: "lembar", defaultClientPrice: "264285.71", defaultInternalCost: "185000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.3000", priceSourceType: "VENDOR_QUOTE", sourceNote: "Reference purchase price PT Cahaya Mas Panel Juni 2026.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434107", expenseCategoryId: "31313131-3131-3131-3131-313131313102", materialId: "13131313-1313-1313-1313-131313131305", defaultVendorId: "55555555-5555-5555-5555-555555555552", code: "LIB-MAT-HWSC", itemType: "MATERIAL_ITEM", itemCategory: "Hardware", name: "Cabinet Hardware Set Soft-close", description: "Hardware set soft-close per modul cabinetry.", unit: "set", defaultClientPrice: "1071428.57", defaultInternalCost: "750000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.3000", priceSourceType: "VENDOR_QUOTE", sourceNote: "Vendor quote hardware mix untuk residential fit-out.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434108", expenseCategoryId: "31313131-3131-3131-3131-313131313102", materialId: "13131313-1313-1313-1313-131313131306", defaultVendorId: "55555555-5555-5555-5555-555555555551", code: "LIB-MAT-PUFIN", itemType: "MATERIAL_ITEM", itemCategory: "Finishing", name: "PU Finishing System", description: "Paket sealer, color coat, clear coat, dan consumable.", unit: "paket", defaultClientPrice: "5714285.71", defaultInternalCost: "4000000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.3000", priceSourceType: "COST_BREAKDOWN", sourceNote: "Workshop consumption benchmark per area residential.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434109", expenseCategoryId: "31313131-3131-3131-3131-313131313102", materialId: "13131313-1313-1313-1313-131313131307", defaultVendorId: "55555555-5555-5555-5555-555555555552", code: "LIB-MAT-LED24", itemType: "MATERIAL_ITEM", itemCategory: "Electrical", name: "LED Strip & Driver 24V", description: "LED strip warm white lengkap driver dan profile.", unit: "meter", defaultClientPrice: "321428.57", defaultInternalCost: "225000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.3000", priceSourceType: "VENDOR_QUOTE", sourceNote: "Reference price specialist electrical vendor.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434110", expenseCategoryId: "31313131-3131-3131-3131-313131313102", materialId: "13131313-1313-1313-1313-131313131308", defaultVendorId: "55555555-5555-5555-5555-555555555552", code: "LIB-MAT-MIR5", itemType: "MATERIAL_ITEM", itemCategory: "Glass & Mirror", name: "Mirror 5mm Bevel", description: "Cermin polished/bevel untuk wardrobe dan feature panel.", unit: "m2", defaultClientPrice: "714285.71", defaultInternalCost: "500000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.3000", priceSourceType: "VENDOR_QUOTE", sourceNote: "Specialist glass vendor reference, excluding complex cutout.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434111", expenseCategoryId: "31313131-3131-3131-3131-313131313101", code: "LIB-WORK-WORKSHOP", itemType: "WORK_PACKAGE", itemCategory: "Tukang", name: "Workshop Cabinetry Production", description: "Produksi kabinet kitchen, living, dan wardrobe di workshop.", unit: "ls", defaultClientPrice: "100000000.00", defaultInternalCost: "80000000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.2000", priceSourceType: "COST_BREAKDOWN", sourceNote: "Tim workshop 5 orang selama empat minggu termasuk supervision dan consumable.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434112", expenseCategoryId: "31313131-3131-3131-3131-313131313101", code: "LIB-WORK-SNAG", itemType: "WORK_PACKAGE", itemCategory: "Tukang", name: "Finishing & Snagging Crew", description: "Touch-up, final adjustment, cleaning, dan defect closeout.", unit: "ls", defaultClientPrice: "25000000.00", defaultInternalCost: "20000000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.2000", priceSourceType: "COST_BREAKDOWN", sourceNote: "Dua finisher dan satu installer selama enam hari plus consumable.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434113", expenseCategoryId: "31313131-3131-3131-3131-313131313105", defaultVendorId: "55555555-5555-5555-5555-555555555552", code: "LIB-SUBCON-GLASS-ELEC", itemType: "SUBCON_PACKAGE", itemCategory: "Subcon", name: "Glass & Electrical Specialist Package", description: "Fabrikasi mirror/glass dan instalasi lighting specialist.", unit: "ls", defaultClientPrice: "55000000.00", defaultInternalCost: "44000000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.2000", priceSourceType: "VENDOR_QUOTE", sourceNote: "Combined specialist quotation for mirror, glass fitting, LED driver, testing, and commissioning.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
      { id: "43434343-4343-4343-4343-434343434114", expenseCategoryId: "31313131-3131-3131-3131-313131313102", materialId: "13131313-1313-1313-1313-131313131303", defaultVendorId: "55555555-5555-5555-5555-555555555553", code: "LIB-MAT-SURFACE-WHT", itemType: "MATERIAL_ITEM", itemCategory: "Countertop", name: "Solid Surface White Countertop", description: "Solid surface putih untuk top table kitchen dan vanity.", unit: "meter", defaultClientPrice: "2857142.86", defaultInternalCost: "2000000.00", pricingMode: "MARGIN_BASED", targetGrossPercentage: "0.3000", priceSourceType: "VENDOR_QUOTE", sourceNote: "Reference purchase price solid surface per meter dari vendor countertop, efektif Juni 2026.", effectiveFrom: new Date("2026-06-01T00:00:00Z"), updatedById: "11111111-1111-1111-1111-111111111111" },
    ]);

    await tx.insert(itemPriceLibraryCostComponent).values([
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434101", vendorId: "55555555-5555-5555-5555-555555555551", componentType: "MATERIAL", label: "Panel plywood 18mm", quantity: "1.00", unit: "lembar", unitCost: "250000.00", totalCost: "250000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434102", vendorId: "55555555-5555-5555-5555-555555555551", componentType: "MATERIAL", label: "HPL Taco T-123", quantity: "1.00", unit: "lembar", unitCost: "200000.00", totalCost: "200000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434103", componentType: "LABOR", label: "Kepala tukang", quantity: "10.00", unit: "hari", unitCost: "600000.00", totalCost: "6000000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434103", componentType: "LABOR", label: "4 installer", quantity: "40.00", unit: "orang-hari", unitCost: "650000.00", totalCost: "26000000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434103", componentType: "EQUIPMENT", label: "Consumable dan alat instalasi", quantity: "1.00", unit: "ls", unitCost: "4000000.00", totalCost: "4000000.00", displayOrder: 3 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434103", componentType: "LOGISTICS", label: "Mobilisasi tim", quantity: "1.00", unit: "ls", unitCost: "3500000.00", totalCost: "3500000.00", displayOrder: 4 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434103", componentType: "OVERHEAD", label: "Site supervision dan contingency", quantity: "1.00", unit: "ls", unitCost: "5500000.00", totalCost: "5500000.00", displayOrder: 5 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434104", vendorId: "55555555-5555-5555-5555-555555555553", componentType: "MATERIAL", label: "Stone slab dan fabrikasi", quantity: "1.00", unit: "ls", unitCost: "35000000.00", totalCost: "35000000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434104", vendorId: "55555555-5555-5555-5555-555555555553", componentType: "LOGISTICS", label: "Delivery dan instalasi", quantity: "1.00", unit: "ls", unitCost: "6000000.00", totalCost: "6000000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434105", componentType: "LABOR", label: "Project coordination", quantity: "1.00", unit: "ls", unitCost: "7000000.00", totalCost: "7000000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434105", componentType: "LOGISTICS", label: "Logistics allowance", quantity: "1.00", unit: "ls", unitCost: "3000000.00", totalCost: "3000000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434105", componentType: "OVERHEAD", label: "Administration", quantity: "1.00", unit: "ls", unitCost: "2000000.00", totalCost: "2000000.00", displayOrder: 3 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434106", vendorId: "55555555-5555-5555-5555-555555555551", componentType: "MATERIAL", label: "MDF 12mm MR", quantity: "1.00", unit: "lembar", unitCost: "185000.00", totalCost: "185000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434107", vendorId: "55555555-5555-5555-5555-555555555552", componentType: "MATERIAL", label: "Soft-close hardware set", quantity: "1.00", unit: "set", unitCost: "750000.00", totalCost: "750000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434108", componentType: "MATERIAL", label: "PU coating materials", quantity: "1.00", unit: "paket", unitCost: "3200000.00", totalCost: "3200000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434108", componentType: "OTHER", label: "Finishing consumables", quantity: "1.00", unit: "paket", unitCost: "800000.00", totalCost: "800000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434109", vendorId: "55555555-5555-5555-5555-555555555552", componentType: "MATERIAL", label: "LED strip, driver, profile", quantity: "1.00", unit: "meter", unitCost: "225000.00", totalCost: "225000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434110", vendorId: "55555555-5555-5555-5555-555555555552", componentType: "MATERIAL", label: "Mirror 5mm bevel", quantity: "1.00", unit: "m2", unitCost: "500000.00", totalCost: "500000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434111", componentType: "LABOR", label: "Workshop production crew", quantity: "1.00", unit: "ls", unitCost: "68000000.00", totalCost: "68000000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434111", componentType: "EQUIPMENT", label: "Machine and consumable allowance", quantity: "1.00", unit: "ls", unitCost: "7000000.00", totalCost: "7000000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434111", componentType: "OVERHEAD", label: "Workshop supervision", quantity: "1.00", unit: "ls", unitCost: "5000000.00", totalCost: "5000000.00", displayOrder: 3 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434112", componentType: "LABOR", label: "Finishing and snagging crew", quantity: "1.00", unit: "ls", unitCost: "17000000.00", totalCost: "17000000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434112", componentType: "OTHER", label: "Touch-up consumables", quantity: "1.00", unit: "ls", unitCost: "3000000.00", totalCost: "3000000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434113", vendorId: "55555555-5555-5555-5555-555555555552", componentType: "MATERIAL", label: "Glass and mirror fabrication", quantity: "1.00", unit: "ls", unitCost: "25000000.00", totalCost: "25000000.00", displayOrder: 1 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434113", vendorId: "55555555-5555-5555-5555-555555555552", componentType: "LABOR", label: "Electrical installation and testing", quantity: "1.00", unit: "ls", unitCost: "15000000.00", totalCost: "15000000.00", displayOrder: 2 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434113", vendorId: "55555555-5555-5555-5555-555555555552", componentType: "LOGISTICS", label: "Delivery and specialist mobilization", quantity: "1.00", unit: "ls", unitCost: "4000000.00", totalCost: "4000000.00", displayOrder: 3 },
      { itemPriceLibraryId: "43434343-4343-4343-4343-434343434114", vendorId: "55555555-5555-5555-5555-555555555553", componentType: "MATERIAL", label: "Solid surface white countertop", quantity: "1.00", unit: "meter", unitCost: "2000000.00", totalCost: "2000000.00", note: "Reference material cost before project-specific fabrication allowance.", displayOrder: 1 },
    ]);

    // 7. Seed Projects
    console.log("Seeding projects...");
    await tx.insert(project).values([
      {
        id: "77777777-7777-7777-7777-777777777771",
        name: "Menteng Villa - Kitchen & Living Room Fit-Out",
        clientId: "44444444-4444-4444-4444-444444444441",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "800000000.00",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-09-01"),
        location: "Jl. Menteng Raya No. 12, Jakarta Pusat",
        roomArea: "Kitchen & Living Room",
        projectType: "Fit-Out",
        notes: "Proyek interior rumah tinggal mewah gaya modern klasik.",
      },
      {
        id: "77777777-7777-7777-7777-777777777772",
        name: "Sudirman Suites - Penthouse Fit-Out",
        clientId: "44444444-4444-4444-4444-444444444442",
        projectManagerId: "33333333-3333-3333-3333-333333333332",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "1200000000.00",
        startDate: new Date("2026-06-15"),
        endDate: new Date("2026-10-15"),
        location: "Sudirman Suites Tower B Lt. 42, Jakarta Selatan",
        roomArea: "Penthouse",
        projectType: "Fit-Out",
        notes: "Renovasi unit penthouse apartemen dengan spesifikasi premium.",
      },
      {
        id: "77777777-7777-7777-7777-777777777773",
        name: "Brawijaya Residence - RAB Sandbox",
        clientId: "44444444-4444-4444-4444-444444444443",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "650000000.00",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-10-30"),
        location: "Jl. Brawijaya III No. 5, Jakarta Selatan",
        roomArea: "Seluruh Rumah",
        projectType: "Renovasi",
        notes: "Sandbox RAB untuk manual testing dan pengujian budget.",
      },
    ]);

    // 8. Seed Budgets
    console.log("Seeding budgets...");
    await tx.insert(projectBudget).values([
      {
        id: "88888888-8888-8888-8888-888888888881",
        projectId: "77777777-7777-7777-7777-777777777771",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-05-28T09:00:00Z"),
        notes: "RAB disetujui Owner & Client untuk Menteng Villa",
      },
      {
        id: "88888888-8888-8888-8888-888888888882",
        projectId: "77777777-7777-7777-7777-777777777772",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-06-14T10:00:00Z"),
        notes: "RAB disetujui Owner & Client untuk Sudirman Suites",
      },
    ]);

    console.log("Seeding RAP material plans...");
    await tx.insert(projectRap).values([
      {
        id: "16161616-1616-1616-1616-161616161601",
        projectId: "77777777-7777-7777-7777-777777777771",
        status: "LOCKED",
        revision: 1,
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: new Date("2026-05-30T08:00:00Z"),
        notes: "Baseline RAP material untuk kitchen dan living room.",
      },
      {
        id: "16161616-1616-1616-1616-161616161602",
        projectId: "77777777-7777-7777-7777-777777777772",
        status: "DRAFT",
        revision: 1,
        notes: "RAP awal penthouse, masih menunggu finalisasi material finishing.",
      },
    ]);

    await tx.insert(projectRapItem).values([
      {
        id: "17171717-1717-1717-1717-171717171701",
        projectRapId: "16161616-1616-1616-1616-161616161601",
        materialId: "13131313-1313-1313-1313-131313131301",
        area: "Kitchen",
        name: "Multipleks kabinet kitchen",
        requiredQuantity: "45.00",
        bufferQuantity: "5.00",
        totalQuantity: "50.00",
        unit: "lembar",
        estimatedUnitCost: "250000.00",
        estimatedTotalCost: "12500000.00",
        source: "STOCK_AND_PURCHASE",
        status: "WAITING_PURCHASE",
        internalNote: "Gunakan stok gudang dulu, sisanya beli bertahap.",
      },
      {
        id: "17171717-1717-1717-1717-171717171702",
        projectRapId: "16161616-1616-1616-1616-161616161601",
        materialId: "13131313-1313-1313-1313-131313131302",
        area: "Living Room",
        name: "HPL panel TV wall",
        requiredQuantity: "20.00",
        bufferQuantity: "2.00",
        totalQuantity: "22.00",
        unit: "lembar",
        estimatedUnitCost: "200000.00",
        estimatedTotalCost: "4400000.00",
        source: "PURCHASE",
        status: "SHORTAGE",
        internalNote: "Stok tersedia rendah, perlu purchase.",
      },
      {
        id: "17171717-1717-1717-1717-171717171703",
        projectRapId: "16161616-1616-1616-1616-161616161601",
        materialId: "13131313-1313-1313-1313-131313131303",
        area: "Kitchen",
        name: "Solid surface kitchen top",
        requiredQuantity: "12.00",
        bufferQuantity: "1.00",
        totalQuantity: "13.00",
        unit: "meter",
        estimatedUnitCost: "2000000.00",
        estimatedTotalCost: "26000000.00",
        source: "PURCHASE",
        status: "PLANNED",
      },
    ]);

    await tx.insert(stockMovement).values([
      {
        id: "18181818-1818-1818-1818-181818181801",
        materialId: "13131313-1313-1313-1313-131313131301",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        movementType: "RESERVE",
        quantity: "20.00",
        unitCost: "245000.00",
        note: "Reservasi awal dari stok gudang untuk kabinet kitchen Menteng.",
        createdById: "33333333-3333-3333-3333-333333333333",
      },
      {
        id: "18181818-1818-1818-1818-181818181802",
        materialId: "13131313-1313-1313-1313-131313131302",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectRapItemId: "17171717-1717-1717-1717-171717171702",
        movementType: "RESERVE",
        quantity: "8.00",
        unitCost: "190000.00",
        note: "Reservasi HPL yang tersedia, sisanya masuk daftar need to buy.",
        createdById: "33333333-3333-3333-3333-333333333333",
      },
    ]);

    await tx.insert(rabEstimate).values([
      {
        id: "19191919-1919-1919-1919-191919191901",
        projectId: "77777777-7777-7777-7777-777777777771",
        sourceProjectRapId: "16161616-1616-1616-1616-161616161601",
        status: "APPROVED",
        revision: 1,
        title: "RAB Kitchen & Living Room Fit-Out",
        clientNotes: "Estimasi client-facing yang sudah dibundling dan disetujui. Detail internal RAP, vendor, stock, dan margin tidak ditampilkan.",
        approvedValue: "800000000.00",
        approvedAt: new Date("2026-05-28T09:30:00Z"),
      },
    ]);

    await tx.insert(rabEstimateItem).values([
      {
        id: "20202020-2020-2020-2020-202020202001",
        rabEstimateId: "19191919-1919-1919-1919-191919191901",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171701",
        clientLabel: "Kitchen cabinetry package",
        description: "Supply, fabrikasi, finishing, dan instalasi kabinet kitchen sesuai desain final.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "360000000.00",
        lineTotal: "360000000.00",
        displayOrder: 1,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202002",
        rabEstimateId: "19191919-1919-1919-1919-191919191901",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171702",
        clientLabel: "Living room feature wall",
        description: "Panel TV wall dan finishing living room sesuai moodboard.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "180000000.00",
        lineTotal: "180000000.00",
        displayOrder: 2,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202003",
        rabEstimateId: "19191919-1919-1919-1919-191919191901",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171703",
        clientLabel: "Kitchen countertop",
        description: "Supply dan instalasi top table kitchen.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "75000000.00",
        lineTotal: "75000000.00",
        displayOrder: 3,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202004",
        rabEstimateId: "19191919-1919-1919-1919-191919191901",
        sourceType: "MANUAL",
        clientLabel: "Site installation and finishing works",
        description: "Pekerjaan tukang, instalasi, adjustment, dan finishing lapangan.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "130000000.00",
        lineTotal: "130000000.00",
        displayOrder: 4,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202005",
        rabEstimateId: "19191919-1919-1919-1919-191919191901",
        sourceType: "MANUAL",
        clientLabel: "Project coordination and logistics",
        description: "Koordinasi proyek, mobilisasi, handling, dan dokumentasi progress.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "55000000.00",
        lineTotal: "55000000.00",
        displayOrder: 5,
        isBundle: true,
      },
    ]);

    // 9. Seed Budget Items (Pristine: Spent is initially 0.00!)
    console.log("Seeding budget items...");
    await tx.insert(projectBudgetItem).values([
      // Menteng Items
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Multipleks 18mm Meranti",
        budgetCategory: "Material Kayu",
        quantity: "100.00",
        unit: "lembar",
        unitPrice: "250000.00",
        allocatedAmount: "25000000.00",
        actualSpent: "0.00", // Start at 0!
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "HPL Taco Light Oak (T-123)",
        budgetCategory: "Material Finishing",
        quantity: "80.00",
        unit: "lembar",
        unitPrice: "200000.00",
        allocatedAmount: "16000000.00",
        actualSpent: "0.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Solid Surface White Countertop",
        budgetCategory: "Material Countertop",
        quantity: "15.00",
        unit: "meter",
        unitPrice: "2000000.00",
        allocatedAmount: "30000000.00",
        actualSpent: "0.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999993",
        name: "Transportasi & Mobilisasi Lapangan",
        budgetCategory: "Operasional Lapangan",
        quantity: "15.00",
        unit: "trip",
        unitPrice: "350000.00",
        allocatedAmount: "5250000.00",
        actualSpent: "0.00", // Start at 0!
      },
      // Sudirman Items
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Multipleks 18mm Meranti",
        budgetCategory: "Material Kayu",
        quantity: "200.00",
        unit: "lembar",
        unitPrice: "250000.00",
        allocatedAmount: "50000000.00",
        actualSpent: "0.00",
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Kaca Tempered 10mm",
        budgetCategory: "Kaca & Besi",
        quantity: "50.00",
        unit: "m2",
        unitPrice: "600000.00",
        allocatedAmount: "30000000.00",
        actualSpent: "0.00",
      },
    ]);

    console.log("Seeding Project Budget Control records...");
    const mentengContractValue = 800000000;
    const sudirmanContractValue = 1200000000;
    const sandboxContractValue = 650000000;
    const mentengInternalBudget = calculateInternalBudget(mentengContractValue);
    const sudirmanInternalBudget = calculateInternalBudget(sudirmanContractValue);
    const sandboxInternalBudget = calculateInternalBudget(sandboxContractValue);
    const mentengGross = calculateTargetGross(mentengContractValue, mentengInternalBudget);
    const sudirmanGross = calculateTargetGross(sudirmanContractValue, sudirmanInternalBudget);
    const sandboxGross = calculateTargetGross(sandboxContractValue, sandboxInternalBudget);

    await tx.insert(projectBudgets).values([
      {
        id: "30303030-3030-3030-3030-303030303001",
        projectId: "77777777-7777-7777-7777-777777777771",
        legacyProjectBudgetId: "88888888-8888-8888-8888-888888888881",
        status: "APPROVED",
        contractValue: mentengContractValue.toFixed(2),
        approvedRabValue: mentengContractValue.toFixed(2),
        internalBudget: mentengInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: mentengGross.amount.toFixed(2),
        targetGrossPercentage: mentengGross.percentage.toFixed(4),
        projectProgressPercentage: "60.0000",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-05-28T09:00:00Z"),
        notes: "Project Budget Control seed using Dekoria default category ratios.",
      },
      {
        id: "30303030-3030-3030-3030-303030303002",
        projectId: "77777777-7777-7777-7777-777777777772",
        legacyProjectBudgetId: "88888888-8888-8888-8888-888888888882",
        status: "APPROVED",
        contractValue: sudirmanContractValue.toFixed(2),
        approvedRabValue: sudirmanContractValue.toFixed(2),
        internalBudget: sudirmanInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: sudirmanGross.amount.toFixed(2),
        targetGrossPercentage: sudirmanGross.percentage.toFixed(4),
        projectProgressPercentage: "35.0000",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-06-14T10:00:00Z"),
        notes: "Project Budget Control seed using Dekoria default category ratios.",
      },
      {
        id: "30303030-3030-3030-3030-303030303003",
        projectId: "77777777-7777-7777-7777-777777777773",
        status: "DRAFT",
        contractValue: sandboxContractValue.toFixed(2),
        approvedRabValue: "0.00",
        internalBudget: sandboxInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: sandboxGross.amount.toFixed(2),
        targetGrossPercentage: sandboxGross.percentage.toFixed(4),
        projectProgressPercentage: "0.0000",
        notes: "Sandbox budget setup: categories are ready, but RAP and client RAB are intentionally empty for manual testing.",
      },
    ]);

    const seededBudgetCategories = [
      {
        id: "32323232-3232-3232-3232-323232323101",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        ratio: 0.18,
        internalBudget: mentengInternalBudget,
        sortOrder: 10,
      },
      {
        id: "32323232-3232-3232-3232-323232323102",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        ratio: 0.35,
        internalBudget: mentengInternalBudget,
        sortOrder: 20,
      },
      {
        id: "32323232-3232-3232-3232-323232323103",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        ratio: 0.01,
        internalBudget: mentengInternalBudget,
        sortOrder: 30,
      },
      {
        id: "32323232-3232-3232-3232-323232323104",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        ratio: 0.005,
        internalBudget: mentengInternalBudget,
        sortOrder: 40,
      },
      {
        id: "32323232-3232-3232-3232-323232323105",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        ratio: 0,
        internalBudget: mentengInternalBudget,
        sortOrder: 50,
      },
      {
        id: "32323232-3232-3232-3232-323232323201",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        ratio: 0.18,
        internalBudget: sudirmanInternalBudget,
        sortOrder: 10,
      },
      {
        id: "32323232-3232-3232-3232-323232323202",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        ratio: 0.35,
        internalBudget: sudirmanInternalBudget,
        sortOrder: 20,
      },
      {
        id: "32323232-3232-3232-3232-323232323203",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        ratio: 0.01,
        internalBudget: sudirmanInternalBudget,
        sortOrder: 30,
      },
      {
        id: "32323232-3232-3232-3232-323232323204",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        ratio: 0.005,
        internalBudget: sudirmanInternalBudget,
        sortOrder: 40,
      },
      {
        id: "32323232-3232-3232-3232-323232323205",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        ratio: 0,
        internalBudget: sudirmanInternalBudget,
        sortOrder: 50,
      },
      {
        id: "32323232-3232-3232-3232-323232323301",
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        ratio: 0.18,
        internalBudget: sandboxInternalBudget,
        sortOrder: 10,
      },
      {
        id: "32323232-3232-3232-3232-323232323302",
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        ratio: 0.35,
        internalBudget: sandboxInternalBudget,
        sortOrder: 20,
      },
      {
        id: "32323232-3232-3232-3232-323232323303",
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        ratio: 0.01,
        internalBudget: sandboxInternalBudget,
        sortOrder: 30,
      },
      {
        id: "32323232-3232-3232-3232-323232323304",
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        ratio: 0.005,
        internalBudget: sandboxInternalBudget,
        sortOrder: 40,
      },
      {
        id: "32323232-3232-3232-3232-323232323305",
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        ratio: 0,
        internalBudget: sandboxInternalBudget,
        sortOrder: 50,
      },
    ] as const;

    await tx.insert(projectBudgetCategory).values(
      seededBudgetCategories.map((category) => {
        const allocatedAmount = category.internalBudget * category.ratio;
        return {
          id: category.id,
          projectBudgetId: category.projectBudgetId,
          expenseCategoryId: category.expenseCategoryId,
          ratioPercentage: category.ratio.toFixed(6),
          allocatedAmount: allocatedAmount.toFixed(2),
          pendingAmount: "0.00",
          actualAmount: "0.00",
          paidAmount: "0.00",
          remainingAmount: allocatedAmount.toFixed(2),
          usedPercentage: "0.0000",
          status: "SAFE",
          sortOrder: category.sortOrder,
        };
      })
    );

    console.log("Seeding Tukang/Subcon category plan packages...");
    await tx.insert(projectCategoryPlanItem).values([
      {
        id: "35353535-3535-3535-3535-353535353501",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323101",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        name: "Kitchen & living installation crew",
        scopeDescription: "Tim tukang produksi, instalasi, adjustment, dan finishing lapangan untuk area kitchen/living.",
        area: "Kitchen + Living",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "130000000.00",
        estimatedTotalCost: "130000000.00",
        status: "ACTIVE",
        internalNote: "Pantau jika lembur instalasi melewati rencana minggu kedua.",
        displayOrder: 1,
      },
      {
        id: "35353535-3535-3535-3535-353535353502",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323105",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        vendorId: "55555555-5555-5555-5555-555555555553",
        name: "Stone countertop fabrication",
        scopeDescription: "Fabrication support untuk top table dan finishing edge khusus.",
        area: "Kitchen",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "75000000.00",
        estimatedTotalCost: "75000000.00",
        status: "DRAFT",
        internalNote: "Aktifkan hanya jika scope countertop dipisah ke vendor/subcon.",
        displayOrder: 2,
      },
    ]);

    // 10. Seed Client Invoices
    console.log("Seeding client invoices...");
    await tx.insert(clientInvoice).values([
      // Menteng
      {
        id: "01010101-0101-0101-0101-010101010101",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/001",
        amount: "240000000.00",
        status: "PAID",
        stage: "DP",
        dueDate: new Date("2026-06-05T23:59:59Z"),
        notes: "Invoice DP 30% Klien Adrian Hartanto - Menteng Villa",
      },
      {
        id: "01010101-0101-0101-0101-010101010102",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/002",
        amount: "320000000.00",
        status: "UNPAID",
        stage: "PROGRESS_1",
        dueDate: new Date("2026-07-15T23:59:59Z"),
        notes: "Termin 2 - Progress Pekerjaan Kayu 50% (Dapat diuji pembayaran)",
      },
      // Sudirman
      {
        id: "01010101-0101-0101-0101-010101010103",
        projectId: "77777777-7777-7777-7777-777777777772",
        invoiceNumber: "INV/2026/003",
        amount: "360000000.00",
        status: "PAID",
        stage: "DP",
        dueDate: new Date("2026-06-20T23:59:59Z"),
        notes: "Invoice DP 30% Klien Haryanto Wijaya - Sudirman Suites",
      },
    ]);

    // 11. Seed Cash Transactions (Ledger Entries)
    console.log("Seeding ledger cash transactions...");
    await tx.insert(cashTransaction).values([
      // Client Inflow Menteng
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "DEBIT",
        category: "client_payment",
        amount: "240000000.00",
        description: "Pembayaran Termin DP 30% - Adrian Hartanto (Menteng Villa)",
        reconciled: true,
        reconciliationDate: new Date("2026-06-02T10:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020201",
      },
      // Petty Cash Funding Transfer Budi
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc02",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "CREDIT",
        category: "transfer",
        amount: "15000000.00",
        description: "Transfer Pendanaan Awal Petty Cash Proyek - PM Budi",
        reconciled: true,
        reconciliationDate: new Date("2026-06-03T11:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
      },
      // Client Inflow Sudirman (Paid into BCA Operasional directly)
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "DEBIT",
        category: "client_payment",
        amount: "360000000.00",
        description: "Pembayaran Termin DP 30% - Haryanto Wijaya (Sudirman Suites)",
        reconciled: true,
        reconciliationDate: new Date("2026-06-16T14:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020202",
      },
    ]);

    // Update BCA Operasional balance to reflect client inflows and transfer:
    // Initial (0) + 240M (Menteng Inflow) - 15M (Budi Petty Cash Outflow) + 360M (Sudirman Inflow) = 585M
    await tx
      .update(bankAccount)
      .set({ balance: "585000000.00" })
      .where(eq(bankAccount.id, "66666666-6666-6666-6666-666666666661"));

    // 12. Seed Client Payments
    console.log("Seeding client payments...");
    await tx.insert(clientPayment).values([
      {
        id: "02020202-0202-0202-0202-020202020201",
        clientInvoiceId: "01010101-0101-0101-0101-010101010101",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc01",
        amountPaid: "240000000.00",
        paymentDate: new Date("2026-06-02T09:15:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-BCA-1029",
      },
      {
        id: "02020202-0202-0202-0202-020202020202",
        clientInvoiceId: "01010101-0101-0101-0101-010101010103",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        amountPaid: "360000000.00",
        paymentDate: new Date("2026-06-16T13:00:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-BCA-5523",
      },
    ]);

    // 13. Seed Vendor Bills
    console.log("Seeding vendor bills...");
    await tx.insert(vendorBill).values([
      {
        id: "33033303-3303-3303-3303-330333033301",
        vendorId: "55555555-5555-5555-5555-555555555551",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        materialId: "13131313-1313-1313-1313-131313131301",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        billNumber: "BILL-2026-091",
        amount: "20000000.00",
        status: "APPROVED",
        dueDate: new Date("2026-06-30T23:59:59Z"),
        notes: "Invoice pembelian material kayu panel Multipleks - PT Cahaya Mas",
      },
    ]);

    console.log("Seeding planned vendor payments...");
    await tx.insert(vendorPayment).values({
      id: "34043404-3404-3404-3404-340434043401",
      vendorBillId: "33033303-3303-3303-3303-330333033301",
      bankAccountId: "66666666-6666-6666-6666-666666666661",
      cashTransactionId: null,
      amountPaid: "4000000.00",
      status: "PENDING",
      paymentDate: new Date("2026-07-20T03:00:00Z"),
      paidById: "22222222-2222-2222-2222-222222222222",
      referenceNumber: null,
      createdAt: new Date("2026-07-18T03:00:00Z"),
    });

    // 14. Seed Project Costs (Field Expenses)
    console.log("Seeding project field costs & approvals...");

    // Cost 1: PM Claim (Approved but unpaid, to test disburse)
    const cost1Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001";
    await tx.insert(projectCost).values({
      id: cost1Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323103",
      requestedById: "33333333-3333-3333-3333-333333333331",
      quantity: "3.00",
      unitPrice: "350000.00",
      amount: "1050000.00",
      description: "Operasional bensin & e-toll trip supervisi tim tukang",
      receiptImageUrl: "http://localhost:3000/receipt_test.png",
      status: "APPROVED",
      budgetOverrun: false,
      createdAt: new Date("2026-06-10T14:00:00Z"),
      updatedAt: new Date("2026-06-11T09:00:00Z"),
    });

    // Cost 2: PM Claim (Submitted, Rp 5.0M, requires Owner approval because >= Rp 5M)
    const cost2Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002";
    await tx.insert(projectCost).values({
      id: cost2Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
      materialId: "13131313-1313-1313-1313-131313131301",
      projectRapItemId: "17171717-1717-1717-1717-171717171701",
      requestedById: "33333333-3333-3333-3333-333333333331",
      quantity: "20.00",
      unitPrice: "250000.00",
      amount: "5000000.00",
      description: "Pembelian tripleks tambahan mendesak karena perubahan desain",
      receiptImageUrl: "http://localhost:3000/receipt_test.png",
      status: "SUBMITTED",
      budgetOverrun: false,
      createdAt: new Date("2026-06-12T10:00:00Z"),
      updatedAt: new Date("2026-06-12T10:00:00Z"),
    });

    console.log("Seeding canonical category expenses and profitability snapshots...");
    await tx.insert(projectExpenses).values([
      {
        id: "34343434-3434-3434-3434-343434343400",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        vendorId: "55555555-5555-5555-5555-555555555551",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Invoice pembelian material kayu panel Multipleks - PT Cahaya Mas",
        quantity: "1.00",
        unitCost: "20000000.00",
        amount: "20000000.00",
        expenseDate: new Date("2026-06-15T10:00:00Z"),
        paymentStatus: "UNPAID",
        status: "APPROVED",
      },
      {
        id: "34343434-3434-3434-3434-343434343403",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        materialId: "13131313-1313-1313-1313-131313131302",
        projectRapItemId: "17171717-1717-1717-1717-171717171702",
        requestedById: "22222222-2222-2222-2222-222222222222",
        description: "Batch pembelian material finishing dan panel utama untuk fase produksi.",
        quantity: "1.00",
        unitCost: "180000000.00",
        amount: "180000000.00",
        expenseDate: new Date("2026-06-13T11:00:00Z"),
        paymentStatus: "PAID",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343401",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323103",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        legacyProjectCostId: cost1Id,
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Operasional bensin & e-toll trip supervisi tim tukang",
        quantity: "3.00",
        unitCost: "350000.00",
        amount: "1050000.00",
        expenseDate: new Date("2026-06-10T14:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "http://localhost:3000/receipt_test.png",
        status: "APPROVED",
      },
      {
        id: "34343434-3434-3434-3434-343434343404",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323101",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        projectCategoryPlanItemId: "35353535-3535-3535-3535-353535353501",
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Termin tukang produksi dan instalasi minggu kedua.",
        quantity: "1.00",
        unitCost: "72000000.00",
        amount: "72000000.00",
        expenseDate: new Date("2026-06-14T16:00:00Z"),
        paymentStatus: "PAID",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343405",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323104",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        requestedById: "22222222-2222-2222-2222-222222222222",
        description: "Biaya administrasi kecil, consumable workshop, dan kebutuhan minor proyek.",
        quantity: "1.00",
        unitCost: "2500000.00",
        amount: "2500000.00",
        expenseDate: new Date("2026-06-15T09:00:00Z"),
        paymentStatus: "PAID",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343402",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        legacyProjectCostId: cost2Id,
        materialId: "13131313-1313-1313-1313-131313131301",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Pembelian tripleks tambahan mendesak karena perubahan desain",
        quantity: "20.00",
        unitCost: "250000.00",
        amount: "5000000.00",
        expenseDate: new Date("2026-06-12T10:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "http://localhost:3000/receipt_test.png",
        status: "SUBMITTED",
      },
    ]);

    const tukangActual = 72000000;
    const tukangAllocated = mentengInternalBudget * 0.18;
    const tukangUsed = calculateUsedPercentage(tukangActual, tukangAllocated);
    const materialActual = 200000000;
    const materialPending = 5000000;
    const materialAllocated = mentengInternalBudget * 0.35;
    const materialUsed = calculateUsedPercentage(materialActual, materialAllocated);
    const operationalActual = 1050000;
    const operationalAllocated = mentengInternalBudget * 0.01;
    const operationalUsed = calculateUsedPercentage(operationalActual, operationalAllocated);
    const lainLainActual = 2500000;
    const lainLainAllocated = mentengInternalBudget * 0.005;
    const lainLainUsed = calculateUsedPercentage(lainLainActual, lainLainAllocated);
    const mentengActualCost = tukangActual + materialActual + operationalActual + lainLainActual;
    const mentengBudgetUsed = calculateUsedPercentage(mentengActualCost, mentengInternalBudget);

    await tx.update(projectBudgetCategory)
      .set({
        actualAmount: tukangActual.toFixed(2),
        pendingAmount: "0.00",
        paidAmount: tukangActual.toFixed(2),
        remainingAmount: (tukangAllocated - tukangActual).toFixed(2),
        usedPercentage: tukangUsed.toFixed(4),
        status: getBudgetCategoryStatus(tukangUsed),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetCategory.id, "32323232-3232-3232-3232-323232323101"));

    await tx.update(projectBudgetCategory)
      .set({
        actualAmount: materialActual.toFixed(2),
        pendingAmount: materialPending.toFixed(2),
        paidAmount: "180000000.00",
        remainingAmount: (materialAllocated - materialActual).toFixed(2),
        usedPercentage: materialUsed.toFixed(4),
        status: getBudgetCategoryStatus(materialUsed),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetCategory.id, "32323232-3232-3232-3232-323232323102"));

    await tx.update(projectBudgetCategory)
      .set({
        actualAmount: operationalActual.toFixed(2),
        pendingAmount: "0.00",
        paidAmount: "0.00",
        remainingAmount: (operationalAllocated - operationalActual).toFixed(2),
        usedPercentage: operationalUsed.toFixed(4),
        status: getBudgetCategoryStatus(operationalUsed),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetCategory.id, "32323232-3232-3232-3232-323232323103"));

    await tx.update(projectBudgetCategory)
      .set({
        actualAmount: lainLainActual.toFixed(2),
        pendingAmount: "0.00",
        paidAmount: lainLainActual.toFixed(2),
        remainingAmount: (lainLainAllocated - lainLainActual).toFixed(2),
        usedPercentage: lainLainUsed.toFixed(4),
        status: getBudgetCategoryStatus(lainLainUsed),
        updatedAt: new Date(),
      })
      .where(eq(projectBudgetCategory.id, "32323232-3232-3232-3232-323232323104"));

    await tx.insert(projectProfitabilitySnapshot).values({
      id: "35353535-3535-3535-3535-353535353501",
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetId: "30303030-3030-3030-3030-303030303001",
      contractValue: mentengContractValue.toFixed(2),
      approvedRabValue: mentengContractValue.toFixed(2),
      internalBudget: mentengInternalBudget.toFixed(2),
      actualCost: mentengActualCost.toFixed(2),
      remainingBudget: (mentengInternalBudget - mentengActualCost).toFixed(2),
      budgetUsedPercentage: mentengBudgetUsed.toFixed(4),
      targetGrossAmount: mentengGross.amount.toFixed(2),
      targetGrossPercentage: mentengGross.percentage.toFixed(4),
      projectedFinalCost: mentengInternalBudget.toFixed(2),
      projectedMarginAmount: mentengGross.amount.toFixed(2),
      projectedMarginPercentage: mentengGross.percentage.toFixed(4),
      materialBudget: materialAllocated.toFixed(2),
      materialActual: materialActual.toFixed(2),
      materialRemaining: (materialAllocated - materialActual).toFixed(2),
      materialUsedPercentage: materialUsed.toFixed(4),
      materialStockValueApplied: "6420000.00",
      materialShortageValue: "42900000.00",
      leftoverStockValue: "12235000.00",
      riskStatus: getBudgetCategoryStatus(mentengBudgetUsed),
    });

    await tx.insert(approval).values({
      id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e002",
      approverId: "11111111-1111-1111-1111-111111111111",
      referenceType: "project_cost",
      referenceId: cost2Id,
      status: "PENDING",
      notes: "Nominal pengeluaran lapangan mencapai/melebihi Rp 5.000.000.",
    });

    // 15. Seed Notifications
    console.log("Seeding notifications...");
    await tx.insert(notification).values([
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd01",
        userId: "11111111-1111-1111-1111-111111111111",
        title: "Persetujuan Biaya Lapangan Baru",
        message: "PM Budi mengajukan biaya sebesar Rp 5.000.000 untuk tripleks tambahan.",
        read: false,
        severity: "INFO",
        referenceType: "project_cost",
        referenceId: cost2Id,
      },
    ]);

    // 16. Seed Audit Logs
    console.log("Seeding audit logs...");
    await tx.insert(auditLog).values([
      {
        id: "99099909-9909-9909-9909-990999099901",
        userId: "22222222-2222-2222-2222-222222222222",
        action: "RECORD_CLIENT_PAYMENT",
        targetTable: "client_invoice",
        targetId: "01010101-0101-0101-0101-010101010101",
        originalState: '{"status": "UNPAID"}',
        newState: '{"status": "PAID"}',
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      },
    ]);
  });

  console.log("Clean sandbox database seeding completed successfully!");
  console.log("Test user credentials:");
  console.log("- Ronald (Owner): ronald@dekoria.com / password123");
  console.log("- Lisa (Finance Admin): lisa@dekoria.com / password123");
  console.log("- Budi (Project Manager): budi@dekoria.com / password123");
  console.log("- Agus (Purchasing): agus@dekoria.com / password123");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
