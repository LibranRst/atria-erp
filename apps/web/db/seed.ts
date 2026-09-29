import crypto from "crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS } from "@atria/core/finance/approval-thresholds";

import { auth } from "@/lib/auth";
import { db } from "./index";
import {
  role,
  rolePermission,
  user,
  tenantMember,
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
  projectRap,
  projectRapItem,
  stockMovement,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
  projectChangeOrder,
  approval,
  notification,
  auditLog,
  account,
  goodsReceiptItem,
  goodsReceipt,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  stockTransfer,
  stockTransferItem,
  stockCount,
  stockCountItem,
  bankStatementImport,
  bankStatementRow,
  formDraft,
  appConfig,
} from "./schema";
import { DEKORIA_TENANT_ID } from "./schema/tenant-constants";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXCEL_BUDGET_CAP_RATIO,
  calculateInternalBudget,
  calculateTargetGross,
  calculateUsedPercentage,
} from "@atria/core/budget/excel-budget";
import { syncProjectBudgetCategories } from "@/lib/budget/budget-sync";
import { OWNER_ONBOARDING_CONFIG_KEY } from "@atria/core/onboarding/owner-onboarding";
import {
  createDemoCsvFixtures,
  DEMO_FIXTURE_DIRECTORY,
  DEMO_IDS,
  demoClockFromEnvironment,
  formatMinorMoney,
  parseMoneyToMinor,
} from "./seed/demo-contract";

function assertSeedInvariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Seed invariant failed: ${message}`);
}

function bankStatementFingerprint({
  bankAccountId,
  transactionDate,
  type,
  amount,
  description,
}: {
  readonly bankAccountId: string;
  readonly transactionDate: Date;
  readonly type: "INFLOW" | "OUTFLOW";
  readonly amount: string;
  readonly description: string;
}): string {
  const normalizedDescription = description.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
  return crypto
    .createHash("sha256")
    .update(
      `${bankAccountId}|${transactionDate.toISOString().slice(0, 10)}|${type}|${formatMinorMoney(parseMoneyToMinor(amount))}|${normalizedDescription}`,
    )
    .digest("hex");
}

function describeDatabaseTarget(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL wajib tersedia untuk demo seed.");
  const url = new URL(connectionString);
  return `${url.hostname}/${url.pathname.replace(/^\//, "") || "postgres"}`;
}

async function assertDemoDatabaseIsEmpty(): Promise<void> {
  const [existingRole, existingUser, existingProject, existingBankAccount] = await Promise.all([
    db.query.role.findFirst({ columns: { id: true } }),
    db.query.user.findFirst({ columns: { id: true } }),
    db.query.project.findFirst({ columns: { id: true } }),
    db.query.bankAccount.findFirst({ columns: { id: true } }),
  ]);
  if (existingRole || existingUser || existingProject || existingBankAccount) {
    throw new Error(
      "DEMO_DATABASE_NOT_EMPTY: db:seed tidak menghapus data. Gunakan `bun run db:demo:reset --confirm-reset` hanya pada sandbox yang memang boleh dikosongkan.",
    );
  }
}

async function writeDemoFixtures(): Promise<void> {
  const clock = demoClockFromEnvironment();
  const directory = path.resolve(process.cwd(), DEMO_FIXTURE_DIRECTORY);
  await mkdir(directory, { recursive: true });
  const fixtures = createDemoCsvFixtures(clock);
  await Promise.all(
    fixtures.map((fixture) => writeFile(path.join(directory, fixture.fileName), fixture.content)),
  );
  await writeFile(
    path.join(directory, "README.txt"),
    [
      `Fixture rekonsiliasi Atria — anchor ${clock.anchorDate}`,
      "Pilih rekening yang disebutkan pada walkthrough sebelum mengimpor file.",
      ...fixtures.map((fixture) => `- ${fixture.fileName}: ${fixture.bankAccountName}`),
    ].join("\n"),
  );
  console.log(`Demo CSV fixtures written to ${directory}`);
}

export async function seedDemoDatabase(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed ditolak ketika NODE_ENV=production.");
  }
  const target = describeDatabaseTarget();
  const demoClock = demoClockFromEnvironment();
  const demoDate = demoClock.fromBaseline;
  console.log(`Starting connected demo seed on ${target} (anchor ${demoClock.anchorDate})...`);
  await assertDemoDatabaseIsEmpty();

  await db.transaction(async (tx) => {
    // 1. Seed Roles and Role Permissions
    console.log("Seeding roles and permissions...");
    await tx.insert(role).values([...SYSTEM_ROLES]);

    const rolePermissionRows = SYSTEM_ROLES.flatMap((systemRole) => {
      const perms = ROLE_PERMISSIONS[systemRole.name.toUpperCase()] ?? [];
      return perms.map((key) => ({
        roleId: systemRole.id,
        permissionKey: key,
      }));
    });

    if (rolePermissionRows.length > 0) {
      await tx.insert(rolePermission).values(rolePermissionRows);
    }
    const defaultPassword = "password123";
    const hashedDefaultPassword = await auth.$context.then((context) =>
      context.password.hash(defaultPassword),
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

    console.log("Seeding tenant members...");
    await tx.insert(tenantMember).values([
      {
        tenantId: DEKORIA_TENANT_ID,
        userId: "11111111-1111-1111-1111-111111111111",
        roleId: "00000000-0000-0000-0000-000000000001",
        isActive: true,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        userId: "22222222-2222-2222-2222-222222222222",
        roleId: "00000000-0000-0000-0000-000000000002",
        isActive: true,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        userId: "33333333-3333-3333-3333-333333333331",
        roleId: "00000000-0000-0000-0000-000000000003",
        isActive: true,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        userId: "33333333-3333-3333-3333-333333333332",
        roleId: "00000000-0000-0000-0000-000000000003",
        isActive: true,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        userId: "33333333-3333-3333-3333-333333333333",
        roleId: "00000000-0000-0000-0000-000000000004",
        isActive: true,
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

    // 3. Seed Clients (4 clients)
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
      {
        id: "44444444-4444-4444-4444-444444444444",
        name: "Budi Kencana",
        companyName: "Ciputra Group",
        email: "budi.kencana@ciputra.com",
        phone: "081388776655",
        address: "Ciputra World Tower 2 Lt. 15, Satrio, Jakarta Selatan",
      },
    ]);

    // 4. Seed Vendors (4 vendors)
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
        id: "55555555-5555-5555-5555-555555555552",
        name: "PT Sinar Kaca & Electrical",
        email: "project@sinarkaca.example",
        phone: "021-5556644",
        address: "Jl. Daan Mogot KM 12, Jakarta Barat",
        bankName: "BCA",
        bankAccountNumber: "0955524680",
        bankAccountHolder: "PT Sinar Kaca & Electrical",
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
        id: "55555555-5555-5555-5555-555555555554",
        name: "PT Hafele Hardware Indonesia",
        email: "orders@hafele.co.id",
        phone: "021-7591001",
        address: "Taman Tekno BSD Sector 7, Tangerang Selatan",
        bankName: "BCA",
        bankAccountNumber: "0955599887",
        bankAccountHolder: "PT Hafele Hardware Indonesia",
      },
    ]);

    // 5. Seed Material Categories, Master & Inventory Locations (3 locations, 10 materials)
    console.log("Seeding material master and locations...");
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
      {
        id: "12121212-1212-1212-1212-121212121204",
        name: "Hardware",
        description: "Engsel, drawer runner, handle, dan fitting cabinetry",
      },
      {
        id: "12121212-1212-1212-1212-121212121205",
        name: "Electrical & Lighting",
        description: "Kabel, LED strip, driver, dan aksesori listrik interior",
      },
      {
        id: "12121212-1212-1212-1212-121212121206",
        name: "Glass & Mirror",
        description: "Kaca, cermin, dan aksesori pemasangan",
      },
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
        defaultVendorId: "55555555-5555-5555-5555-555555555553",
        name: "Solid Surface White Countertop",
        specification: "Solid surface putih untuk top table kitchen",
        brand: "Dekoria Select",
        code: "SS-WHT-12",
        color: "White",
        unit: "meter",
      },
      {
        id: "13131313-1313-1313-1313-131313131304",
        categoryId: "12121212-1212-1212-1212-121212121201",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        name: "MDF 12mm Moisture Resistant",
        specification: "1220 x 2440 mm, MR grade",
        brand: "Dekoria Select",
        code: "MDF-12-MR",
        unit: "lembar",
      },
      {
        id: "13131313-1313-1313-1313-131313131305",
        categoryId: "12121212-1212-1212-1212-121212121204",
        defaultVendorId: "55555555-5555-5555-5555-555555555554",
        name: "Cabinet Hardware Set Soft-close",
        specification: "Engsel, runner, connector, dan handle per modul",
        brand: "Hafele Mix",
        code: "HW-SC-SET",
        unit: "set",
      },
      {
        id: "13131313-1313-1313-1313-131313131306",
        categoryId: "12121212-1212-1212-1212-121212121202",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        name: "PU Finishing System",
        specification: "Sealer, color coat, clear coat, dan consumable",
        brand: "Dekoria Workshop",
        code: "FIN-PU-SYS",
        unit: "paket",
      },
      {
        id: "13131313-1313-1313-1313-131313131307",
        categoryId: "12121212-1212-1212-1212-121212121205",
        defaultVendorId: "55555555-5555-5555-5555-555555555552",
        name: "LED Strip & Driver 24V",
        specification: "Warm white 3000K lengkap aluminium profile",
        brand: "Philips Mix",
        code: "LED-24V-3K",
        unit: "meter",
      },
      {
        id: "13131313-1313-1313-1313-131313131308",
        categoryId: "12121212-1212-1212-1212-121212121206",
        defaultVendorId: "55555555-5555-5555-5555-555555555552",
        name: "Mirror 5mm Bevel",
        specification: "Cermin 5mm polished/bevel edge",
        brand: "Asahimas",
        code: "MIR-5-BVL",
        unit: "m2",
      },
      {
        id: "13131313-1313-1313-1313-131313131309",
        categoryId: "12121212-1212-1212-1212-121212121202",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        name: "Wood Veneer White Oak 0.6mm",
        specification: "Veneer kayu alami motif White Oak",
        brand: "Natural Wood",
        code: "VNR-OAK-06",
        unit: "m2",
      },
      {
        id: "13131313-1313-1313-1313-131313131310",
        categoryId: "12121212-1212-1212-1212-121212121204",
        defaultVendorId: "55555555-5555-5555-5555-555555555554",
        name: "Engsel Sendok Heavy Duty Softclose",
        specification: "Engsel sendok 110 degree clip-on softclose",
        brand: "Hafele",
        code: "HFL-HNG-HD",
        unit: "pasang",
      },
    ]);

    await tx.insert(inventoryLocation).values([
      {
        id: "14141414-1414-1414-1414-141414141401",
        name: "Gudang Utama Dekoria",
        description: "Gudang utama material dan sisa proyek reusable",
      },
      {
        id: "14141414-1414-1414-1414-141414141402",
        name: "Workshop Cikupa",
        description: "Workshop fabrikasi kabinet & finishing Tangerang",
      },
      {
        id: "14141414-1414-1414-1414-141414141403",
        name: "Gudang Transit Menteng",
        description: "Gudang simpan material aktif site Menteng Villa",
      },
    ]);

    // Material Stock Inventory (Covering LOW_STOCK/SHORTAGE, NORMAL, OVERSTOCK)
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
        currentStock: "5.00", // LOW STOCK / SHORTAGE filter test!
        reservedStock: "4.00",
        minimumStock: "15.00",
        averageCost: "190000.00",
        lastPurchasePrice: "200000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151503",
        materialId: "13131313-1313-1313-1313-131313131303",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "15.00",
        reservedStock: "2.00",
        minimumStock: "5.00",
        averageCost: "1950000.00",
        lastPurchasePrice: "2000000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151504",
        materialId: "13131313-1313-1313-1313-131313131304",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "85.00", // OVERSTOCK filter test!
        reservedStock: "5.00",
        minimumStock: "15.00",
        averageCost: "180000.00",
        lastPurchasePrice: "185000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151505",
        materialId: "13131313-1313-1313-1313-131313131305",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "4.00", // LOW STOCK / SHORTAGE filter test!
        reservedStock: "0.00",
        minimumStock: "10.00",
        averageCost: "725000.00",
        lastPurchasePrice: "750000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151506",
        materialId: "13131313-1313-1313-1313-131313131306",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "30.00", // OVERSTOCK filter test!
        reservedStock: "0.00",
        minimumStock: "5.00",
        averageCost: "3800000.00",
        lastPurchasePrice: "4000000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151507",
        materialId: "13131313-1313-1313-1313-131313131307",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "35.00",
        reservedStock: "0.00",
        minimumStock: "20.00",
        averageCost: "210000.00",
        lastPurchasePrice: "225000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151508",
        materialId: "13131313-1313-1313-1313-131313131308",
        locationId: "14141414-1414-1414-1414-141414141401",
        currentStock: "12.00",
        reservedStock: "0.00",
        minimumStock: "4.00",
        averageCost: "475000.00",
        lastPurchasePrice: "500000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151509",
        materialId: "13131313-1313-1313-1313-131313131301",
        locationId: "14141414-1414-1414-1414-141414141403",
        currentStock: "10.00",
        reservedStock: "0.00",
        minimumStock: "0.00",
        averageCost: "245000.00",
        lastPurchasePrice: "250000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151510",
        materialId: "13131313-1313-1313-1313-131313131305",
        locationId: "14141414-1414-1414-1414-141414141402",
        currentStock: "5.00",
        reservedStock: "0.00",
        minimumStock: "0.00",
        averageCost: "725000.00",
        lastPurchasePrice: "750000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151511",
        materialId: "13131313-1313-1313-1313-131313131309",
        locationId: "14141414-1414-1414-1414-141414141402",
        currentStock: "0.00",
        reservedStock: "0.00",
        minimumStock: "0.00",
        averageCost: "0.00",
        lastPurchasePrice: "285000.00",
      },
      {
        id: "15151515-1515-1515-1515-151515151512",
        materialId: "13131313-1313-1313-1313-131313131310",
        locationId: "14141414-1414-1414-1414-141414141402",
        currentStock: "0.00",
        reservedStock: "0.00",
        minimumStock: "0.00",
        averageCost: "0.00",
        lastPurchasePrice: "125000.00",
      },
    ]);

    // 6. Seed Inventory Opening Batches (1 posted, 1 pending approval!)
    console.log("Seeding inventory opening batches...");
    await tx.insert(inventoryOpeningBatch).values([
      {
        id: "95959595-9595-9595-9595-959595959501",
        batchNumber: "OPB-2026-06-0001",
        cutoverDate: demoDate("2026-06-01T00:00:00Z"),
        status: "POSTED",
        note: "Saldo awal cutover Go-Live Atria ERP Dekoria.",
        requestedById: "11111111-1111-1111-1111-111111111111",
        approvedById: "22222222-2222-2222-2222-222222222222",
        approvedAt: demoDate("2026-06-01T08:00:00Z"),
        postedAt: demoDate("2026-06-01T08:00:00Z"),
      },
      {
        id: "95959595-9595-9595-9595-959595959502",
        batchNumber: "OPB-2026-07-0002",
        cutoverDate: demoDate("2026-07-01T00:00:00Z"),
        status: "PENDING_APPROVAL",
        note: "Penyesuaian saldo awal material Workshop Cikupa.",
        requestedById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-07-01T09:00:00Z"),
      },
    ]);

    const stockItems = [
      {
        invId: "15151515-1515-1515-1515-151515151501",
        matId: "13131313-1313-1313-1313-131313131301",
        qty: "40.00",
        cost: "245000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151502",
        matId: "13131313-1313-1313-1313-131313131302",
        qty: "6.00",
        cost: "190000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151503",
        matId: "13131313-1313-1313-1313-131313131303",
        qty: "15.00",
        cost: "1950000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151504",
        matId: "13131313-1313-1313-1313-131313131304",
        qty: "85.00",
        cost: "180000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151505",
        matId: "13131313-1313-1313-1313-131313131305",
        qty: "9.00",
        cost: "725000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151506",
        matId: "13131313-1313-1313-1313-131313131306",
        qty: "30.00",
        cost: "3800000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151507",
        matId: "13131313-1313-1313-1313-131313131307",
        qty: "5.00",
        cost: "210000.00",
      },
      {
        invId: "15151515-1515-1515-1515-151515151508",
        matId: "13131313-1313-1313-1313-131313131308",
        qty: "12.00",
        cost: "475000.00",
      },
    ];

    for (let i = 0; i < stockItems.length; i++) {
      const item = stockItems[i];
      const moveId = `85858585-8585-8585-8585-85858585850${i + 1}`;
      const itemId = `75757575-7575-7575-7575-75757575750${i + 1}`;

      await tx.insert(stockMovement).values({
        id: moveId,
        materialId: item.matId,
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        movementType: "OPENING_BALANCE",
        movementDirection: "IN",
        referenceType: "INVENTORY_OPENING",
        referenceId: "95959595-9595-9595-9595-959595959501",
        quantity: item.qty,
        unitCost: item.cost,
        createdById: "11111111-1111-1111-1111-111111111111",
        createdAt: demoDate("2026-06-01T08:00:00Z"),
      });

      await tx.insert(inventoryOpeningItem).values({
        id: itemId,
        batchId: "95959595-9595-9595-9595-959595959501",
        materialInventoryId: item.invId,
        quantity: item.qty,
        unitCost: item.cost,
        stockMovementId: moveId,
        createdAt: demoDate("2026-06-01T08:00:00Z"),
      });
    }

    await tx.insert(inventoryOpeningItem).values([
      {
        id: "75757575-7575-7575-7575-757575757509",
        batchId: "95959595-9595-9595-9595-959595959502",
        materialInventoryId: "15151515-1515-1515-1515-151515151511",
        quantity: "18.00",
        unitCost: "285000.00",
        createdAt: demoDate("2026-07-01T09:00:00Z"),
      },
      {
        id: "75757575-7575-7575-7575-757575757510",
        batchId: "95959595-9595-9595-9595-959595959502",
        materialInventoryId: "15151515-1515-1515-1515-151515151512",
        quantity: "40.00",
        unitCost: "125000.00",
        createdAt: demoDate("2026-07-01T09:00:00Z"),
      },
    ]);

    // 7. Seed Bank Accounts (4 accounts)
    console.log("Seeding bank accounts...");
    await tx.insert(bankAccount).values([
      {
        id: "66666666-6666-6666-6666-666666666661",
        name: "BCA Operasional",
        accountNumber: "8889991122",
        bankName: "BCA",
        holderName: "PT Dekoria Desain Estetika",
        balance: "655000000.00",
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
        balance: "14150000.00",
        cardColorFrom: "#0B4F43",
        cardColorTo: "#0D9488",
        cardTextColor: "light",
      },
      {
        id: "66666666-6666-6666-6666-666666666663",
        name: "Mandiri Giro Utama",
        accountNumber: "133000554433",
        bankName: "Mandiri",
        holderName: "PT Dekoria Desain Estetika",
        balance: "500000000.00",
        cardColorFrom: "#1E3A8A",
        cardColorTo: "#3B82F6",
        cardTextColor: "light",
      },
      {
        id: "66666666-6666-6666-6666-666666666664",
        name: "Kas Kecil PM Siti",
        accountNumber: "9990001113",
        bankName: "BCA Cashier",
        holderName: "Siti Aminah (Petty Cash)",
        balance: "9500000.00",
        cardColorFrom: "#312E81",
        cardColorTo: "#6366F1",
        cardTextColor: "light",
      },
    ]);

    // 8. Seed Cost Categories & Expense Categories
    console.log("Seeding project cost categories & expense categories...");
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
      })),
    );

    // 9. Seed Settings & Library Items
    console.log("Seeding Settings & Item Library...");
    await tx.insert(appConfig).values({
      key: OWNER_ONBOARDING_CONFIG_KEY,
      value: JSON.stringify({
        version: 1,
        status: "COMPLETED",
        currentStep: "summary",
        reviewedSteps: [
          "welcome",
          "financial_defaults",
          "team_vendors",
          "bank_accounts",
          "material_foundation",
          "item_library",
          "initial_stock",
          "summary",
        ],
        skippedSteps: [],
        completedAt: demoDate("2026-06-01T08:00:00Z").toISOString(),
        initialStockDecision: "HAS_LEGACY_STOCK",
      }),
      description: "Progress onboarding Owner untuk fondasi operasional Atria.",
      updatedById: "11111111-1111-1111-1111-111111111111",
    });

    await tx.insert(budgetAllocationSetting).values({
      id: "41414141-4141-4141-4141-414141414101",
      name: "Default Project Budget Allocation",
      status: "ACTIVE",
      budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
      notes: "Default allocation ratio for new Project Budgets.",
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
      })),
    );

    // Item Price Library entries
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
        sourceNote: "Harga panel referensi vendor Cahaya Mas.",
        effectiveFrom: demoDate("2026-06-01T00:00:00Z"),
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
        description: "Finishing HPL motif kayu terang.",
        unit: "lembar",
        defaultClientPrice: "285714.29",
        defaultInternalCost: "200000.00",
        defaultVendorId: "55555555-5555-5555-5555-555555555551",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.3000",
        priceSourceType: "COST_BREAKDOWN",
        sourceNote: "Purchase reference vendor utama.",
        effectiveFrom: demoDate("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
      {
        id: "43434343-4343-4343-4343-434343434103",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        code: "LIB-WORK-INSTALL",
        itemType: "WORK_PACKAGE",
        itemCategory: "Tukang",
        name: "Installation Crew Package",
        description: "Paket jasa pemasangan, fitting, dan adjustment.",
        unit: "ls",
        defaultClientPrice: "56250000.00",
        defaultInternalCost: "45000000.00",
        pricingMode: "MARGIN_BASED",
        targetGrossPercentage: "0.2000",
        priceSourceType: "COST_BREAKDOWN",
        sourceNote: "Paket 10 hari instalasi tim tukang.",
        effectiveFrom: demoDate("2026-06-01T00:00:00Z"),
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
        sourceNote: "Quotation CV Batu Prima Countertop.",
        effectiveFrom: demoDate("2026-06-01T00:00:00Z"),
        updatedById: "11111111-1111-1111-1111-111111111111",
      },
    ]);

    // 10. Seed Projects (Covering ALL status filters: ACTIVE, ON_HOLD/DRAFT, COMPLETED, CANCELLED/ARCHIVED)
    console.log("Seeding projects for all status filters...");
    await tx.insert(project).values([
      // Active execution, planning, and ready-to-close scenarios.
      {
        id: "77777777-7777-7777-7777-777777777771",
        name: "Menteng Villa - Kitchen & Living Room Fit-Out",
        clientId: "44444444-4444-4444-4444-444444444441",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "800000000.00",
        startDate: demoDate("2026-06-01"),
        endDate: demoDate("2026-09-01"),
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
        financialHealth: "WARNING", // Budget Warning filter test!
        totalContractValue: "1200000000.00",
        startDate: demoDate("2026-06-15"),
        endDate: demoDate("2026-10-15"),
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
        totalContractValue: "950000000.00",
        startDate: demoDate("2026-07-01"),
        endDate: demoDate("2026-10-30"),
        location: "Jl. Brawijaya III No. 5, Jakarta Selatan",
        roomArea: "Seluruh Rumah",
        projectType: "Renovasi",
        notes: "Sandbox RAB awal dengan sumber Material, Tukang, Subcon, item manual, dan bundle.",
      },
      // On-hold lifecycle reference.
      {
        id: "77777777-7777-7777-7777-777777777774",
        name: "Kemang Townhouse - Custom Cabinetry",
        clientId: "44444444-4444-4444-4444-444444444443",
        projectManagerId: "33333333-3333-3333-3333-333333333332",
        status: "ON_HOLD", // ON_HOLD filter test!
        financialHealth: "HEALTHY",
        totalContractValue: "0.00",
        startDate: demoDate("2026-08-01"),
        endDate: demoDate("2026-11-01"),
        location: "Jl. Kemang Selatan No. 8, Jakarta Selatan",
        roomArea: "Master Bedroom & Closet",
        projectType: "Fit-Out",
        notes: "Ditahan sementara menunggu persetujuan perizinan lingkungan.",
      },
      // Ready-to-close and completed-history references.
      {
        id: "77777777-7777-7777-7777-777777777776",
        name: "Senopati Office - Executive Suite Fit-Out",
        clientId: "44444444-4444-4444-4444-444444444444",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "500000000.00",
        startDate: demoDate("2026-03-01"),
        endDate: demoDate("2026-05-30"),
        location: "Senopati Office Building Lt. 5, Jakarta Selatan",
        roomArea: "Director Suite & Meeting Room",
        projectType: "Fit-Out",
        notes: "Skenario demo siap closing: invoice, budget, RAB, dan rekonsiliasi sudah final.",
      },
      {
        id: "77777777-7777-7777-7777-777777777777",
        name: "BSD Boutique Cafe - Interior Renovation",
        clientId: "44444444-4444-4444-4444-444444444441",
        projectManagerId: "33333333-3333-3333-3333-333333333332",
        status: "COMPLETED", // COMPLETED filter test!
        financialHealth: "HEALTHY",
        totalContractValue: "0.00",
        startDate: demoDate("2026-02-15"),
        endDate: demoDate("2026-05-15"),
        location: "Ruko Commercial Goldfinch BSD, Tangerang",
        roomArea: "Main Dining & Espresso Bar",
        projectType: "Renovasi",
        notes: "Selesai tepat waktu dengan kepuasan klien sangat baik.",
      },
      // Cancelled lifecycle reference.
      {
        id: "77777777-7777-7777-7777-777777777778",
        name: "PIK Shophouse - Retail Interior",
        clientId: "44444444-4444-4444-4444-444444444442",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "CANCELLED", // CANCELLED filter test!
        financialHealth: "HEALTHY",
        totalContractValue: "0.00",
        startDate: demoDate("2026-04-01"),
        endDate: demoDate("2026-06-01"),
        location: "PIK Avenue Shophouse Cluster B, Jakarta Utara",
        roomArea: "Retail Showroom",
        projectType: "Fit-Out",
        notes: "Dibatalkan klien karena perubahan sewa tempat.",
      },
      {
        id: DEMO_IDS.projects.pakubuwono,
        name: "Pakubuwono Apartment - Budget Review",
        clientId: "44444444-4444-4444-4444-444444444442",
        projectManagerId: DEMO_IDS.users.pmSiti,
        status: "DRAFT",
        financialHealth: "HEALTHY",
        totalContractValue: "650000000.00",
        startDate: demoDate("2026-08-05"),
        endDate: demoDate("2026-11-20"),
        location: "Pakubuwono Residence Tower Sandalwood, Jakarta Selatan",
        roomArea: "Living, Dining & Master Suite",
        projectType: "Renovasi",
        notes: "Project Budget sudah diajukan Finance dan menunggu keputusan Owner.",
      },
      {
        id: DEMO_IDS.projects.cipete,
        name: "Cipete House - RAP Review",
        clientId: "44444444-4444-4444-4444-444444444443",
        projectManagerId: DEMO_IDS.users.pmBudi,
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "420000000.00",
        startDate: demoDate("2026-07-15"),
        endDate: demoDate("2026-10-20"),
        location: "Jl. Cipete Dalam No. 21, Jakarta Selatan",
        roomArea: "Kitchen, Family Room & Master Wardrobe",
        projectType: "Fit-Out",
        notes: "RAP lengkap berada pada tahap review dan siap difinalisasi Owner atau Finance.",
      },
    ]);

    // 11. Seed Budgets
    console.log("Seeding project budgets...");
    await tx.insert(projectBudget).values([
      {
        id: "88888888-8888-8888-8888-888888888881",
        projectId: "77777777-7777-7777-7777-777777777771",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: demoDate("2026-05-28T09:00:00Z"),
        notes: "RAB disetujui Owner & Client untuk Menteng Villa",
      },
      {
        id: "88888888-8888-8888-8888-888888888882",
        projectId: "77777777-7777-7777-7777-777777777772",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: demoDate("2026-06-14T10:00:00Z"),
        notes: "RAB disetujui Owner & Client untuk Sudirman Suites",
      },
      {
        id: "88888888-8888-8888-8888-888888888886",
        projectId: "77777777-7777-7777-7777-777777777776",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: demoDate("2026-02-28T10:00:00Z"),
        notes: "RAB disetujui Senopati Office",
      },
    ]);

    console.log("Seeding RAP material plans...");
    await tx.insert(projectRap).values([
      {
        id: "16161616-1616-1616-1616-161616161601",
        projectId: "77777777-7777-7777-7777-777777777771",
        status: "LOCKED",
        revision: 1,
        setupStage: "COMPLETE",
        setupUpdatedById: DEMO_IDS.users.finance,
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: demoDate("2026-05-30T08:00:00Z"),
        notes: "Baseline RAP material untuk kitchen dan living room.",
      },
      {
        id: "16161616-1616-1616-1616-161616161602",
        projectId: "77777777-7777-7777-7777-777777777772",
        status: "LOCKED",
        revision: 1,
        setupStage: "COMPLETE",
        setupUpdatedById: DEMO_IDS.users.finance,
        lockedById: DEMO_IDS.users.owner,
        lockedAt: demoDate("2026-06-14T10:30:00Z"),
        notes: "Baseline internal penthouse yang mendukung RAB klien revisi pertama.",
      },
      {
        id: "16161616-1616-1616-1616-161616161603",
        projectId: DEMO_IDS.projects.brawijaya,
        status: "LOCKED",
        revision: 1,
        setupStage: "COMPLETE",
        setupUpdatedById: DEMO_IDS.users.finance,
        lockedById: DEMO_IDS.users.owner,
        lockedAt: demoDate("2026-07-18T09:00:00Z"),
        notes: "Baseline internal renovasi Brawijaya untuk penyusunan RAB awal.",
      },
      {
        id: "16161616-1616-1616-1616-161616161604",
        projectId: DEMO_IDS.projects.sudirman,
        supersedesProjectRapId: "16161616-1616-1616-1616-161616161602",
        status: "DRAFT",
        revision: 2,
        setupStage: "REVIEW",
        setupUpdatedById: DEMO_IDS.users.finance,
        notes: "Revisi internal untuk penambahan wardrobe, veneer, dan smart lighting penthouse.",
      },
      {
        id: "16161616-1616-1616-1616-161616161605",
        projectId: DEMO_IDS.projects.cipete,
        status: "DRAFT",
        revision: 1,
        setupStage: "REVIEW",
        setupUpdatedById: DEMO_IDS.users.finance,
        notes: "Material, Tukang, dan Subcon sudah lengkap; menunggu finalisasi internal plan.",
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
        internalNote: "Stok tersedia rendah, perlu purchase segera.",
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
      {
        id: "17171717-1717-1717-1717-171717171704",
        projectRapId: "16161616-1616-1616-1616-161616161602",
        materialId: "13131313-1313-1313-1313-131313131309",
        area: "Living & Dining",
        name: "Veneer White Oak wall panel",
        description: "Veneer natural untuk panel dinding utama penthouse.",
        requiredQuantity: "145.00",
        bufferQuantity: "15.00",
        totalQuantity: "160.00",
        unit: "m2",
        estimatedUnitCost: "325000.00",
        estimatedTotalCost: "52000000.00",
        suggestedClientUnitPrice: "425000.00",
        source: "PURCHASE",
        status: "WAITING_PURCHASE",
        internalNote: "Batch veneer harus satu lot untuk menjaga konsistensi warna.",
        createdAt: demoDate("2026-06-10T08:00:00Z"),
        updatedAt: demoDate("2026-06-10T08:00:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171705",
        projectRapId: "16161616-1616-1616-1616-161616161602",
        materialId: "13131313-1313-1313-1313-131313131308",
        area: "Master Suite",
        name: "Cermin bevel wardrobe",
        description: "Cermin bevel untuk pintu wardrobe dan vanity master suite.",
        requiredQuantity: "28.00",
        bufferQuantity: "2.00",
        totalQuantity: "30.00",
        unit: "m2",
        estimatedUnitCost: "850000.00",
        estimatedTotalCost: "25500000.00",
        suggestedClientUnitPrice: "1100000.00",
        source: "PURCHASE",
        status: "PLANNED",
        createdAt: demoDate("2026-06-10T08:10:00Z"),
        updatedAt: demoDate("2026-06-10T08:10:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171706",
        projectRapId: "16161616-1616-1616-1616-161616161602",
        materialId: "13131313-1313-1313-1313-131313131307",
        area: "Seluruh Unit",
        name: "LED strip dan driver 24V",
        description: "Pencahayaan indirect pada ceiling, joinery, dan wardrobe.",
        requiredQuantity: "210.00",
        bufferQuantity: "20.00",
        totalQuantity: "230.00",
        unit: "meter",
        estimatedUnitCost: "185000.00",
        estimatedTotalCost: "42550000.00",
        suggestedClientUnitPrice: "245000.00",
        source: "STOCK_AND_PURCHASE",
        status: "SHORTAGE",
        createdAt: demoDate("2026-06-10T08:20:00Z"),
        updatedAt: demoDate("2026-06-10T08:20:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171707",
        projectRapId: "16161616-1616-1616-1616-161616161603",
        materialId: "13131313-1313-1313-1313-131313131304",
        area: "Family Room",
        name: "MDF moisture resistant built-in",
        description: "Panel MR untuk TV cabinet dan storage family room.",
        requiredQuantity: "72.00",
        bufferQuantity: "8.00",
        totalQuantity: "80.00",
        unit: "lembar",
        estimatedUnitCost: "285000.00",
        estimatedTotalCost: "22800000.00",
        suggestedClientUnitPrice: "395000.00",
        source: "STOCK_AND_PURCHASE",
        status: "WAITING_PURCHASE",
        createdAt: demoDate("2026-07-15T08:00:00Z"),
        updatedAt: demoDate("2026-07-15T08:00:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171708",
        projectRapId: "16161616-1616-1616-1616-161616161603",
        materialId: "13131313-1313-1313-1313-131313131302",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434102",
        area: "Kitchen & Pantry",
        name: "HPL Taco Light Oak T-123",
        description: "Finishing kabinet kitchen, pantry, dan breakfast counter.",
        requiredQuantity: "58.00",
        bufferQuantity: "6.00",
        totalQuantity: "64.00",
        unit: "lembar",
        estimatedUnitCost: "200000.00",
        estimatedTotalCost: "12800000.00",
        suggestedClientUnitPrice: "285714.29",
        source: "PURCHASE",
        status: "SHORTAGE",
        createdAt: demoDate("2026-07-15T08:10:00Z"),
        updatedAt: demoDate("2026-07-15T08:10:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171709",
        projectRapId: "16161616-1616-1616-1616-161616161603",
        materialId: "13131313-1313-1313-1313-131313131305",
        area: "Seluruh Joinery",
        name: "Hardware set soft-close",
        description: "Engsel, runner, connector, dan handle untuk seluruh modul.",
        requiredQuantity: "42.00",
        bufferQuantity: "4.00",
        totalQuantity: "46.00",
        unit: "set",
        estimatedUnitCost: "1450000.00",
        estimatedTotalCost: "66700000.00",
        suggestedClientUnitPrice: "1825000.00",
        source: "STOCK_AND_PURCHASE",
        status: "READY",
        createdAt: demoDate("2026-07-15T08:20:00Z"),
        updatedAt: demoDate("2026-07-15T08:20:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171710",
        projectRapId: "16161616-1616-1616-1616-161616161603",
        materialId: "13131313-1313-1313-1313-131313131306",
        area: "Master Bedroom",
        name: "PU finishing system",
        description: "Finishing duco semi-matte untuk wardrobe dan vanity.",
        requiredQuantity: "9.00",
        bufferQuantity: "1.00",
        totalQuantity: "10.00",
        unit: "paket",
        estimatedUnitCost: "3200000.00",
        estimatedTotalCost: "32000000.00",
        suggestedClientUnitPrice: "4200000.00",
        source: "PURCHASE",
        status: "PLANNED",
        createdAt: demoDate("2026-07-15T08:30:00Z"),
        updatedAt: demoDate("2026-07-15T08:30:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171711",
        projectRapId: "16161616-1616-1616-1616-161616161604",
        materialId: "13131313-1313-1313-1313-131313131309",
        area: "Living, Dining & Corridor",
        name: "Veneer White Oak tambahan",
        description: "Revisi volume veneer untuk koridor dan panel foyer.",
        requiredQuantity: "185.00",
        bufferQuantity: "15.00",
        totalQuantity: "200.00",
        unit: "m2",
        estimatedUnitCost: "340000.00",
        estimatedTotalCost: "68000000.00",
        suggestedClientUnitPrice: "450000.00",
        source: "PURCHASE",
        status: "WAITING_PURCHASE",
        createdAt: demoDate("2026-07-18T08:00:00Z"),
        updatedAt: demoDate("2026-07-20T09:00:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171712",
        projectRapId: "16161616-1616-1616-1616-161616161604",
        materialId: "13131313-1313-1313-1313-131313131308",
        area: "Master Suite",
        name: "Cermin bevel wardrobe revisi",
        description: "Tambahan panel cermin untuk island wardrobe.",
        requiredQuantity: "34.00",
        bufferQuantity: "2.00",
        totalQuantity: "36.00",
        unit: "m2",
        estimatedUnitCost: "875000.00",
        estimatedTotalCost: "31500000.00",
        suggestedClientUnitPrice: "1150000.00",
        source: "PURCHASE",
        status: "PLANNED",
        createdAt: demoDate("2026-07-18T08:10:00Z"),
        updatedAt: demoDate("2026-07-18T08:10:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171713",
        projectRapId: "16161616-1616-1616-1616-161616161604",
        materialId: "13131313-1313-1313-1313-131313131307",
        area: "Seluruh Unit",
        name: "Smart LED strip dan driver DALI",
        description: "Upgrade driver dimmable untuk integrasi smart home.",
        requiredQuantity: "240.00",
        bufferQuantity: "24.00",
        totalQuantity: "264.00",
        unit: "meter",
        estimatedUnitCost: "225000.00",
        estimatedTotalCost: "59400000.00",
        suggestedClientUnitPrice: "295000.00",
        source: "PURCHASE",
        status: "SHORTAGE",
        createdAt: demoDate("2026-07-18T08:20:00Z"),
        updatedAt: demoDate("2026-07-18T08:20:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171714",
        projectRapId: "16161616-1616-1616-1616-161616161604",
        materialId: "13131313-1313-1313-1313-131313131305",
        area: "Master Wardrobe",
        name: "Hardware wardrobe island",
        description: "Runner heavy duty dan aksesori island wardrobe tambahan.",
        requiredQuantity: "12.00",
        bufferQuantity: "2.00",
        totalQuantity: "14.00",
        unit: "set",
        estimatedUnitCost: "1850000.00",
        estimatedTotalCost: "25900000.00",
        suggestedClientUnitPrice: "2350000.00",
        source: "PURCHASE",
        status: "PLANNED",
        createdAt: demoDate("2026-07-18T08:30:00Z"),
        updatedAt: demoDate("2026-07-18T08:30:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171715",
        projectRapId: "16161616-1616-1616-1616-161616161605",
        materialId: "13131313-1313-1313-1313-131313131301",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434101",
        area: "Kitchen",
        name: "Multipleks 18mm kabinet kitchen",
        description: "Carcass kabinet atas, bawah, dan tall unit kitchen.",
        requiredQuantity: "52.00",
        bufferQuantity: "6.00",
        totalQuantity: "58.00",
        unit: "lembar",
        estimatedUnitCost: "250000.00",
        estimatedTotalCost: "14500000.00",
        suggestedClientUnitPrice: "357142.86",
        source: "STOCK_AND_PURCHASE",
        status: "WAITING_PURCHASE",
        createdAt: demoDate("2026-07-16T08:00:00Z"),
        updatedAt: demoDate("2026-07-16T08:00:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171716",
        projectRapId: "16161616-1616-1616-1616-161616161605",
        materialId: "13131313-1313-1313-1313-131313131302",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434102",
        area: "Family Room",
        name: "HPL Taco Light Oak T-123",
        description: "Finishing TV cabinet dan display family room.",
        requiredQuantity: "30.00",
        bufferQuantity: "4.00",
        totalQuantity: "34.00",
        unit: "lembar",
        estimatedUnitCost: "200000.00",
        estimatedTotalCost: "6800000.00",
        suggestedClientUnitPrice: "285714.29",
        source: "PURCHASE",
        status: "SHORTAGE",
        createdAt: demoDate("2026-07-16T08:10:00Z"),
        updatedAt: demoDate("2026-07-16T08:10:00Z"),
      },
      {
        id: "17171717-1717-1717-1717-171717171717",
        projectRapId: "16161616-1616-1616-1616-161616161605",
        materialId: "13131313-1313-1313-1313-131313131305",
        area: "Kitchen & Wardrobe",
        name: "Hardware set soft-close",
        description: "Hardware kabinet kitchen dan wardrobe master.",
        requiredQuantity: "28.00",
        bufferQuantity: "3.00",
        totalQuantity: "31.00",
        unit: "set",
        estimatedUnitCost: "1450000.00",
        estimatedTotalCost: "44950000.00",
        suggestedClientUnitPrice: "1825000.00",
        source: "STOCK_AND_PURCHASE",
        status: "READY",
        createdAt: demoDate("2026-07-16T08:20:00Z"),
        updatedAt: demoDate("2026-07-16T08:20:00Z"),
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
        clientNotes: "Estimasi client-facing disetujui.",
        approvedValue: "800000000.00",
        approvedAt: demoDate("2026-05-28T09:30:00Z"),
      },
      {
        id: "19191919-1919-1919-1919-191919191902",
        projectId: "77777777-7777-7777-7777-777777777776",
        status: "APPROVED",
        revision: 1,
        title: "RAB Final Senopati Office",
        clientNotes: "Scope final telah diterima dan siap project closing.",
        approvedValue: "500000000.00",
        approvedAt: demoDate("2026-02-28T10:30:00Z"),
      },
      {
        id: "19191919-1919-1919-1919-191919191903",
        projectId: "77777777-7777-7777-7777-777777777772",
        status: "APPROVED",
        revision: 1,
        title: "RAB Penthouse Fit-Out Sudirman Suites",
        clientNotes: "Kontrak awal penthouse fit-out, disetujui klien.",
        approvedValue: "1200000000.00",
        approvedAt: demoDate("2026-06-14T11:00:00Z"),
      },
      {
        id: "19191919-1919-1919-1919-191919191904",
        projectId: DEMO_IDS.projects.menteng,
        sourceProjectRapId: "16161616-1616-1616-1616-161616161601",
        supersedesRabEstimateId: "19191919-1919-1919-1919-191919191901",
        status: "VOID",
        revision: 2,
        title: "RAB Revisi Area Bar Menteng",
        clientNotes: "Draft penambahan mini bar yang dibatalkan sebelum persetujuan.",
        approvedValue: "0.00",
        voidReason: "Klien mempertahankan layout awal dan membatalkan area mini bar.",
        voidedAt: demoDate("2026-07-10T16:00:00Z"),
        voidedById: DEMO_IDS.users.finance,
        createdAt: demoDate("2026-07-08T09:00:00Z"),
        updatedAt: demoDate("2026-07-10T16:00:00Z"),
      },
      {
        id: "19191919-1919-1919-1919-191919191905",
        projectId: DEMO_IDS.projects.sudirman,
        sourceProjectRapId: "16161616-1616-1616-1616-161616161604",
        supersedesRabEstimateId: "19191919-1919-1919-1919-191919191903",
        status: "DRAFT",
        revision: 2,
        title: "RAB Revisi Penthouse - Wardrobe & Smart Lighting",
        clientNotes:
          "Revisi sesuai konfirmasi klien: perluasan wardrobe island, veneer foyer, dan driver DALI.",
        approvedValue: "0.00",
        createdAt: demoDate("2026-07-18T10:00:00Z"),
        updatedAt: demoDate("2026-07-20T10:00:00Z"),
      },
      {
        id: "19191919-1919-1919-1919-191919191906",
        projectId: DEMO_IDS.projects.brawijaya,
        sourceProjectRapId: "16161616-1616-1616-1616-161616161603",
        status: "DRAFT",
        revision: 1,
        title: "RAB Renovasi Brawijaya Residence",
        clientNotes:
          "Draft awal untuk review label klien, pengelompokan paket, visibility, dan harga jual.",
        approvedValue: "0.00",
        createdAt: demoDate("2026-07-18T10:00:00Z"),
        updatedAt: demoDate("2026-07-19T09:00:00Z"),
      },
    ]);

    await tx.insert(rabEstimateBundle).values({
      id: "21212121-2121-2121-2121-212121212101",
      rabEstimateId: "19191919-1919-1919-1919-191919191906",
      clientLabel: "Paket built-in joinery",
      description:
        "Kitchen, pantry, TV cabinet, wardrobe, finishing, hardware, pengiriman, dan instalasi.",
      quantity: "1.00",
      unit: "paket",
      unitPrice: "610000000.00",
      lineTotal: "610000000.00",
      displayOrder: 1,
      createdAt: demoDate("2026-07-19T09:00:00Z"),
      updatedAt: demoDate("2026-07-19T09:00:00Z"),
    });

    await tx.insert(rabEstimateItem).values([
      {
        id: "20202020-2020-2020-2020-202020202001",
        rabEstimateId: "19191919-1919-1919-1919-191919191901",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171701",
        clientLabel: "Kitchen cabinetry package",
        description: "Supply, fabrikasi, finishing, dan instalasi kabinet kitchen.",
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
        description: "Panel TV wall dan finishing living room.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "180000000.00",
        lineTotal: "180000000.00",
        displayOrder: 2,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202003",
        rabEstimateId: "19191919-1919-1919-1919-191919191902",
        sourceType: "MANUAL",
        clientLabel: "Executive suite fit-out package",
        description: "Partisi, flooring, ceiling, dan pengecatan director suite & meeting room.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "350000000.00",
        lineTotal: "350000000.00",
        displayOrder: 1,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202004",
        rabEstimateId: "19191919-1919-1919-1919-191919191902",
        sourceType: "MANUAL",
        clientLabel: "Built-in furniture & finishing",
        description: "Fabrikasi dan instalasi furniture built-in beserta finishing akhir.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "150000000.00",
        lineTotal: "150000000.00",
        displayOrder: 2,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202005",
        rabEstimateId: "19191919-1919-1919-1919-191919191903",
        sourceType: "MANUAL",
        clientLabel: "Wall panel & veneer penthouse",
        description: "Instalasi backing, wall panel veneer, list bayangan, dan perapihan.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "57500000.00",
        lineTotal: "57500000.00",
        displayOrder: 1,
        isBundle: false,
      },
      {
        id: "20202020-2020-2020-2020-202020202007",
        rabEstimateId: "19191919-1919-1919-1919-191919191903",
        sourceType: "MANUAL",
        clientLabel: "Interior fit-out & finishing penthouse",
        description: "Flooring, ceiling, partisi, dan pengecatan seluruh unit penthouse.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "700000000.00",
        lineTotal: "700000000.00",
        displayOrder: 3,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202008",
        rabEstimateId: "19191919-1919-1919-1919-191919191903",
        sourceType: "MANUAL",
        clientLabel: "Kitchen & bathroom fixture package",
        description: "Supply dan instalasi fixture kitchen serta kamar mandi premium.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "250000000.00",
        lineTotal: "250000000.00",
        displayOrder: 4,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202009",
        rabEstimateId: "19191919-1919-1919-1919-191919191903",
        sourceType: "MANUAL",
        clientLabel: "MEP & smart home integration",
        description: "Instalasi elektrikal, AC, dan sistem smart home penthouse.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "116500000.00",
        lineTotal: "116500000.00",
        displayOrder: 5,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202010",
        rabEstimateId: "19191919-1919-1919-1919-191919191904",
        sourceType: "MANUAL",
        clientLabel: "Mini bar living area",
        description: "Kabinet mini bar, sink kecil, dan rak display yang kemudian dibatalkan.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "90000000.00",
        lineTotal: "90000000.00",
        displayOrder: 1,
      },
      {
        id: "20202020-2020-2020-2020-202020202011",
        rabEstimateId: "19191919-1919-1919-1919-191919191905",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171711",
        sourceRevision: 2,
        sourceUpdatedAt: demoDate("2026-07-20T09:00:00Z"),
        clientLabel: "Veneer foyer, living, dan corridor",
        description: "Supply veneer satu lot, backing panel, aplikasi, dan finishing clear coat.",
        quantity: "200.00",
        unit: "m2",
        unitPrice: "450000.00",
        lineTotal: "90000000.00",
        displayOrder: 1,
      },
      {
        id: "20202020-2020-2020-2020-202020202012",
        rabEstimateId: "19191919-1919-1919-1919-191919191905",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171712",
        sourceRevision: 2,
        sourceUpdatedAt: demoDate("2026-07-18T08:10:00Z"),
        clientLabel: "Cermin bevel wardrobe island",
        description: "Cermin bevel, backing, fitting, dan instalasi wardrobe master suite.",
        quantity: "36.00",
        unit: "m2",
        unitPrice: "1150000.00",
        lineTotal: "41400000.00",
        displayOrder: 2,
      },
      {
        id: "20202020-2020-2020-2020-202020202013",
        rabEstimateId: "19191919-1919-1919-1919-191919191905",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171713",
        sourceRevision: 2,
        sourceUpdatedAt: demoDate("2026-07-18T08:20:00Z"),
        clientLabel: "Smart lighting DALI integration",
        description: "LED strip, driver dimmable DALI, aluminium profile, dan commissioning.",
        quantity: "264.00",
        unit: "meter",
        unitPrice: "295000.00",
        lineTotal: "77880000.00",
        displayOrder: 3,
      },
      {
        id: "20202020-2020-2020-2020-202020202014",
        rabEstimateId: "19191919-1919-1919-1919-191919191905",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171714",
        sourceRevision: 2,
        sourceUpdatedAt: demoDate("2026-07-18T08:30:00Z"),
        clientLabel: "Hardware wardrobe island",
        description: "Runner heavy duty, engsel soft-close, dan aksesori wardrobe island.",
        quantity: "14.00",
        unit: "set",
        unitPrice: "2350000.00",
        lineTotal: "32900000.00",
        displayOrder: 4,
      },
      {
        id: "20202020-2020-2020-2020-202020202015",
        rabEstimateId: "19191919-1919-1919-1919-191919191905",
        sourceType: "MANUAL",
        clientLabel: "Baseline fit-out penthouse terintegrasi",
        description:
          "Seluruh scope kontrak awal termasuk ceiling, flooring, MEP, kitchen, bathroom, dan built-in utama.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "999820000.00",
        lineTotal: "999820000.00",
        displayOrder: 6,
      },
      {
        id: "20202020-2020-2020-2020-202020202016",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        bundleId: "21212121-2121-2121-2121-212121212101",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171707",
        sourceRevision: 1,
        sourceUpdatedAt: demoDate("2026-07-15T08:00:00Z"),
        clientLabel: "Panel MDF moisture resistant",
        description: "Material panel untuk TV cabinet dan storage family room.",
        quantity: "80.00",
        unit: "lembar",
        unitPrice: "395000.00",
        lineTotal: "31600000.00",
        displayOrder: 1,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202017",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        bundleId: "21212121-2121-2121-2121-212121212101",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171708",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434102",
        sourceRevision: 1,
        sourceUpdatedAt: demoDate("2026-07-15T08:10:00Z"),
        clientLabel: "Finishing HPL Light Oak",
        description: "Finishing kabinet kitchen, pantry, dan breakfast counter.",
        quantity: "64.00",
        unit: "lembar",
        unitPrice: "285714.29",
        lineTotal: "18285714.56",
        displayOrder: 2,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202018",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        bundleId: "21212121-2121-2121-2121-212121212101",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171709",
        sourceRevision: 1,
        sourceUpdatedAt: demoDate("2026-07-15T08:20:00Z"),
        clientLabel: "Hardware soft-close built-in",
        description: "Engsel, runner, connector, dan handle untuk seluruh built-in.",
        quantity: "46.00",
        unit: "set",
        unitPrice: "1825000.00",
        lineTotal: "83950000.00",
        displayOrder: 3,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202019",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        bundleId: "21212121-2121-2121-2121-212121212101",
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "17171717-1717-1717-1717-171717171710",
        sourceRevision: 1,
        sourceUpdatedAt: demoDate("2026-07-15T08:30:00Z"),
        clientLabel: "PU finishing wardrobe",
        description: "Sistem finishing duco semi-matte wardrobe dan vanity.",
        quantity: "10.00",
        unit: "paket",
        unitPrice: "4200000.00",
        lineTotal: "42000000.00",
        displayOrder: 4,
        isBundle: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202020",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        sourceType: "MANUAL",
        clientLabel: "MEP relocation dan lighting",
        description:
          "Relokasi titik listrik, plumbing minor, lighting, testing, dan commissioning.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "110000000.00",
        lineTotal: "110000000.00",
        displayOrder: 4,
      },
      {
        id: "20202020-2020-2020-2020-202020202021",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        sourceType: "MANUAL",
        clientLabel: "Provisional sum dekorasi",
        description: "Allowance dekorasi yang disembunyikan sambil menunggu pilihan final klien.",
        quantity: "1.00",
        unit: "allowance",
        unitPrice: "60000000.00",
        lineTotal: "60000000.00",
        displayOrder: 5,
        isHidden: true,
      },
      {
        id: "20202020-2020-2020-2020-202020202022",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        sourceType: "MANUAL",
        clientLabel: "Loose furniture terpilih",
        description: "Meja makan, kursi aksen, dan side table sesuai shortlist desain.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "60000000.00",
        lineTotal: "60000000.00",
        displayOrder: 6,
      },
    ]);

    await tx.insert(projectBudgetItem).values([
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
        actualSpent: "0.00",
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
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999993",
        name: "Transportasi & Mobilisasi Lapangan",
        budgetCategory: "Operasional Lapangan",
        quantity: "15.00",
        unit: "trip",
        unitPrice: "350000.00",
        allocatedAmount: "5250000.00",
        actualSpent: "0.00",
      },
    ]);

    // Project Budgets Setup
    const mentengContractValue = 800000000;
    const sudirmanContractValue = 1200000000;
    const brawijayaContractValue = 950000000;
    const senopatiContractValue = 500000000;
    const pakubuwonoContractValue = 650000000;
    const cipeteContractValue = 420000000;
    const mentengInternalBudget = calculateInternalBudget(mentengContractValue);
    const sudirmanInternalBudget = calculateInternalBudget(sudirmanContractValue);
    const brawijayaInternalBudget = calculateInternalBudget(brawijayaContractValue);
    const senopatiInternalBudget = calculateInternalBudget(senopatiContractValue);
    const pakubuwonoInternalBudget = calculateInternalBudget(pakubuwonoContractValue);
    const cipeteInternalBudget = calculateInternalBudget(cipeteContractValue);
    const mentengGross = calculateTargetGross(mentengContractValue, mentengInternalBudget);
    const sudirmanGross = calculateTargetGross(sudirmanContractValue, sudirmanInternalBudget);
    const brawijayaGross = calculateTargetGross(brawijayaContractValue, brawijayaInternalBudget);
    const senopatiGross = calculateTargetGross(senopatiContractValue, senopatiInternalBudget);
    const pakubuwonoGross = calculateTargetGross(pakubuwonoContractValue, pakubuwonoInternalBudget);
    const cipeteGross = calculateTargetGross(cipeteContractValue, cipeteInternalBudget);

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
        approvedAt: demoDate("2026-05-28T09:00:00Z"),
        notes: "Project Budget Control seed Menteng Villa.",
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
        approvedAt: demoDate("2026-06-14T10:00:00Z"),
        notes: "Project Budget Control seed Sudirman Suites.",
      },
      {
        id: "30303030-3030-3030-3030-303030303003",
        projectId: "77777777-7777-7777-7777-777777777773",
        status: "APPROVED",
        contractValue: brawijayaContractValue.toFixed(2),
        approvedRabValue: "0.00",
        internalBudget: brawijayaInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: brawijayaGross.amount.toFixed(2),
        targetGrossPercentage: brawijayaGross.percentage.toFixed(4),
        projectProgressPercentage: "0.0000",
        approvedById: DEMO_IDS.users.owner,
        approvedAt: demoDate("2026-07-14T09:00:00Z"),
        notes: "Budget disetujui untuk sandbox penyusunan RAB awal.",
      },
      {
        id: "30303030-3030-3030-3030-303030303004",
        projectId: "77777777-7777-7777-7777-777777777776",
        legacyProjectBudgetId: "88888888-8888-8888-8888-888888888886",
        status: "APPROVED",
        contractValue: senopatiContractValue.toFixed(2),
        approvedRabValue: senopatiContractValue.toFixed(2),
        internalBudget: senopatiInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: senopatiGross.amount.toFixed(2),
        targetGrossPercentage: senopatiGross.percentage.toFixed(4),
        projectProgressPercentage: "100.0000",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: demoDate("2026-02-28T10:00:00Z"),
        notes: "Skenario project siap closing.",
      },
      {
        id: "30303030-3030-3030-3030-303030303005",
        projectId: DEMO_IDS.projects.pakubuwono,
        status: "PENDING_APPROVAL",
        contractValue: pakubuwonoContractValue.toFixed(2),
        approvedRabValue: "0.00",
        internalBudget: pakubuwonoInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: pakubuwonoGross.amount.toFixed(2),
        targetGrossPercentage: pakubuwonoGross.percentage.toFixed(4),
        projectProgressPercentage: "0.0000",
        notes: "Draft alokasi sudah diperiksa Finance dan diajukan untuk keputusan Owner.",
        updatedAt: demoDate("2026-07-21T10:00:00Z"),
      },
      {
        id: "30303030-3030-3030-3030-303030303006",
        projectId: DEMO_IDS.projects.cipete,
        status: "APPROVED",
        contractValue: cipeteContractValue.toFixed(2),
        approvedRabValue: "0.00",
        internalBudget: cipeteInternalBudget.toFixed(2),
        budgetCapRatio: EXCEL_BUDGET_CAP_RATIO.toFixed(6),
        targetGrossAmount: cipeteGross.amount.toFixed(2),
        targetGrossPercentage: cipeteGross.percentage.toFixed(4),
        projectProgressPercentage: "5.0000",
        approvedById: DEMO_IDS.users.owner,
        approvedAt: demoDate("2026-07-14T10:00:00Z"),
        notes: "Budget disetujui; internal plan menunggu final review.",
      },
    ]);

    const budgetCategoryTemplates = [
      {
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        ratio: 0.18,
        sortOrder: 10,
      },
      {
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        ratio: 0.35,
        sortOrder: 20,
      },
      {
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        ratio: 0.01,
        sortOrder: 30,
      },
      {
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        ratio: 0.005,
        sortOrder: 40,
      },
      {
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        ratio: 0,
        sortOrder: 50,
      },
    ] as const;
    const budgetDefinitions = [
      {
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        internalBudget: mentengInternalBudget,
      },
      {
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        internalBudget: sudirmanInternalBudget,
      },
      {
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        internalBudget: brawijayaInternalBudget,
      },
      {
        projectBudgetId: "30303030-3030-3030-3030-303030303004",
        internalBudget: senopatiInternalBudget,
      },
      {
        projectBudgetId: "30303030-3030-3030-3030-303030303005",
        internalBudget: pakubuwonoInternalBudget,
      },
      {
        projectBudgetId: "30303030-3030-3030-3030-303030303006",
        internalBudget: cipeteInternalBudget,
      },
    ] as const;
    const seededBudgetCategories = budgetDefinitions.flatMap((budgetDefinition, budgetIndex) =>
      budgetCategoryTemplates.map((category, categoryIndex) => ({
        id: `32323232-3232-3232-3232-323232323${budgetIndex + 1}0${categoryIndex + 1}`,
        projectBudgetId: budgetDefinition.projectBudgetId,
        expenseCategoryId: category.expenseCategoryId,
        ratio: category.ratio,
        internalBudget: budgetDefinition.internalBudget,
        sortOrder: category.sortOrder,
      })),
    );

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
      }),
    );

    await tx.insert(projectCategoryPlanItem).values([
      {
        id: "35353535-3535-3535-3535-353535353501",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323101",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        name: "Tim instalasi kabinet kitchen",
        scopeDescription: "Fabrikasi akhir, instalasi kabinet, penyetelan pintu, dan punch list.",
        area: "Kitchen",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "28500000.00",
        estimatedTotalCost: "28500000.00",
        suggestedClientUnitPrice: "35000000.00",
        status: "ACTIVE",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: demoDate("2026-05-30T08:15:00Z"),
        internalNote: "Mandor Budi; termin berdasarkan progres instalasi terverifikasi.",
        displayOrder: 10,
      },
      {
        id: "35353535-3535-3535-3535-353535353502",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323105",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        vendorId: "55555555-5555-5555-5555-555555555553",
        name: "Paket countertop solid surface",
        scopeDescription: "Template, fabrikasi, sambungan, polishing, dan pemasangan countertop.",
        area: "Kitchen",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "41000000.00",
        estimatedTotalCost: "41000000.00",
        suggestedClientUnitPrice: "49500000.00",
        status: "ACTIVE",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: demoDate("2026-05-30T08:20:00Z"),
        internalNote: "Koordinasikan joint position dengan shop drawing kabinet.",
        displayOrder: 20,
      },
      {
        id: "35353535-3535-3535-3535-353535353503",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323201",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        name: "Tim instalasi wall panel penthouse",
        scopeDescription: "Instalasi backing, wall panel veneer, list bayangan, dan perapihan.",
        area: "Living & Dining",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "46500000.00",
        estimatedTotalCost: "46500000.00",
        suggestedClientUnitPrice: "57500000.00",
        status: "DRAFT",
        internalNote: "Menunggu final measurement setelah pekerjaan MEP selesai.",
        displayOrder: 10,
      },
      {
        id: "35353535-3535-3535-3535-353535353504",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323205",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        vendorId: "55555555-5555-5555-5555-555555555552",
        name: "Paket kaca dan cermin custom",
        scopeDescription: "Survey, fabrikasi, bevel, pengiriman, dan instalasi kaca dekoratif.",
        area: "Master Suite",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "62000000.00",
        estimatedTotalCost: "62000000.00",
        suggestedClientUnitPrice: "76000000.00",
        status: "ACTIVE",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: demoDate("2026-06-14T10:15:00Z"),
        internalNote: "Final ukuran wajib diverifikasi bersama PM sebelum produksi.",
        displayOrder: 20,
      },
      {
        id: "35353535-3535-3535-3535-353535353505",
        projectId: DEMO_IDS.projects.brawijaya,
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323301",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434103",
        name: "Tim instalasi built-in seluruh rumah",
        scopeDescription:
          "Instalasi kitchen, pantry, TV cabinet, wardrobe, alignment, dan punch list.",
        area: "Kitchen, Family Room & Master Bedroom",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "76000000.00",
        estimatedTotalCost: "76000000.00",
        suggestedClientUnitPrice: "95000000.00",
        status: "ACTIVE",
        internalNote: "Dua tim instalasi selama 18 hari dengan pemeriksaan kualitas harian.",
        displayOrder: 10,
        createdAt: demoDate("2026-07-16T09:00:00Z"),
        updatedAt: demoDate("2026-07-16T09:00:00Z"),
      },
      {
        id: "35353535-3535-3535-3535-353535353506",
        projectId: DEMO_IDS.projects.brawijaya,
        projectBudgetId: "30303030-3030-3030-3030-303030303003",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323305",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        vendorId: "55555555-5555-5555-5555-555555555553",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434104",
        name: "Paket countertop kitchen dan pantry",
        scopeDescription: "Template, fabrikasi solid surface, polishing, dan instalasi final.",
        area: "Kitchen & Pantry",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "60000000.00",
        estimatedTotalCost: "60000000.00",
        suggestedClientUnitPrice: "75000000.00",
        status: "ACTIVE",
        internalNote: "Joint position mengikuti shop drawing final dan posisi sink aktual.",
        displayOrder: 20,
        createdAt: demoDate("2026-07-16T09:10:00Z"),
        updatedAt: demoDate("2026-07-16T09:10:00Z"),
      },
      {
        id: "35353535-3535-3535-3535-353535353507",
        projectId: DEMO_IDS.projects.sudirman,
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323201",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        name: "Tim instalasi revisi wardrobe dan foyer",
        scopeDescription:
          "Instalasi wardrobe island, panel foyer, penyesuaian akses MEP, dan punch list.",
        area: "Foyer & Master Wardrobe",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "72000000.00",
        estimatedTotalCost: "72000000.00",
        suggestedClientUnitPrice: "90000000.00",
        status: "ACTIVE",
        internalNote: "Pekerjaan malam harus dikoordinasikan dengan building management.",
        displayOrder: 30,
        createdAt: demoDate("2026-07-18T09:00:00Z"),
        updatedAt: demoDate("2026-07-18T09:00:00Z"),
      },
      {
        id: "35353535-3535-3535-3535-353535353508",
        projectId: DEMO_IDS.projects.sudirman,
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323205",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        vendorId: "55555555-5555-5555-5555-555555555552",
        supersedesProjectCategoryPlanItemId: "35353535-3535-3535-3535-353535353504",
        revision: 2,
        name: "Paket kaca wardrobe island revisi",
        scopeDescription: "Survey ulang, tambahan cermin bevel, fabrikasi, dan instalasi malam.",
        area: "Master Suite",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "74400000.00",
        estimatedTotalCost: "74400000.00",
        suggestedClientUnitPrice: "93000000.00",
        status: "ACTIVE",
        internalNote: "Revisi dari paket R1 setelah island wardrobe disetujui klien.",
        displayOrder: 40,
        createdAt: demoDate("2026-07-18T09:10:00Z"),
        updatedAt: demoDate("2026-07-18T09:10:00Z"),
      },
      {
        id: "35353535-3535-3535-3535-353535353509",
        projectId: DEMO_IDS.projects.cipete,
        projectBudgetId: "30303030-3030-3030-3030-303030303006",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323601",
        expenseCategoryId: "31313131-3131-3131-3131-313131313101",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434103",
        name: "Tim instalasi kitchen dan wardrobe",
        scopeDescription: "Instalasi kabinet kitchen, TV cabinet, wardrobe, dan final adjustment.",
        area: "Kitchen, Family Room & Master Bedroom",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "45000000.00",
        estimatedTotalCost: "45000000.00",
        suggestedClientUnitPrice: "56250000.00",
        status: "ACTIVE",
        internalNote: "Rencana kerja 12 hari dengan satu mandor dan enam installer.",
        displayOrder: 10,
        createdAt: demoDate("2026-07-17T09:00:00Z"),
        updatedAt: demoDate("2026-07-17T09:00:00Z"),
      },
      {
        id: "35353535-3535-3535-3535-353535353510",
        projectId: DEMO_IDS.projects.cipete,
        projectBudgetId: "30303030-3030-3030-3030-303030303006",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323605",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        vendorId: "55555555-5555-5555-5555-555555555553",
        sourceLibraryItemId: "43434343-4343-4343-4343-434343434104",
        name: "Paket countertop solid surface Cipete",
        scopeDescription: "Template, fabrikasi, sink cut-out, polishing, dan instalasi countertop.",
        area: "Kitchen",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "41000000.00",
        estimatedTotalCost: "41000000.00",
        suggestedClientUnitPrice: "51250000.00",
        status: "ACTIVE",
        internalNote: "Survey final dilakukan setelah carcass kabinet terpasang dan level.",
        displayOrder: 20,
        createdAt: demoDate("2026-07-17T09:10:00Z"),
        updatedAt: demoDate("2026-07-17T09:10:00Z"),
      },
    ]);

    await tx.insert(rabEstimateItem).values([
      {
        id: "20202020-2020-2020-2020-202020202006",
        rabEstimateId: "19191919-1919-1919-1919-191919191903",
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: "35353535-3535-3535-3535-353535353504",
        clientLabel: "Kaca & cermin custom master suite",
        description: "Survey, fabrikasi, bevel, pengiriman, dan instalasi kaca dekoratif.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "76000000.00",
        lineTotal: "76000000.00",
        displayOrder: 2,
        isBundle: false,
      },
      {
        id: "20202020-2020-2020-2020-202020202023",
        rabEstimateId: "19191919-1919-1919-1919-191919191905",
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: "35353535-3535-3535-3535-353535353508",
        sourceRevision: 2,
        sourceUpdatedAt: demoDate("2026-07-18T09:10:00Z"),
        clientLabel: "Kaca wardrobe island revisi",
        description: "Survey ulang, cermin bevel tambahan, fabrikasi, pengiriman, dan instalasi.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "93000000.00",
        lineTotal: "93000000.00",
        displayOrder: 5,
      },
      {
        id: "20202020-2020-2020-2020-202020202024",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: "35353535-3535-3535-3535-353535353505",
        sourceRevision: 1,
        sourceUpdatedAt: demoDate("2026-07-16T09:00:00Z"),
        clientLabel: "Instalasi built-in seluruh rumah",
        description: "Instalasi, alignment, adjustment, perlindungan area, dan punch list.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "95000000.00",
        lineTotal: "95000000.00",
        displayOrder: 2,
      },
      {
        id: "20202020-2020-2020-2020-202020202025",
        rabEstimateId: "19191919-1919-1919-1919-191919191906",
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: "35353535-3535-3535-3535-353535353506",
        sourceRevision: 1,
        sourceUpdatedAt: demoDate("2026-07-16T09:10:00Z"),
        clientLabel: "Countertop kitchen dan pantry",
        description: "Template, fabrikasi solid surface, polishing, delivery, dan instalasi.",
        quantity: "1.00",
        unit: "paket",
        unitPrice: "75000000.00",
        lineTotal: "75000000.00",
        displayOrder: 3,
      },
    ]);

    await tx.insert(projectChangeOrder).values([
      {
        id: "23232323-2323-2323-2323-232323232301",
        projectId: DEMO_IDS.projects.sudirman,
        baseRabEstimateId: "19191919-1919-1919-1919-191919191903",
        revisedRabEstimateId: "19191919-1919-1919-1919-191919191905",
        status: "PENDING_APPROVAL",
        reason:
          "Klien menambah wardrobe island, memperluas veneer foyer, dan meminta smart lighting DALI.",
        scopeSummary:
          "Revisi volume veneer dan cermin, hardware wardrobe island, driver DALI, serta instalasi terkait.",
        previousContractValue: "1200000000.00",
        valueDelta: "135000000.00",
        revisedContractValue: "1335000000.00",
        clientConfirmedAt: demoDate("2026-07-20T14:00:00Z"),
        clientConfirmationReference: "WA-CLIENT-SUD-CO-02 / 20-07-2026",
        createdById: DEMO_IDS.users.finance,
        createdAt: demoDate("2026-07-20T15:00:00Z"),
        updatedAt: demoDate("2026-07-20T15:00:00Z"),
      },
      {
        id: "23232323-2323-2323-2323-232323232302",
        projectId: DEMO_IDS.projects.menteng,
        baseRabEstimateId: "19191919-1919-1919-1919-191919191901",
        revisedRabEstimateId: "19191919-1919-1919-1919-191919191904",
        status: "CANCELLED",
        reason: "Usulan penambahan mini bar pada living area.",
        scopeSummary: "Kabinet mini bar, sink kecil, plumbing point, dan rak display.",
        previousContractValue: "800000000.00",
        valueDelta: "90000000.00",
        revisedContractValue: "890000000.00",
        createdById: DEMO_IDS.users.finance,
        createdAt: demoDate("2026-07-08T10:00:00Z"),
        updatedAt: demoDate("2026-07-10T16:00:00Z"),
      },
    ]);

    // 12. Seed Client Invoices & Client Payments (Covering PAID, UNPAID, and OVERDUE)
    console.log("Seeding client invoices & payments...");
    await tx.insert(clientInvoice).values([
      // Menteng Invoices (PAID, UNPAID, OVERDUE)
      {
        id: "01010101-0101-0101-0101-010101010101",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/001",
        amount: "240000000.00",
        status: "PAID",
        stage: "DP",
        dueDate: demoDate("2026-06-05T23:59:59Z"),
        notes: "Invoice DP 30% Klien Adrian Hartanto - Menteng Villa",
      },
      {
        id: "01010101-0101-0101-0101-010101010102",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/002",
        amount: "320000000.00",
        status: "PARTIALLY_PAID",
        stage: "PROGRESS_1",
        dueDate: demoDate("2026-07-25T23:59:59Z"),
        notes: "Termin 2 - sudah diterima Rp120.000.000, sisa Rp200.000.000 untuk demo pelunasan.",
      },
      {
        id: "01010101-0101-0101-0101-010101010105",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/005",
        amount: "240000000.00",
        status: "UNPAID", // OVERDUE due date test!
        stage: "PROGRESS_2",
        dueDate: demoDate("2026-06-30T23:59:59Z"),
        notes: "Termin 3 - Overdue payment test.",
      },
      // Sudirman Invoices
      {
        id: "01010101-0101-0101-0101-010101010103",
        projectId: "77777777-7777-7777-7777-777777777772",
        invoiceNumber: "INV/2026/003",
        amount: "360000000.00",
        status: "PAID",
        stage: "DP",
        dueDate: demoDate("2026-06-20T23:59:59Z"),
        notes: "Invoice DP 30% Klien Haryanto Wijaya - Sudirman Suites",
      },
      {
        id: "01010101-0101-0101-0101-010101010104",
        projectId: "77777777-7777-7777-7777-777777777772",
        invoiceNumber: "INV/2026/004",
        amount: "480000000.00",
        status: "UNPAID",
        stage: "PROGRESS_1",
        dueDate: demoDate("2026-07-30T23:59:59Z"),
        notes: "Termin 2 Progress Pekerjaan Penthouse",
      },
      // Senopati Completed Invoices
      {
        id: "01010101-0101-0101-0101-010101010106",
        projectId: "77777777-7777-7777-7777-777777777776",
        invoiceNumber: "INV/2026/006",
        amount: "500000000.00",
        status: "PAID",
        stage: "PELUNASAN",
        dueDate: demoDate("2026-05-15T23:59:59Z"),
        notes: "Pelunasan 100% Senopati Office Suite",
      },
    ]);

    // 13. Seed Cash Transactions & Client Payments
    console.log("Seeding cash transactions & client payments...");
    await tx.insert(cashTransaction).values([
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "INFLOW",
        category: "client_payment",
        amount: "240000000.00",
        description: "Pembayaran Termin DP 30% - Adrian Hartanto (Menteng Villa)",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-02T10:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020201",
        bankReference: "TRF-BCA-1029",
        createdAt: demoDate("2026-06-02T09:15:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc02",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "OUTFLOW",
        category: "bank_transfer_out",
        amount: "15000000.00",
        description: "Transfer Pendanaan Awal Petty Cash Proyek - PM Budi",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-03T11:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "bank_transfer",
        referenceId: DEMO_IDS.internalTransfer,
        bankReference: "INT-TRF-0603",
        createdAt: demoDate("2026-06-03T11:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "INFLOW",
        category: "client_payment",
        amount: "360000000.00",
        description: "Pembayaran Termin DP 30% - Haryanto Wijaya (Sudirman Suites)",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-16T14:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020202",
        bankReference: "TRF-BCA-5523",
        createdAt: demoDate("2026-06-16T13:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc04",
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        type: "INFLOW",
        category: "client_payment",
        amount: "500000000.00",
        description: "Pelunasan Proyek Senopati Office Suite",
        reconciled: true,
        reconciliationDate: demoDate("2026-05-15T15:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020203",
        bankReference: "TRF-MND-9901",
        createdAt: demoDate("2026-05-15T14:30:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc05",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        type: "INFLOW",
        category: "bank_transfer_in",
        amount: "15000000.00",
        description: "Penerimaan pendanaan awal petty cash Proyek Menteng - PM Budi",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-03T11:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "bank_transfer",
        referenceId: DEMO_IDS.internalTransfer,
        bankReference: "INT-TRF-0603",
        createdAt: demoDate("2026-06-03T11:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc06",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "OUTFLOW",
        category: "vendor_payment",
        amount: "15000000.00",
        description: "Pembayaran BILL-2026-088 kepada PT Sinar Kaca & Electrical",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-25T10:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "vendor_payment",
        referenceId: "34043404-3404-3404-3404-340434043403",
        bankReference: "TRF-VND-8811",
        createdAt: demoDate("2026-06-25T10:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc07",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "OUTFLOW",
        category: "vendor_payment",
        amount: "35000000.00",
        description: "Pembayaran BILL-2026-089 kepada PT Cahaya Mas Panel",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-28T11:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "vendor_payment",
        referenceId: "34043404-3404-3404-3404-340434043404",
        bankReference: "TRF-VND-8812",
        createdAt: demoDate("2026-06-28T11:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc08",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        type: "OUTFLOW",
        category: "field_claim",
        amount: "850000.00",
        description: "Pencairan klaim consumable site Menteng",
        reconciled: false,
        referenceType: "project_cost",
        referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f005",
        bankReference: "TRF-FLD-0606",
        createdAt: demoDate("2026-06-06T14:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc09",
        bankAccountId: "66666666-6666-6666-6666-666666666664",
        type: "INFLOW",
        category: "opening_balance",
        amount: "12000000.00",
        description: "Saldo awal petty cash PM Siti",
        reconciled: true,
        reconciliationDate: demoDate("2026-06-01T08:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        bankReference: "OPENING-SITI-20260601",
        createdAt: demoDate("2026-06-01T08:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc10",
        bankAccountId: "66666666-6666-6666-6666-666666666664",
        type: "OUTFLOW",
        category: "field_claim",
        amount: "2500000.00",
        description: "Pencairan klaim aksesoris Workshop Cikupa",
        reconciled: false,
        referenceType: "project_cost",
        referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f006",
        bankReference: "TRF-FLD-0609",
        createdAt: demoDate("2026-06-09T10:00:00Z"),
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc11",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "INFLOW",
        category: "client_payment",
        amount: "120000000.00",
        description: "Pembayaran parsial Termin 2 Menteng Villa",
        reconciled: true,
        reconciliationDate: demoDate("2026-07-10T09:05:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020204",
        bankReference: "TRF-BCA-TERM2-120",
        createdAt: demoDate("2026-07-10T09:00:00Z"),
      },
    ]);

    // Reconciliation coverage: matched history plus two exact, unambiguous pending pairs.
    // Statement rows never change the account balance and no seeded row is intentionally orphaned.
    console.log("Seeding bank statement reconciliation coverage...");
    await tx.insert(bankStatementImport).values([
      {
        id: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        fileName: `Riwayat-BCA-Operasional-${demoClock.anchorDate}.csv`,
        fileUrl: "demo://bank-statements/bca-operasional-history.csv",
        importedById: "22222222-2222-2222-2222-222222222222",
        startDate: demoDate("2026-06-01T00:00:00Z"),
        endDate: demoDate("2026-06-30T23:59:59Z"),
        createdAt: demoDate("2026-07-01T08:00:00Z"),
      },
      {
        id: "babababa-baba-baba-baba-bababababa02",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        fileName: `Riwayat-Kas-PM-Budi-${demoClock.anchorDate}.csv`,
        fileUrl: "demo://bank-statements/kas-pm-budi-history.csv",
        importedById: "22222222-2222-2222-2222-222222222222",
        startDate: demoDate("2026-06-01T00:00:00Z"),
        endDate: demoDate("2026-06-30T23:59:59Z"),
        createdAt: demoDate("2026-07-01T08:05:00Z"),
      },
      {
        id: "babababa-baba-baba-baba-bababababa03",
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        fileName: `Riwayat-Mandiri-Giro-${demoClock.anchorDate}.csv`,
        fileUrl: "demo://bank-statements/mandiri-history.csv",
        importedById: "22222222-2222-2222-2222-222222222222",
        startDate: demoDate("2026-05-01T00:00:00Z"),
        endDate: demoDate("2026-05-31T23:59:59Z"),
        createdAt: demoDate("2026-06-01T08:00:00Z"),
      },
      {
        id: "babababa-baba-baba-baba-bababababa04",
        bankAccountId: "66666666-6666-6666-6666-666666666664",
        fileName: `Riwayat-Kas-PM-Siti-${demoClock.anchorDate}.csv`,
        fileUrl: "demo://bank-statements/kas-pm-siti-history.csv",
        importedById: "22222222-2222-2222-2222-222222222222",
        startDate: demoDate("2026-06-01T00:00:00Z"),
        endDate: demoDate("2026-06-30T23:59:59Z"),
        createdAt: demoDate("2026-07-01T08:10:00Z"),
      },
    ]);

    const seededStatementRows = [
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01",
        importId: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        transactionDate: demoDate("2026-06-02T09:16:00Z"),
        description: "TRANSFER MASUK TRF-BCA-1029 ADRIAN HARTANTO",
        amount: "240000000.00",
        type: "INFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc01",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02",
        importId: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        transactionDate: demoDate("2026-06-03T11:00:00Z"),
        description: "TRANSFER KELUAR INT-TRF-0603 PETTY CASH BUDI",
        amount: "15000000.00",
        type: "OUTFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc02",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03",
        importId: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        transactionDate: demoDate("2026-06-16T13:02:00Z"),
        description: "TRANSFER MASUK TRF-BCA-5523 HARYANTO WIJAYA",
        amount: "360000000.00",
        type: "INFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc03",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04",
        importId: "babababa-baba-baba-baba-bababababa03",
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        transactionDate: demoDate("2026-05-15T14:31:00Z"),
        description: "TRANSFER MASUK TRF-MND-9901 SENOPATI OFFICE",
        amount: "500000000.00",
        type: "INFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc04",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05",
        importId: "babababa-baba-baba-baba-bababababa02",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        transactionDate: demoDate("2026-06-03T11:00:00Z"),
        description: "DANA MASUK INT-TRF-0603 DARI BCA OPERASIONAL",
        amount: "15000000.00",
        type: "INFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc05",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06",
        importId: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        transactionDate: demoDate("2026-06-25T10:01:00Z"),
        description: "TRANSFER TRF-VND-8811 PT SINAR KACA ELECTRICAL",
        amount: "15000000.00",
        type: "OUTFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc06",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07",
        importId: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        transactionDate: demoDate("2026-06-28T11:01:00Z"),
        description: "TRANSFER TRF-VND-8812 PT CAHAYA MAS PANEL",
        amount: "35000000.00",
        type: "OUTFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc07",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee08",
        importId: "babababa-baba-baba-baba-bababababa04",
        bankAccountId: "66666666-6666-6666-6666-666666666664",
        transactionDate: demoDate("2026-06-01T08:00:00Z"),
        description: "SALDO AWAL KAS PM SITI",
        amount: "12000000.00",
        type: "INFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc09",
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09",
        importId: "babababa-baba-baba-baba-bababababa02",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        transactionDate: demoDate("2026-06-06T14:02:00Z"),
        description: "PENCAIRAN KLAIM SITE TRF-FLD-0606",
        amount: "850000.00",
        type: "OUTFLOW",
        isReconciled: false,
        matchedCashTransactionId: null,
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10",
        importId: "babababa-baba-baba-baba-bababababa04",
        bankAccountId: "66666666-6666-6666-6666-666666666664",
        transactionDate: demoDate("2026-06-09T10:02:00Z"),
        description: "PENCAIRAN KLAIM WORKSHOP TRF-FLD-0609",
        amount: "2500000.00",
        type: "OUTFLOW",
        isReconciled: false,
        matchedCashTransactionId: null,
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11",
        importId: "babababa-baba-baba-baba-bababababa01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        transactionDate: demoDate("2026-07-10T09:02:00Z"),
        description: "TRANSFER MASUK TERMIN 2 MENTENG TRF-BCA-TERM2-120",
        amount: "120000000.00",
        type: "INFLOW",
        isReconciled: true,
        matchedCashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc11",
      },
    ] as const;

    await tx.insert(bankStatementRow).values(
      seededStatementRows.map(({ bankAccountId, ...row }) => ({
        ...row,
        fingerprint: bankStatementFingerprint({
          bankAccountId,
          transactionDate: row.transactionDate,
          type: row.type,
          amount: row.amount,
          description: row.description,
        }),
        createdAt: row.transactionDate,
      })),
    );

    const seededReconciliationPairs = seededStatementRows.flatMap((row) => {
      if (!row.isReconciled || !row.matchedCashTransactionId) return [];
      return [
        {
          statementRowId: row.id,
          cashTransactionId: row.matchedCashTransactionId,
        },
      ];
    });
    await tx.insert(auditLog).values(
      seededReconciliationPairs.map((row, index) => ({
        id: `98989898-9898-9898-9898-${String(989898989801 + index)}`,
        userId: "22222222-2222-2222-2222-222222222222",
        action: "RECONCILE_CASH_TRANSACTION",
        targetTable: "cash_transaction",
        targetId: row.cashTransactionId,
        originalState: JSON.stringify({ reconciled: false, bankStatementRowId: null }),
        newState: JSON.stringify({ reconciled: true, bankStatementRowId: row.statementRowId }),
        ipAddress: "127.0.0.1",
        userAgent: "Atria ERP database seed",
      })),
    );

    await tx.insert(clientPayment).values([
      {
        id: "02020202-0202-0202-0202-020202020201",
        clientInvoiceId: "01010101-0101-0101-0101-010101010101",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc01",
        amountPaid: "240000000.00",
        paymentDate: demoDate("2026-06-02T09:15:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-BCA-1029",
      },
      {
        id: "02020202-0202-0202-0202-020202020202",
        clientInvoiceId: "01010101-0101-0101-0101-010101010103",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        amountPaid: "360000000.00",
        paymentDate: demoDate("2026-06-16T13:00:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-BCA-5523",
      },
      {
        id: "02020202-0202-0202-0202-020202020203",
        clientInvoiceId: "01010101-0101-0101-0101-010101010106",
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc04",
        amountPaid: "500000000.00",
        paymentDate: demoDate("2026-05-15T14:30:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-MND-9901",
      },
      {
        id: "02020202-0202-0202-0202-020202020204",
        clientInvoiceId: "01010101-0101-0101-0101-010101010102",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc11",
        amountPaid: "120000000.00",
        paymentDate: demoDate("2026-07-10T09:00:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-BCA-TERM2-120",
      },
    ]);

    // 14. Seed Vendor Bills & Vendor Payments (Sub-tabs BILLS & PAYMENTS coverage)
    console.log("Seeding vendor bills & vendor payments...");
    await tx.insert(vendorBill).values([
      // ACTIVE / UNPAID Bills (2 items)
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
        status: "UNPAID",
        dueDate: demoDate("2026-07-30T23:59:59Z"),
        notes: "Invoice pembelian material kayu panel Multipleks - PT Cahaya Mas",
      },
      {
        id: "33033303-3303-3303-3303-330333033302",
        vendorId: "55555555-5555-5555-5555-555555555553",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        materialId: "13131313-1313-1313-1313-131313131303",
        billNumber: "BILL-2026-092",
        amount: "41000000.00",
        status: "UNPAID",
        dueDate: demoDate("2026-07-28T23:59:59Z"),
        notes: "Tagihan fabrikasi solid surface countertop kitchen - CV Batu Prima",
      },
      // PAID Bills (2 items)
      {
        id: "33033303-3303-3303-3303-330333033303",
        vendorId: "55555555-5555-5555-5555-555555555552",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        materialId: "13131313-1313-1313-1313-131313131307",
        billNumber: "BILL-2026-088",
        amount: "15000000.00",
        status: "PAID",
        dueDate: demoDate("2026-06-25T23:59:59Z"),
        notes: "Tagihan LED strip & lighting profile - PT Sinar Kaca",
      },
      {
        id: "33033303-3303-3303-3303-330333033304",
        vendorId: "55555555-5555-5555-5555-555555555551",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323202",
        materialId: "13131313-1313-1313-1313-131313131301",
        billNumber: "BILL-2026-089",
        amount: "35000000.00",
        status: "PAID",
        dueDate: demoDate("2026-06-28T23:59:59Z"),
        notes: "Pembelian material HPL & kayu Sudirman Suites",
      },
    ]);

    // Vendor Payments (Active/Scheduled & Completed)
    await tx.insert(vendorPayment).values([
      // ACTIVE / SCHEDULED Payments (2 items)
      {
        id: "34043404-3404-3404-3404-340434043401",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: null,
        amountPaid: "4000000.00",
        status: "PENDING", // ACTIVE filter test!
        paymentDate: demoDate("2026-07-28T03:00:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: null,
        createdAt: demoDate("2026-07-18T03:00:00Z"),
      },
      {
        id: "34043404-3404-3404-3404-340434043402",
        vendorBillId: "33033303-3303-3303-3303-330333033302",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: null,
        amountPaid: "10000000.00",
        status: "PENDING", // ACTIVE filter test!
        paymentDate: demoDate("2026-07-29T03:00:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: null,
        createdAt: demoDate("2026-07-19T03:00:00Z"),
      },
      // COMPLETED / DISBURSED Payments (2 items)
      {
        id: "34043404-3404-3404-3404-340434043403",
        vendorBillId: "33033303-3303-3303-3303-330333033303",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc06",
        amountPaid: "15000000.00",
        status: "COMPLETED", // COMPLETED filter test!
        paymentDate: demoDate("2026-06-25T10:00:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-VND-8811",
        createdAt: demoDate("2026-06-24T03:00:00Z"),
      },
      {
        id: "34043404-3404-3404-3404-340434043404",
        vendorBillId: "33033303-3303-3303-3303-330333033304",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc07",
        amountPaid: "35000000.00",
        status: "COMPLETED", // COMPLETED filter test!
        paymentDate: demoDate("2026-06-28T11:00:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-VND-8812",
        createdAt: demoDate("2026-06-27T03:00:00Z"),
      },
    ]);

    // 15. Seed Project Field Costs & Expenses (Covering SUBMITTED, APPROVED, PAID, REJECTED)
    console.log("Seeding project field costs & expenses across all statuses...");
    // Cost 1: SUBMITTED / PENDING (Budi - Extra plywood Rp 5.0M)
    const cost1Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001";
    await tx.insert(projectCost).values({
      id: cost1Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
      materialId: "13131313-1313-1313-1313-131313131301",
      projectRapItemId: "17171717-1717-1717-1717-171717171701",
      requestedById: "33333333-3333-3333-3333-333333333331",
      quantity: "20.00",
      unitPrice: "250000.00",
      amount: "5000000.00",
      description: "Pembelian tripleks tambahan mendesak karena perubahan desain wall panel",
      receiptImageUrl: "/receipt_test.png",
      status: "SUBMITTED",
      budgetOverrun: false,
      createdAt: demoDate("2026-07-12T10:00:00Z"),
      updatedAt: demoDate("2026-07-12T10:00:00Z"),
    });

    // Cost 2: SUBMITTED / PENDING (Siti - Urgent subcon waterproofing Rp 6.2M)
    const cost2Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002";
    await tx.insert(projectCost).values({
      id: cost2Id,
      projectId: "77777777-7777-7777-7777-777777777772",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323205",
      requestedById: "33333333-3333-3333-3333-333333333332",
      quantity: "1.00",
      unitPrice: "6200000.00",
      amount: "6200000.00",
      description: "Pekerjaan perbaikan waterproofing mendesak area balkon penthouse",
      receiptImageUrl: "/receipt_test.png",
      status: "SUBMITTED",
      budgetOverrun: true,
      createdAt: demoDate("2026-07-14T09:00:00Z"),
      updatedAt: demoDate("2026-07-14T09:00:00Z"),
    });

    // Cost 3: APPROVED / Unpaid (Budi - E-toll & fuel Rp 1.05M)
    const cost3Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f003";
    await tx.insert(projectCost).values({
      id: cost3Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323103",
      requestedById: "33333333-3333-3333-3333-333333333331",
      quantity: "3.00",
      unitPrice: "350000.00",
      amount: "1050000.00",
      description: "Operasional bensin & e-toll trip supervisi tim tukang",
      receiptImageUrl: "/receipt_test.png",
      status: "APPROVED",
      budgetOverrun: false,
      createdAt: demoDate("2026-06-10T14:00:00Z"),
      updatedAt: demoDate("2026-06-11T09:00:00Z"),
    });

    // Cost 4: APPROVED / Unpaid (Siti - Site safety tools Rp 3.2M)
    const cost4Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f004";
    await tx.insert(projectCost).values({
      id: cost4Id,
      projectId: "77777777-7777-7777-7777-777777777772",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323203",
      requestedById: "33333333-3333-3333-3333-333333333332",
      quantity: "1.00",
      unitPrice: "3200000.00",
      amount: "3200000.00",
      description: "Pengadaan rompi K3, helm safety, dan sarung tangan proyek",
      receiptImageUrl: "/receipt_test.png",
      status: "APPROVED",
      budgetOverrun: false,
      createdAt: demoDate("2026-06-15T11:00:00Z"),
      updatedAt: demoDate("2026-06-16T08:00:00Z"),
    });

    // Cost 5: PAID / DISBURSED (Budi - Site consumables Rp 850k)
    const cost5Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f005";
    await tx.insert(projectCost).values({
      id: cost5Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323104",
      requestedById: "33333333-3333-3333-3333-333333333331",
      quantity: "1.00",
      unitPrice: "850000.00",
      amount: "850000.00",
      description: "Pembelian lakban, sekrup, dan mata bor cadangan",
      receiptImageUrl: "/receipt_test.png",
      status: "PAID",
      budgetOverrun: false,
      bankAccountId: "66666666-6666-6666-6666-666666666662",
      cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc08",
      verifiedById: "22222222-2222-2222-2222-222222222222",
      verifiedAt: demoDate("2026-06-06T09:00:00Z"),
      approvedById: "11111111-1111-1111-1111-111111111111",
      approvedAt: demoDate("2026-06-06T11:00:00Z"),
      paidById: "22222222-2222-2222-2222-222222222222",
      paidAt: demoDate("2026-06-06T14:00:00Z"),
      createdAt: demoDate("2026-06-05T10:00:00Z"),
      updatedAt: demoDate("2026-06-06T14:00:00Z"),
    });

    // Cost 6: PAID / DISBURSED (Siti - Workshop minor accessories Rp 2.5M)
    const cost6Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f006";
    await tx.insert(projectCost).values({
      id: cost6Id,
      projectId: "77777777-7777-7777-7777-777777777772",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323204",
      requestedById: "33333333-3333-3333-3333-333333333332",
      quantity: "1.00",
      unitPrice: "2500000.00",
      amount: "2500000.00",
      description: "Pembelian lem kayu khusus sintetis & aksesoris bengkel",
      receiptImageUrl: "/receipt_test.png",
      status: "PAID",
      budgetOverrun: false,
      bankAccountId: "66666666-6666-6666-6666-666666666664",
      cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc10",
      verifiedById: "22222222-2222-2222-2222-222222222222",
      verifiedAt: demoDate("2026-06-09T08:00:00Z"),
      approvedById: "11111111-1111-1111-1111-111111111111",
      approvedAt: demoDate("2026-06-09T09:00:00Z"),
      paidById: "22222222-2222-2222-2222-222222222222",
      paidAt: demoDate("2026-06-09T10:00:00Z"),
      createdAt: demoDate("2026-06-08T09:00:00Z"),
      updatedAt: demoDate("2026-06-09T10:00:00Z"),
    });

    // Cost 7: REJECTED (Budi - Personal team lunch without receipt Rp 1.2M)
    const cost7Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f007";
    await tx.insert(projectCost).values({
      id: cost7Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323103",
      requestedById: "33333333-3333-3333-3333-333333333331",
      quantity: "1.00",
      unitPrice: "1200000.00",
      amount: "1200000.00",
      description: "Klaim konsumsi tim tanpa kelengkapan kwitansi resmi",
      receiptImageUrl: "/receipt_test.png",
      status: "REJECTED",
      budgetOverrun: false,
      createdAt: demoDate("2026-06-20T11:00:00Z"),
      updatedAt: demoDate("2026-06-21T09:00:00Z"),
    });

    // Cost 8: REJECTED (Siti - Duplicate invoice submission Rp 950k)
    const cost8Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f008";
    await tx.insert(projectCost).values({
      id: cost8Id,
      projectId: "77777777-7777-7777-7777-777777777772",
      projectBudgetCategoryId: "32323232-3232-3232-3232-323232323204",
      requestedById: "33333333-3333-3333-3333-333333333332",
      quantity: "1.00",
      unitPrice: "950000.00",
      amount: "950000.00",
      description: "Pengajuan klaim ganda item consumable hardware",
      receiptImageUrl: "/receipt_test.png",
      status: "REJECTED",
      budgetOverrun: false,
      createdAt: demoDate("2026-06-22T14:00:00Z"),
      updatedAt: demoDate("2026-06-23T10:00:00Z"),
    });

    // Baseline-visible approval queue items. These are isolated from the
    // sequential finance walkthrough above, which still begins from SUBMITTED.
    const cost9Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f009";
    const cost10Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f010";
    await tx.insert(projectCost).values([
      {
        id: cost9Id,
        projectId: DEMO_IDS.projects.cipete,
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323603",
        requestedById: DEMO_IDS.users.pmBudi,
        quantity: "1.00",
        unitPrice: "7500000.00",
        amount: "7500000.00",
        description: "Sewa scaffolding dan proteksi area instalasi kitchen Cipete",
        receiptImageUrl: "/receipt_test.png",
        status: "VERIFIED",
        budgetOverrun: false,
        verifiedById: DEMO_IDS.users.finance,
        verifiedAt: demoDate("2026-07-20T10:00:00Z"),
        createdAt: demoDate("2026-07-19T09:00:00Z"),
        updatedAt: demoDate("2026-07-20T10:00:00Z"),
      },
      {
        id: cost10Id,
        projectId: DEMO_IDS.projects.cipete,
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323605",
        requestedById: DEMO_IDS.users.pmBudi,
        quantity: "1.00",
        unitPrice: "18000000.00",
        amount: "18000000.00",
        description: "DP fabrikasi countertop Cipete sebelum alokasi Subcon disetujui",
        receiptImageUrl: "/receipt_test.png",
        status: "VERIFIED",
        budgetOverrun: true,
        verifiedById: DEMO_IDS.users.finance,
        verifiedAt: demoDate("2026-07-21T11:00:00Z"),
        createdAt: demoDate("2026-07-21T08:00:00Z"),
        updatedAt: demoDate("2026-07-21T11:00:00Z"),
      },
    ]);

    // Canonical Expenses setup
    await tx.insert(projectExpenses).values([
      {
        id: "34343434-3434-3434-3434-343434343401",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323103",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        legacyProjectCostId: cost3Id,
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Operasional bensin & e-toll trip supervisi tim tukang",
        quantity: "3.00",
        unitCost: "350000.00",
        amount: "1050000.00",
        expenseDate: demoDate("2026-06-10T14:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "APPROVED",
      },
      {
        id: "34343434-3434-3434-3434-343434343402",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        legacyProjectCostId: cost1Id,
        materialId: "13131313-1313-1313-1313-131313131301",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Pembelian tripleks tambahan mendesak karena perubahan desain",
        quantity: "20.00",
        unitCost: "250000.00",
        amount: "5000000.00",
        expenseDate: demoDate("2026-07-12T10:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "SUBMITTED",
      },
      {
        id: "34343434-3434-3434-3434-343434343403",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323205",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        legacyProjectCostId: cost2Id,
        requestedById: "33333333-3333-3333-3333-333333333332",
        description: "Pekerjaan perbaikan waterproofing mendesak area balkon penthouse",
        quantity: "1.00",
        unitCost: "6200000.00",
        amount: "6200000.00",
        expenseDate: demoDate("2026-07-14T09:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "SUBMITTED",
      },
      {
        id: "34343434-3434-3434-3434-343434343404",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323203",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        legacyProjectCostId: cost4Id,
        requestedById: "33333333-3333-3333-3333-333333333332",
        description: "Pengadaan rompi K3, helm safety, dan sarung tangan proyek",
        quantity: "1.00",
        unitCost: "3200000.00",
        amount: "3200000.00",
        expenseDate: demoDate("2026-06-15T11:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "APPROVED",
      },
      {
        id: "34343434-3434-3434-3434-343434343405",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323104",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        legacyProjectCostId: cost5Id,
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Pembelian lakban, sekrup, dan mata bor cadangan",
        quantity: "1.00",
        unitCost: "850000.00",
        amount: "850000.00",
        expenseDate: demoDate("2026-06-05T10:00:00Z"),
        paymentStatus: "PAID",
        receiptImageUrl: "/receipt_test.png",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343406",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323204",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        legacyProjectCostId: cost6Id,
        requestedById: "33333333-3333-3333-3333-333333333332",
        description: "Pembelian lem kayu khusus sintetis & aksesoris bengkel",
        quantity: "1.00",
        unitCost: "2500000.00",
        amount: "2500000.00",
        expenseDate: demoDate("2026-06-08T09:00:00Z"),
        paymentStatus: "PAID",
        receiptImageUrl: "/receipt_test.png",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343407",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323103",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        legacyProjectCostId: cost7Id,
        requestedById: "33333333-3333-3333-3333-333333333331",
        description: "Klaim konsumsi tim tanpa kelengkapan kwitansi resmi",
        quantity: "1.00",
        unitCost: "1200000.00",
        amount: "1200000.00",
        expenseDate: demoDate("2026-06-20T11:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "REJECTED",
      },
      {
        id: "34343434-3434-3434-3434-343434343408",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323204",
        expenseCategoryId: "31313131-3131-3131-3131-313131313104",
        legacyProjectCostId: cost8Id,
        requestedById: "33333333-3333-3333-3333-333333333332",
        description: "Pengajuan klaim ganda item consumable hardware",
        quantity: "1.00",
        unitCost: "950000.00",
        amount: "950000.00",
        expenseDate: demoDate("2026-06-22T14:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "REJECTED",
      },
      {
        id: "34343434-3434-3434-3434-343434343409",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        materialId: "13131313-1313-1313-1313-131313131301",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        requestedById: "33333333-3333-3333-3333-333333333333",
        description: "Invoice pembelian material kayu panel Multipleks",
        quantity: "1.00",
        unitCost: "20000000.00",
        amount: "20000000.00",
        expenseDate: demoDate("2026-06-18T10:00:00Z"),
        paymentStatus: "UNPAID",
        status: "APPROVED",
      },
      {
        id: "34343434-3434-3434-3434-343434343410",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        vendorBillId: "33033303-3303-3303-3303-330333033302",
        materialId: "13131313-1313-1313-1313-131313131303",
        requestedById: "33333333-3333-3333-3333-333333333333",
        description: "Tagihan fabrikasi solid surface countertop kitchen",
        quantity: "1.00",
        unitCost: "41000000.00",
        amount: "41000000.00",
        expenseDate: demoDate("2026-06-19T10:00:00Z"),
        paymentStatus: "UNPAID",
        status: "APPROVED",
      },
      {
        id: "34343434-3434-3434-3434-343434343411",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetId: "30303030-3030-3030-3030-303030303001",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323102",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        vendorBillId: "33033303-3303-3303-3303-330333033303",
        materialId: "13131313-1313-1313-1313-131313131307",
        requestedById: "33333333-3333-3333-3333-333333333333",
        description: "Tagihan LED strip dan lighting profile",
        quantity: "1.00",
        unitCost: "15000000.00",
        amount: "15000000.00",
        expenseDate: demoDate("2026-06-22T14:00:00Z"),
        paymentStatus: "PAID",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343412",
        projectId: "77777777-7777-7777-7777-777777777772",
        projectBudgetId: "30303030-3030-3030-3030-303030303002",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323202",
        expenseCategoryId: "31313131-3131-3131-3131-313131313102",
        vendorBillId: "33033303-3303-3303-3303-330333033304",
        materialId: "13131313-1313-1313-1313-131313131301",
        requestedById: "33333333-3333-3333-3333-333333333333",
        description: "Pembelian material HPL dan kayu Sudirman Suites",
        quantity: "1.00",
        unitCost: "35000000.00",
        amount: "35000000.00",
        expenseDate: demoDate("2026-06-27T11:00:00Z"),
        paymentStatus: "PAID",
        status: "PAID",
      },
      {
        id: "34343434-3434-3434-3434-343434343413",
        projectId: DEMO_IDS.projects.cipete,
        projectBudgetId: "30303030-3030-3030-3030-303030303006",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323603",
        expenseCategoryId: "31313131-3131-3131-3131-313131313103",
        legacyProjectCostId: cost9Id,
        requestedById: DEMO_IDS.users.pmBudi,
        description: "Sewa scaffolding dan proteksi area instalasi kitchen Cipete",
        quantity: "1.00",
        unitCost: "7500000.00",
        amount: "7500000.00",
        expenseDate: demoDate("2026-07-19T09:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "VERIFIED",
      },
      {
        id: "34343434-3434-3434-3434-343434343414",
        projectId: DEMO_IDS.projects.cipete,
        projectBudgetId: "30303030-3030-3030-3030-303030303006",
        projectBudgetCategoryId: "32323232-3232-3232-3232-323232323605",
        expenseCategoryId: "31313131-3131-3131-3131-313131313105",
        legacyProjectCostId: cost10Id,
        projectCategoryPlanItemId: "35353535-3535-3535-3535-353535353510",
        requestedById: DEMO_IDS.users.pmBudi,
        description: "DP fabrikasi countertop Cipete sebelum alokasi Subcon disetujui",
        quantity: "1.00",
        unitCost: "18000000.00",
        amount: "18000000.00",
        expenseDate: demoDate("2026-07-21T08:00:00Z"),
        paymentStatus: "UNPAID",
        receiptImageUrl: "/receipt_test.png",
        status: "VERIFIED",
      },
    ]);

    await syncProjectBudgetCategories({
      tx,
      projectBudgetCategoryIds: seededBudgetCategories.map((category) => category.id),
    });

    // 16. Seed Approvals (Covering ALL approval filters: FIELD, VENDOR, STOCK, CRITICAL)
    console.log("Seeding pending approvals for all filters...");
    await tx.insert(approval).values([
      // FIELD Approvals (2 items)
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e001",
        approverId: "11111111-1111-1111-1111-111111111111",
        referenceType: "project_cost",
        referenceId: cost1Id,
        status: "PENDING",
        notes: "Pengeluaran lapangan Rp 5.000.000 (Tripleks tambahan Menteng).",
      },
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e002",
        approverId: "11111111-1111-1111-1111-111111111111",
        referenceType: "project_cost",
        referenceId: cost2Id,
        status: "PENDING",
        notes: "Pengeluaran lapangan Rp 6.200.000 (Subcon waterproofing Sudirman).",
      },
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e006",
        approverId: DEMO_IDS.users.owner,
        referenceType: "project_cost",
        referenceId: cost9Id,
        status: "PENDING",
        notes: "Sewa scaffolding Cipete Rp 7.500.000 sudah diverifikasi Finance.",
        createdAt: demoDate("2026-07-20T10:05:00Z"),
      },
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e007",
        approverId: DEMO_IDS.users.owner,
        referenceType: "project_cost",
        referenceId: cost10Id,
        status: "PENDING",
        notes: "DP countertop Cipete Rp 18.000.000 melewati alokasi Subcon.",
        createdAt: demoDate("2026-07-21T11:05:00Z"),
      },
      // Vendor payment Rp4 juta sengaja tidak memiliki approval karena di bawah threshold.
      // Vendor payment Rp10 juta wajib memiliki approval Owner.
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e004",
        approverId: "11111111-1111-1111-1111-111111111111",
        referenceType: "vendor_payment",
        referenceId: "34043404-3404-3404-3404-340434043402",
        status: "PENDING",
        notes: "Persetujuan pencairan pembayaran vendor CV Batu Prima Rp 10.000.000.",
      },
      // STOCK Approval (1 item)
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e005",
        approverId: "11111111-1111-1111-1111-111111111111",
        referenceType: "inventory_opening",
        referenceId: "95959595-9595-9595-9595-959595959502",
        status: "PENDING",
        notes: "Persetujuan saldo awal stok Workshop Cikupa (OPB-2026-07-0002).",
      },
    ]);

    // 17. Seed Goods Receipts (GRN) & Stock Movements
    console.log("Seeding goods receipts & stock movements...");
    await tx.insert(goodsReceipt).values([
      {
        id: "61616161-6161-6161-6161-616161616101",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        projectId: "77777777-7777-7777-7777-777777777771",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        receiptNumber: "GRN-2026-001",
        status: "POSTED",
        receivedAt: demoDate("2026-06-20T10:00:00Z"),
        note: "Surat jalan penerimaan Multipleks 18mm dari PT Cahaya Mas",
        receivedById: "33333333-3333-3333-3333-333333333333",
      },
      {
        id: "61616161-6161-6161-6161-616161616102",
        vendorBillId: "33033303-3303-3303-3303-330333033303",
        projectId: "77777777-7777-7777-7777-777777777771",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        receiptNumber: "GRN-2026-002",
        status: "POSTED",
        receivedAt: demoDate("2026-06-22T14:00:00Z"),
        note: "Surat jalan LED strip dari PT Sinar Kaca",
        receivedById: "33333333-3333-3333-3333-333333333333",
      },
    ]);

    await tx.insert(stockMovement).values([
      {
        id: "18181818-1818-1818-1818-181818181807",
        materialId: "13131313-1313-1313-1313-131313131301",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        movementType: "GOODS_RECEIPT",
        movementDirection: "IN",
        referenceType: "GOODS_RECEIPT",
        referenceId: "61616161-6161-6161-6161-616161616101",
        quantity: "20.00",
        unitCost: "250000.00",
        note: "Diterima dalam kondisi baik",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-20T10:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181808",
        materialId: "13131313-1313-1313-1313-131313131307",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        vendorBillId: "33033303-3303-3303-3303-330333033303",
        movementType: "GOODS_RECEIPT",
        movementDirection: "IN",
        referenceType: "GOODS_RECEIPT",
        referenceId: "61616161-6161-6161-6161-616161616102",
        quantity: "30.00",
        unitCost: "225000.00",
        note: "Penerimaan LED strip warm white",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-22T14:00:00Z"),
      },
    ]);

    await tx.insert(goodsReceiptItem).values([
      {
        id: "62626262-6262-6262-6262-626262626201",
        goodsReceiptId: "61616161-6161-6161-6161-616161616101",
        materialId: "13131313-1313-1313-1313-131313131301",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        stockMovementId: "18181818-1818-1818-1818-181818181807",
        quantity: "20.00",
        unitCost: "250000.00",
        note: "Diterima dalam kondisi baik",
      },
      {
        id: "62626262-6262-6262-6262-626262626202",
        goodsReceiptId: "61616161-6161-6161-6161-616161616102",
        materialId: "13131313-1313-1313-1313-131313131307",
        stockMovementId: "18181818-1818-1818-1818-181818181808",
        quantity: "30.00",
        unitCost: "225000.00",
        note: "Penerimaan LED strip warm white",
      },
    ]);

    // Stock Movements (Covering ALL movement types: GRN, RESERVE, USE, RETURN, ADJUSTMENT, WASTE, TRANSFER)
    await tx.insert(stockMovement).values([
      {
        id: "18181818-1818-1818-1818-181818181801",
        materialId: "13131313-1313-1313-1313-131313131301",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectRapItemId: "17171717-1717-1717-1717-171717171701",
        movementType: "RESERVE",
        movementDirection: "NEUTRAL",
        referenceType: "RAP_RESERVATION",
        referenceId: "17171717-1717-1717-1717-171717171701",
        quantity: "20.00",
        unitCost: "245000.00",
        note: "Reservasi awal dari stok gudang untuk kabinet kitchen Menteng.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-23T08:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181802",
        materialId: "13131313-1313-1313-1313-131313131302",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "RESERVE",
        movementDirection: "NEUTRAL",
        referenceType: "PROJECT_RESERVATION",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "5.00",
        unitCost: "190000.00",
        note: "Reservasi HPL yang tersedia.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-23T08:15:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181803",
        materialId: "13131313-1313-1313-1313-131313131301",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "USE",
        movementDirection: "OUT",
        referenceType: "PROJECT_USAGE",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "15.00",
        unitCost: "245000.00",
        note: "Penggunaan material multipleks untuk pemotongan kabinet.",
        createdById: "33333333-3333-3333-3333-333333333331",
        createdAt: demoDate("2026-06-24T09:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181804",
        materialId: "13131313-1313-1313-1313-131313131304",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        movementType: "ADJUSTMENT",
        movementDirection: "IN",
        referenceType: "MANUAL_ADJUSTMENT",
        referenceId: "18181818-1818-1818-1818-181818181804",
        quantity: "2.00",
        unitCost: "180000.00",
        note: "Koreksi opname bulanan Gudang Utama.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-29T09:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181805",
        materialId: "13131313-1313-1313-1313-131313131302",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "WASTE",
        movementDirection: "OUT",
        referenceType: "PROJECT_WASTE",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "1.00",
        unitCost: "190000.00",
        note: "HPL retak saat pemotongan lembaran.",
        createdById: "33333333-3333-3333-3333-333333333331",
        createdAt: demoDate("2026-06-24T15:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181806",
        materialId: "13131313-1313-1313-1313-131313131305",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "RETURN",
        movementDirection: "IN",
        referenceType: "PROJECT_RETURN",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "2.00",
        unitCost: "725000.00",
        note: "Pengembalian sisa hardware set dari site Menteng.",
        createdById: "33333333-3333-3333-3333-333333333331",
        createdAt: demoDate("2026-06-24T14:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181809",
        materialId: "13131313-1313-1313-1313-131313131305",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "USE",
        movementDirection: "OUT",
        referenceType: "PROJECT_USAGE",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "2.00",
        unitCost: "725000.00",
        note: "Hardware set dibawa ke site Menteng sebelum sisa dikembalikan.",
        createdById: "33333333-3333-3333-3333-333333333331",
        createdAt: demoDate("2026-06-24T10:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181810",
        materialId: "13131313-1313-1313-1313-131313131303",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "RESERVE",
        movementDirection: "NEUTRAL",
        referenceType: "PROJECT_RESERVATION",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "2.00",
        unitCost: "850000.00",
        note: "Reservasi solid surface untuk pekerjaan countertop Menteng.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-23T08:30:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181811",
        materialId: "13131313-1313-1313-1313-131313131304",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        projectId: "77777777-7777-7777-7777-777777777771",
        movementType: "RESERVE",
        movementDirection: "NEUTRAL",
        referenceType: "PROJECT_RESERVATION",
        referenceId: "77777777-7777-7777-7777-777777777771",
        quantity: "5.00",
        unitCost: "180000.00",
        note: "Reservasi MDF untuk panel kabinet Menteng.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-23T08:45:00Z"),
      },
    ]);

    // 18. Seed Stock Transfers & Stock Counts
    console.log("Seeding stock transfers & stock counts...");
    await tx.insert(stockTransfer).values([
      {
        id: "71717171-7171-7171-7171-717171717101",
        transferNumber: "TRF-2026-001",
        fromLocationId: "14141414-1414-1414-1414-141414141401",
        toLocationId: "14141414-1414-1414-1414-141414141403",
        status: "POSTED",
        transferredAt: demoDate("2026-06-25T09:00:00Z"),
        note: "Transfer Multipleks dari Gudang Utama ke Site Menteng.",
        createdById: "33333333-3333-3333-3333-333333333333",
      },
      {
        id: "71717171-7171-7171-7171-717171717102",
        transferNumber: "TRF-2026-002",
        fromLocationId: "14141414-1414-1414-1414-141414141401",
        toLocationId: "14141414-1414-1414-1414-141414141402",
        status: "POSTED",
        transferredAt: demoDate("2026-06-28T14:00:00Z"),
        note: "Transfer hardware set ke Workshop Cikupa.",
        createdById: "33333333-3333-3333-3333-333333333333",
      },
    ]);

    await tx.insert(stockMovement).values([
      {
        id: "18181818-1818-1818-1818-181818181812",
        materialId: "13131313-1313-1313-1313-131313131301",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        movementType: "TRANSFER",
        movementDirection: "OUT",
        referenceType: "STOCK_TRANSFER",
        referenceId: "71717171-7171-7171-7171-717171717101",
        quantity: "10.00",
        unitCost: "245000.00",
        note: "Keluar dari Gudang Utama menuju Gudang Transit Menteng.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-25T09:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181813",
        materialId: "13131313-1313-1313-1313-131313131301",
        inventoryLocationId: "14141414-1414-1414-1414-141414141403",
        movementType: "TRANSFER",
        movementDirection: "IN",
        referenceType: "STOCK_TRANSFER",
        referenceId: "71717171-7171-7171-7171-717171717101",
        quantity: "10.00",
        unitCost: "245000.00",
        note: "Masuk ke Gudang Transit Menteng dari Gudang Utama.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-25T09:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181814",
        materialId: "13131313-1313-1313-1313-131313131305",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        movementType: "TRANSFER",
        movementDirection: "OUT",
        referenceType: "STOCK_TRANSFER",
        referenceId: "71717171-7171-7171-7171-717171717102",
        quantity: "5.00",
        unitCost: "725000.00",
        note: "Keluar dari Gudang Utama menuju Workshop Cikupa.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-28T14:00:00Z"),
      },
      {
        id: "18181818-1818-1818-1818-181818181815",
        materialId: "13131313-1313-1313-1313-131313131305",
        inventoryLocationId: "14141414-1414-1414-1414-141414141402",
        movementType: "TRANSFER",
        movementDirection: "IN",
        referenceType: "STOCK_TRANSFER",
        referenceId: "71717171-7171-7171-7171-717171717102",
        quantity: "5.00",
        unitCost: "725000.00",
        note: "Masuk ke Workshop Cikupa dari Gudang Utama.",
        createdById: "33333333-3333-3333-3333-333333333333",
        createdAt: demoDate("2026-06-28T14:00:00Z"),
      },
    ]);

    await tx.insert(stockTransferItem).values([
      {
        id: "72727272-7272-7272-7272-727272727201",
        stockTransferId: "71717171-7171-7171-7171-717171717101",
        materialId: "13131313-1313-1313-1313-131313131301",
        outMovementId: "18181818-1818-1818-1818-181818181812",
        inMovementId: "18181818-1818-1818-1818-181818181813",
        quantity: "10.00",
        unitCost: "245000.00",
      },
      {
        id: "72727272-7272-7272-7272-727272727202",
        stockTransferId: "71717171-7171-7171-7171-717171717102",
        materialId: "13131313-1313-1313-1313-131313131305",
        outMovementId: "18181818-1818-1818-1818-181818181814",
        inMovementId: "18181818-1818-1818-1818-181818181815",
        quantity: "5.00",
        unitCost: "725000.00",
      },
    ]);

    await tx.insert(stockCount).values([
      {
        id: "81818181-8181-8181-8181-818181818101",
        countNumber: "STC-2026-06",
        inventoryLocationId: "14141414-1414-1414-1414-141414141401",
        status: "POSTED",
        countedAt: demoDate("2026-06-30T17:00:00Z"),
        note: "Stock opname rutin akhir bulan Juni Gudang Utama.",
        createdById: "33333333-3333-3333-3333-333333333333",
        submittedAt: demoDate("2026-06-30T17:15:00Z"),
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: demoDate("2026-07-01T08:00:00Z"),
      },
      {
        id: "81818181-8181-8181-8181-818181818102",
        countNumber: "STC-2026-07",
        inventoryLocationId: "14141414-1414-1414-1414-141414141402",
        status: "PENDING_APPROVAL",
        countedAt: demoDate("2026-07-15T17:00:00Z"),
        note: "Stock opname pertengahan bulan Workshop Cikupa.",
        createdById: "33333333-3333-3333-3333-333333333333",
        submittedAt: demoDate("2026-07-15T17:15:00Z"),
      },
    ]);

    await tx.insert(stockMovement).values({
      id: "18181818-1818-1818-1818-181818181816",
      materialId: "13131313-1313-1313-1313-131313131304",
      inventoryLocationId: "14141414-1414-1414-1414-141414141401",
      movementType: "STOCK_COUNT_ADJUSTMENT",
      movementDirection: "OUT",
      referenceType: "STOCK_COUNT",
      referenceId: "81818181-8181-8181-8181-818181818101",
      quantity: "2.00",
      unitCost: "180000.00",
      note: "Selisih stock opname akhir Juni: stok fisik lebih rendah dua lembar.",
      createdById: "11111111-1111-1111-1111-111111111111",
      createdAt: demoDate("2026-07-01T08:00:00Z"),
    });

    await tx.insert(stockCountItem).values([
      {
        id: "82828282-8282-8282-8282-828282828201",
        stockCountId: "81818181-8181-8181-8181-818181818101",
        materialId: "13131313-1313-1313-1313-131313131301",
        systemQuantity: "35.00",
        countedQuantity: "35.00",
        varianceQuantity: "0.00",
        unitCost: "245000.00",
      },
      {
        id: "82828282-8282-8282-8282-828282828202",
        stockCountId: "81818181-8181-8181-8181-818181818101",
        materialId: "13131313-1313-1313-1313-131313131304",
        systemQuantity: "87.00",
        countedQuantity: "85.00",
        varianceQuantity: "-2.00",
        unitCost: "180000.00",
        stockMovementId: "18181818-1818-1818-1818-181818181816",
      },
      {
        id: "82828282-8282-8282-8282-828282828203",
        stockCountId: "81818181-8181-8181-8181-818181818102",
        materialId: "13131313-1313-1313-1313-131313131305",
        systemQuantity: "5.00",
        countedQuantity: "4.00",
        varianceQuantity: "-1.00",
        unitCost: "725000.00",
      },
    ]);

    // 19. Seed Form Drafts (2 saved drafts)
    console.log("Seeding saved form drafts...");
    await tx.insert(formDraft).values([
      {
        id: "91919191-9191-9191-9191-919191919101",
        ownerUserId: "33333333-3333-3333-3333-333333333332",
        formType: "vendor_bill",
        projectId: "77777777-7777-7777-7777-777777777772",
        schemaVersion: 1,
        revision: 1,
        payload: {
          vendorId: "55555555-5555-5555-5555-555555555554",
          amount: "18500000.00",
          notes: "Draft tagihan Hafele Hardware untuk penthouse",
        },
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 86400000 * 7),
      },
      {
        id: "91919191-9191-9191-9191-919191919102",
        ownerUserId: "33333333-3333-3333-3333-333333333331",
        formType: "field_request",
        projectId: "77777777-7777-7777-7777-777777777771",
        schemaVersion: 1,
        revision: 1,
        payload: {
          amount: "1450000.00",
          description: "Draft klaim biaya koordinasi & sewa steger lapangan",
        },
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 86400000 * 7),
      },
    ]);

    // 20. Seed Profitability Snapshots, Notifications & Audit Logs
    console.log("Seeding profitability snapshots, notifications & audit logs...");
    const mentengCategories = await tx.query.projectBudgetCategory.findMany({
      where: (table, { eq }) => eq(table.projectBudgetId, "30303030-3030-3030-3030-303030303001"),
    });
    const mentengInvoices = await tx.query.clientInvoice.findMany({
      where: (table, { eq }) => eq(table.projectId, DEMO_IDS.projects.menteng),
      with: { payments: true },
    });
    const mentengBills = await tx.query.vendorBill.findMany({
      where: (table, { eq }) => eq(table.projectId, DEMO_IDS.projects.menteng),
      with: { payments: true },
    });
    const mentengCosts = await tx.query.projectCost.findMany({
      where: (table, { eq }) => eq(table.projectId, DEMO_IDS.projects.menteng),
    });
    const mentengMovements = await tx.query.stockMovement.findMany({
      where: (table, { eq }) => eq(table.projectId, DEMO_IDS.projects.menteng),
    });
    const mentengRapItems = await tx.query.projectRapItem.findMany({
      where: (table, { eq }) => eq(table.projectRapId, "16161616-1616-1616-1616-161616161601"),
    });
    const mentengActualMinor = mentengCategories.reduce(
      (sum, category) => sum + parseMoneyToMinor(category.actualAmount),
      0n,
    );
    const mentengPaidMinor = mentengCategories.reduce(
      (sum, category) => sum + parseMoneyToMinor(category.paidAmount),
      0n,
    );
    const mentengReceiptsMinor = mentengInvoices
      .flatMap((invoice) => invoice.payments)
      .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
    const mentengMaterialCategory = mentengCategories.find(
      (category) => category.expenseCategoryId === "31313131-3131-3131-3131-313131313102",
    );
    if (!mentengMaterialCategory) throw new Error("MENTENG_MATERIAL_CATEGORY_NOT_FOUND");
    const mentengStockAppliedMinor = mentengMovements.reduce((sum, movement) => {
      const value =
        (parseMoneyToMinor(movement.quantity) * parseMoneyToMinor(movement.unitCost)) / 100n;
      if (movement.movementType === "USE" || movement.movementType === "WASTE") return sum + value;
      if (movement.movementType === "RETURN") return sum - value;
      return sum;
    }, 0n);
    const mentengShortageMinor = mentengRapItems
      .filter((item) => item.status === "SHORTAGE")
      .reduce((sum, item) => sum + parseMoneyToMinor(item.estimatedTotalCost), 0n);
    const mentengInternalBudgetMinor = parseMoneyToMinor(mentengInternalBudget.toFixed(2));
    const mentengActual = Number(formatMinorMoney(mentengActualMinor));
    const mentengMaterialActual = Number(mentengMaterialCategory.actualAmount);
    const mentengMaterialBudget = Number(mentengMaterialCategory.allocatedAmount);

    assertSeedInvariant(
      mentengBills.flatMap((bill) => bill.payments).length > 0 && mentengCosts.length > 0,
      "Menteng profitability source detail is incomplete",
    );
    await tx.insert(projectProfitabilitySnapshot).values({
      id: "35353535-3535-3535-3535-353535353501",
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetId: "30303030-3030-3030-3030-303030303001",
      contractValue: mentengContractValue.toFixed(2),
      approvedRabValue: mentengContractValue.toFixed(2),
      internalBudget: mentengInternalBudget.toFixed(2),
      actualCost: formatMinorMoney(mentengActualMinor),
      remainingBudget: formatMinorMoney(mentengInternalBudgetMinor - mentengActualMinor),
      budgetUsedPercentage: calculateUsedPercentage(mentengActual, mentengInternalBudget).toFixed(
        4,
      ),
      targetGrossAmount: mentengGross.amount.toFixed(2),
      targetGrossPercentage: mentengGross.percentage.toFixed(4),
      projectedFinalCost: mentengInternalBudget.toFixed(2),
      projectedMarginAmount: mentengGross.amount.toFixed(2),
      projectedMarginPercentage: mentengGross.percentage.toFixed(4),
      cashPosition: formatMinorMoney(mentengReceiptsMinor - mentengPaidMinor),
      materialBudget: mentengMaterialCategory.allocatedAmount,
      materialActual: mentengMaterialCategory.actualAmount,
      materialRemaining: mentengMaterialCategory.remainingAmount,
      materialUsedPercentage: calculateUsedPercentage(
        mentengMaterialActual,
        mentengMaterialBudget,
      ).toFixed(4),
      materialStockValueApplied: formatMinorMoney(mentengStockAppliedMinor),
      materialShortageValue: formatMinorMoney(mentengShortageMinor),
      leftoverStockValue: "0.00",
      riskStatus: mentengCategories.some((category) => category.status === "CRITICAL")
        ? "CRITICAL"
        : mentengCategories.some((category) => category.status === "WARNING")
          ? "WARNING"
          : "SAFE",
    });

    await tx.insert(notification).values([
      // ACTION_REQUIRED (Perlu Tindakan)
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd01",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Biaya Cipete melewati alokasi Subcon",
        message:
          "DP countertop Rp 18.000.000 sudah diverifikasi Finance dan membutuhkan keputusan Owner.",
        read: false,
        severity: "CRITICAL",
        category: "ACTION_REQUIRED",
        projectId: DEMO_IDS.projects.cipete,
        requiredPermission: "approve:cost",
        eventKey: `project_cost:${cost10Id}:lifecycle:PENDING_OWNER`,
        referenceType: "project_cost",
        referenceId: cost10Id,
        actionUrl: "/approvals",
        createdAt: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd02",
        tenantId: DEKORIA_TENANT_ID,
        userId: "11111111-1111-1111-1111-111111111111",
        title: "Persetujuan Saldo Awal Gudang",
        message: "Pengajuan saldo awal Workshop Cikupa (OPB-2026-07-0002) membutuhkan verifikasi.",
        read: false,
        severity: "WARNING",
        category: "ACTION_REQUIRED",
        requiredPermission: "approve:opening_inventory",
        eventKey: "inventory_opening:95959595-9595-9595-9595-959595959502:lifecycle:PENDING_OWNER",
        referenceType: "inventory_opening",
        referenceId: "95959595-9595-9595-9595-959595959502",
        actionUrl: "/approvals",
        createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd03",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Pembayaran vendor menunggu keputusan",
        message: "Pencairan Rp 10.000.000 untuk BILL-2026-092 membutuhkan persetujuan Owner.",
        read: false,
        severity: "WARNING",
        category: "ACTION_REQUIRED",
        projectId: DEMO_IDS.projects.menteng,
        requiredPermission: "approve:cost",
        eventKey: "vendor_payment:34043404-3404-3404-3404-340434043402:lifecycle:PENDING_OWNER",
        referenceType: "vendor_payment",
        referenceId: "34043404-3404-3404-3404-340434043402",
        actionUrl: "/approvals",
        createdAt: new Date(Date.now() - 4 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd04",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Project Budget Pakubuwono menunggu approval",
        message: "Plafon internal Rp 585.000.000 dan alokasi kategori siap ditinjau Owner.",
        read: false,
        severity: "INFO",
        category: "ACTION_REQUIRED",
        projectId: DEMO_IDS.projects.pakubuwono,
        requiredPermission: "approve:budget",
        eventKey: "project_budget:30303030-3030-3030-3030-303030303005:lifecycle:PENDING_APPROVAL",
        referenceType: "project_budget",
        referenceId: "30303030-3030-3030-3030-303030303005",
        actionUrl: `/projects/${DEMO_IDS.projects.pakubuwono}`,
        createdAt: new Date(Date.now() - 8 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd05",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Change Order Sudirman siap diputuskan",
        message: "RAB R2 menambah Rp 135.000.000 dan sudah memiliki bukti konfirmasi klien.",
        read: false,
        severity: "WARNING",
        category: "ACTION_REQUIRED",
        projectId: DEMO_IDS.projects.sudirman,
        requiredPermission: "approve:rab",
        eventKey: "change_order:23232323-2323-2323-2323-232323232301:lifecycle:PENDING_APPROVAL",
        referenceType: "change_order",
        referenceId: "23232323-2323-2323-2323-232323232301",
        actionUrl: `/projects/${DEMO_IDS.projects.sudirman}`,
        createdAt: new Date(Date.now() - 18 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd06",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Klaim tanpa bukti sudah ditolak",
        message: "Klaim konsumsi tim Menteng Rp 1.200.000 selesai dengan keputusan ditolak.",
        read: true,
        readAt: new Date(Date.now() - 20 * 3600 * 1000),
        severity: "INFO",
        category: "ACTION_REQUIRED",
        projectId: DEMO_IDS.projects.menteng,
        requiredPermission: "approve:cost",
        eventKey: `project_cost:${cost7Id}:lifecycle:REJECTED`,
        isResolved: true,
        resolvedAt: new Date(Date.now() - 20 * 3600 * 1000),
        resolvedById: DEMO_IDS.users.owner,
        referenceType: "project_cost",
        referenceId: cost7Id,
        actionUrl: `/projects/${DEMO_IDS.projects.menteng}`,
        createdAt: new Date(Date.now() - 24 * 3600 * 1000),
      },
      // INFORMATIONAL (Informasi)
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd07",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Penerimaan Termin Klien Dikonfirmasi",
        message: "Dana termin 2 Menteng sebesar Rp 120.000.000 sudah tercatat di BCA Operasional.",
        read: false,
        severity: "INFO",
        category: "INFORMATIONAL",
        projectId: DEMO_IDS.projects.menteng,
        requiredPermission: "view:client_invoice",
        eventKey: "client_payment:02020202-0202-0202-0202-020202020204:lifecycle:RECORDED",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020204",
        actionUrl: `/projects/${DEMO_IDS.projects.menteng}`,
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd08",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Stok Material di Bawah Buffer Minimum",
        message: "HPL Taco Light Oak di Gudang Utama tersisa 5 lembar, di bawah minimum 15 lembar.",
        read: false,
        severity: "WARNING",
        category: "INFORMATIONAL",
        requiredPermission: "view:inventory",
        eventKey: "material:13131313-1313-1313-1313-131313131302:BELOW_MINIMUM",
        referenceType: "material",
        referenceId: "13131313-1313-1313-1313-131313131302",
        actionUrl: "/materials",
        createdAt: new Date(Date.now() - 3 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd09",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Penerimaan Barang (Goods Receipt)",
        message: "GRN-2026-001 untuk material Menteng sudah diposting ke Gudang Utama.",
        read: false,
        severity: "INFO",
        category: "INFORMATIONAL",
        projectId: DEMO_IDS.projects.menteng,
        requiredPermission: "view:inventory",
        eventKey: "goods_receipt:61616161-6161-6161-6161-616161616101:lifecycle:POSTED",
        referenceType: "goods_receipt",
        referenceId: "61616161-6161-6161-6161-616161616101",
        actionUrl: `/projects/${DEMO_IDS.projects.menteng}`,
        createdAt: new Date(Date.now() - 6 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd10",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Rekonsiliasi Bank Otomatis Selesai",
        message: "Sembilan mutasi rekening telah mempunyai pasangan buku besar yang terkonfirmasi.",
        read: true,
        readAt: new Date(Date.now() - 12 * 3600 * 1000),
        severity: "INFO",
        category: "INFORMATIONAL",
        requiredPermission: "reconcile:ledger",
        eventKey: "system:reconciliation-demo:HISTORY_READY",
        referenceType: "system",
        referenceId: DEKORIA_TENANT_ID,
        actionUrl: "/reconciliation",
        createdAt: new Date(Date.now() - 12 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd11",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Margin Proyek Menteng Terjaga",
        message: "Snapshot profitabilitas Menteng konsisten dengan realisasi kategori budget.",
        read: true,
        readAt: new Date(Date.now() - 36 * 3600 * 1000),
        severity: "INFO",
        category: "INFORMATIONAL",
        projectId: DEMO_IDS.projects.menteng,
        requiredPermission: "view:profitability",
        eventKey: `project:${DEMO_IDS.projects.menteng}:lifecycle:PROFITABILITY_SNAPSHOT`,
        referenceType: "project",
        referenceId: DEMO_IDS.projects.menteng,
        actionUrl: `/projects/${DEMO_IDS.projects.menteng}`,
        createdAt: new Date(Date.now() - 36 * 3600 * 1000),
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd12",
        tenantId: DEKORIA_TENANT_ID,
        userId: DEMO_IDS.users.owner,
        title: "Pengingat Tutup Buku Kas Mingguan",
        message: "Seluruh pencatatan kas minggu ke-35 telah siap untuk ditinjau dan ditutup.",
        read: false,
        severity: "INFO",
        category: "INFORMATIONAL",
        requiredPermission: "view:ledger",
        eventKey: "system:weekly-ledger-review:READY",
        referenceType: "system",
        referenceId: DEKORIA_TENANT_ID,
        actionUrl: "/ledger",
        createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      },
    ]);

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
      {
        id: "99099909-9909-9909-9909-990999099902",
        userId: "11111111-1111-1111-1111-111111111111",
        action: "APPROVE_PROJECT_BUDGET",
        targetTable: "project_budget",
        targetId: "88888888-8888-8888-8888-888888888881",
        originalState: '{"status": "SUBMITTED"}',
        newState: '{"status": "APPROVED"}',
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      },
    ]);

    const seededCashTransactionsForAudit = await tx.select().from(cashTransaction);
    const runningBalanceByAccount = new Map<string, bigint>();
    const balanceAuditEvents = [...seededCashTransactionsForAudit]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((transaction, index) => {
        const before = runningBalanceByAccount.get(transaction.bankAccountId) ?? 0n;
        const mutation = parseMoneyToMinor(transaction.amount);
        const after = before + (transaction.type === "INFLOW" ? mutation : -mutation);
        runningBalanceByAccount.set(transaction.bankAccountId, after);
        return {
          id: `56565656-5656-5656-5656-${String(565656565601 + index)}`,
          userId: transaction.reconciledById ?? DEMO_IDS.users.finance,
          action: transaction.type === "INFLOW" ? "INFLOW_BANK_ACCOUNT" : "OUTFLOW_BANK_ACCOUNT",
          targetTable: "bank_account",
          targetId: transaction.bankAccountId,
          originalState: JSON.stringify({ balance: formatMinorMoney(before) }),
          newState: JSON.stringify({
            balance: formatMinorMoney(after),
            cashTransactionId: transaction.id,
            amount: transaction.amount,
            referenceType: transaction.referenceType,
            referenceId: transaction.referenceId,
          }),
          ipAddress: "127.0.0.1",
          userAgent: "Atria ERP connected demo seed",
          createdAt: transaction.createdAt,
        };
      });
    await tx.insert(auditLog).values(balanceAuditEvents);

    const operationalAuditEvents = [
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "POST_INVENTORY_OPENING",
        targetTable: "inventory_opening_batch",
        targetId: "95959595-9595-9595-9595-959595959501",
      },
      {
        userId: "33333333-3333-3333-3333-333333333333",
        action: "POST_GOODS_RECEIPT",
        targetTable: "goods_receipt",
        targetId: "61616161-6161-6161-6161-616161616101",
      },
      {
        userId: "33333333-3333-3333-3333-333333333333",
        action: "POST_GOODS_RECEIPT",
        targetTable: "goods_receipt",
        targetId: "61616161-6161-6161-6161-616161616102",
      },
      {
        userId: "33333333-3333-3333-3333-333333333333",
        action: "POST_STOCK_TRANSFER",
        targetTable: "stock_transfer",
        targetId: "71717171-7171-7171-7171-717171717101",
      },
      {
        userId: "33333333-3333-3333-3333-333333333333",
        action: "POST_STOCK_TRANSFER",
        targetTable: "stock_transfer",
        targetId: "71717171-7171-7171-7171-717171717102",
      },
      {
        userId: "11111111-1111-1111-1111-111111111111",
        action: "POST_STOCK_COUNT",
        targetTable: "stock_count",
        targetId: "81818181-8181-8181-8181-818181818101",
      },
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "COMPLETE_VENDOR_PAYMENT",
        targetTable: "vendor_payment",
        targetId: "34043404-3404-3404-3404-340434043403",
      },
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "COMPLETE_VENDOR_PAYMENT",
        targetTable: "vendor_payment",
        targetId: "34043404-3404-3404-3404-340434043404",
      },
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "PAY_PROJECT_COST",
        targetTable: "project_cost",
        targetId: cost5Id,
      },
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "PAY_PROJECT_COST",
        targetTable: "project_cost",
        targetId: cost6Id,
      },
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "TRANSFER_BANK_BALANCE",
        targetTable: "bank_account",
        targetId: "66666666-6666-6666-6666-666666666662",
      },
      {
        userId: "22222222-2222-2222-2222-222222222222",
        action: "SET_OPENING_BALANCE",
        targetTable: "bank_account",
        targetId: "66666666-6666-6666-6666-666666666664",
      },
      {
        userId: "33333333-3333-3333-3333-333333333331",
        action: "RECORD_STOCK_USAGE",
        targetTable: "stock_movement",
        targetId: "18181818-1818-1818-1818-181818181803",
      },
      {
        userId: "33333333-3333-3333-3333-333333333331",
        action: "RECORD_STOCK_WASTE",
        targetTable: "stock_movement",
        targetId: "18181818-1818-1818-1818-181818181805",
      },
      {
        userId: "33333333-3333-3333-3333-333333333331",
        action: "RECORD_STOCK_RETURN",
        targetTable: "stock_movement",
        targetId: "18181818-1818-1818-1818-181818181806",
      },
      {
        userId: "33333333-3333-3333-3333-333333333333",
        action: "ADJUST_STOCK",
        targetTable: "stock_movement",
        targetId: "18181818-1818-1818-1818-181818181804",
      },
    ];

    await tx.insert(auditLog).values(
      operationalAuditEvents.map((event, index) => ({
        id: `99099909-9909-9909-9909-${String(990999099903 + index)}`,
        ...event,
        originalState: JSON.stringify({ recorded: false }),
        newState: JSON.stringify({ recorded: true, source: "CONNECTED_DEMO_HISTORY" }),
        ipAddress: "127.0.0.1",
        userAgent: "Atria ERP database seed",
      })),
    );

    // Seed ditanam sesudah migrasi backfill 0032. Bekukan keputusan approval
    // pada fixture juga, sesuai nominal/overrun dan riwayat persetujuannya.
    const seededApprovals = await tx.select().from(approval);
    for (const cost of await tx.select().from(projectCost)) {
      await tx
        .update(projectCost)
        .set({
          requiresOwnerApproval:
            parseMoneyToMinor(cost.amount) >= DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS ||
            cost.budgetOverrun ||
            seededApprovals.some(
              (row) => row.referenceType === "project_cost" && row.referenceId === cost.id,
            ),
        })
        .where(eq(projectCost.id, cost.id));
    }
    for (const payment of await tx.select().from(vendorPayment)) {
      await tx
        .update(vendorPayment)
        .set({
          requiresOwnerApproval:
            parseMoneyToMinor(payment.amountPaid) >= DEFAULT_OWNER_APPROVAL_THRESHOLD_CENTS ||
            seededApprovals.some(
              (row) => row.referenceType === "vendor_payment" && row.referenceId === payment.id,
            ),
        })
        .where(eq(vendorPayment.id, payment.id));
    }

    console.log("Validating financial, stock, workflow, and project-scope invariants...");
    const accountsForValidation = await tx.select().from(bankAccount);
    const cashTransactionsForValidation = await tx.select().from(cashTransaction);
    const statementImportsForValidation = await tx.select().from(bankStatementImport);
    const statementRowsForValidation = await tx.select().from(bankStatementRow);
    const inventoriesForValidation = await tx.select().from(materialInventory);
    const movementsForValidation = await tx.select().from(stockMovement);
    const openingBatchesForValidation = await tx.select().from(inventoryOpeningBatch);
    const openingItemsForValidation = await tx.select().from(inventoryOpeningItem);
    const vendorPaymentsForValidation = await tx.select().from(vendorPayment);
    const clientInvoicesForValidation = await tx.select().from(clientInvoice);
    const clientPaymentsForValidation = await tx.select().from(clientPayment);
    const projectCostsForValidation = await tx.select().from(projectCost);
    const receiptsForValidation = await tx.select().from(goodsReceipt);
    const receiptItemsForValidation = await tx.select().from(goodsReceiptItem);
    const transfersForValidation = await tx.select().from(stockTransfer);
    const transferItemsForValidation = await tx.select().from(stockTransferItem);
    const countsForValidation = await tx.select().from(stockCount);
    const countItemsForValidation = await tx.select().from(stockCountItem);
    const budgetsForValidation = await tx.select().from(projectBudgets);
    const categoriesForValidation = await tx.select().from(projectBudgetCategory);
    const planItemsForValidation = await tx.select().from(projectCategoryPlanItem);
    const expensesForValidation = await tx.select().from(projectExpenses);
    const billsForValidation = await tx.select().from(vendorBill);
    const projectsForValidation = await tx.select().from(project);
    const approvalsForValidation = await tx.select().from(approval);
    const auditsForValidation = await tx.select().from(auditLog);
    const snapshotsForValidation = await tx.select().from(projectProfitabilitySnapshot);
    const rabsForValidation = await tx.select().from(rabEstimate);

    for (const accountRow of accountsForValidation) {
      const calculatedBalance = cashTransactionsForValidation
        .filter((row) => row.bankAccountId === accountRow.id)
        .reduce(
          (sum, row) =>
            sum +
            (row.type === "INFLOW"
              ? parseMoneyToMinor(row.amount)
              : -parseMoneyToMinor(row.amount)),
          0n,
        );
      assertSeedInvariant(
        calculatedBalance === parseMoneyToMinor(accountRow.balance),
        `bank balance ${accountRow.name} does not reconcile with cash transactions`,
      );
    }

    const statementImportById = new Map(statementImportsForValidation.map((row) => [row.id, row]));
    const cashTransactionById = new Map(cashTransactionsForValidation.map((row) => [row.id, row]));
    for (const transaction of cashTransactionsForValidation) {
      const matchedRows = statementRowsForValidation.filter(
        (row) => row.matchedCashTransactionId === transaction.id,
      );
      if (transaction.reconciled) {
        assertSeedInvariant(
          transaction.reconciliationDate !== null && transaction.reconciledById !== null,
          `reconciled cash transaction ${transaction.id} is missing reconciliation evidence`,
        );
        assertSeedInvariant(
          matchedRows.length === 1 && matchedRows[0]?.isReconciled === true,
          `reconciled cash transaction ${transaction.id} must have exactly one matched statement row`,
        );
        assertSeedInvariant(
          transaction.reconciliationExceptionReason === null &&
            transaction.reconciliationExceptionAt === null &&
            transaction.reconciliationExceptionById === null,
          `reconciled cash transaction ${transaction.id} must not retain a current exception`,
        );
      } else {
        assertSeedInvariant(
          transaction.reconciliationDate === null && transaction.reconciledById === null,
          `unreconciled cash transaction ${transaction.id} has reconciliation evidence`,
        );
        assertSeedInvariant(
          matchedRows.length === 0,
          `unreconciled cash transaction ${transaction.id} is already linked to a statement row`,
        );
        const exceptionEvidence = [
          transaction.reconciliationExceptionReason,
          transaction.reconciliationExceptionAt,
          transaction.reconciliationExceptionById,
        ];
        assertSeedInvariant(
          exceptionEvidence.every((value) => value === null) ||
            exceptionEvidence.every((value) => value !== null),
          `unreconciled cash transaction ${transaction.id} has incomplete exception evidence`,
        );
      }
    }

    for (const statementRow of statementRowsForValidation) {
      assertSeedInvariant(
        statementRow.isReconciled === (statementRow.matchedCashTransactionId !== null),
        `statement row ${statementRow.id} has inconsistent reconciliation state`,
      );
      if (!statementRow.matchedCashTransactionId) continue;
      const transaction = cashTransactionById.get(statementRow.matchedCashTransactionId);
      const statementImport = statementImportById.get(statementRow.importId);
      assertSeedInvariant(
        transaction !== undefined && statementImport !== undefined,
        `statement row ${statementRow.id} is missing its cash transaction or import`,
      );
      assertSeedInvariant(
        transaction.reconciled &&
          transaction.bankAccountId === statementImport.bankAccountId &&
          transaction.type === statementRow.type &&
          parseMoneyToMinor(transaction.amount) === parseMoneyToMinor(statementRow.amount),
        `statement row ${statementRow.id} does not exactly match its cash transaction`,
      );
    }

    const importAccountById = new Map(
      statementImportsForValidation.map((statementImport) => [
        statementImport.id,
        statementImport.bankAccountId,
      ]),
    );
    for (const transaction of cashTransactionsForValidation.filter((row) => !row.reconciled)) {
      const candidates = statementRowsForValidation.filter(
        (row) =>
          !row.isReconciled &&
          importAccountById.get(row.importId) === transaction.bankAccountId &&
          row.type === transaction.type &&
          parseMoneyToMinor(row.amount) === parseMoneyToMinor(transaction.amount),
      );
      assertSeedInvariant(
        candidates.length === 1,
        `open cash transaction ${transaction.id} must have exactly one statement candidate`,
      );
    }
    for (const statementRow of statementRowsForValidation.filter((row) => !row.isReconciled)) {
      const candidates = cashTransactionsForValidation.filter(
        (transaction) =>
          !transaction.reconciled &&
          transaction.bankAccountId === importAccountById.get(statementRow.importId) &&
          transaction.type === statementRow.type &&
          parseMoneyToMinor(transaction.amount) === parseMoneyToMinor(statementRow.amount),
      );
      assertSeedInvariant(
        candidates.length === 1,
        `open statement row ${statementRow.id} must have exactly one cash candidate`,
      );
    }

    for (const invoice of clientInvoicesForValidation) {
      const totalPaid = clientPaymentsForValidation
        .filter((payment) => payment.clientInvoiceId === invoice.id)
        .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
      const invoiceAmount = parseMoneyToMinor(invoice.amount);
      assertSeedInvariant(
        totalPaid <= invoiceAmount,
        `invoice ${invoice.invoiceNumber} is overpaid`,
      );
      const expectedStatus =
        totalPaid === 0n ? "UNPAID" : totalPaid === invoiceAmount ? "PAID" : "PARTIALLY_PAID";
      assertSeedInvariant(
        invoice.status === expectedStatus,
        `invoice ${invoice.invoiceNumber} status does not match its payment aggregate`,
      );
    }

    for (const bill of billsForValidation) {
      const payments = vendorPaymentsForValidation.filter(
        (payment) => payment.vendorBillId === bill.id,
      );
      const completed = payments
        .filter((payment) => payment.status === "COMPLETED")
        .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
      const committed = payments
        .filter((payment) => payment.status === "PENDING" || payment.status === "COMPLETED")
        .reduce((sum, payment) => sum + parseMoneyToMinor(payment.amountPaid), 0n);
      const billAmount = parseMoneyToMinor(bill.amount);
      assertSeedInvariant(
        committed <= billAmount,
        `vendor bill ${bill.billNumber} is overcommitted`,
      );
      const expectedStatus =
        completed === 0n ? "UNPAID" : completed === billAmount ? "PAID" : "PARTIALLY_PAID";
      assertSeedInvariant(
        bill.status === expectedStatus,
        `vendor bill ${bill.billNumber} status does not match completed payments`,
      );
    }

    const transferRows = cashTransactionsForValidation.filter(
      (row) =>
        row.referenceType === "bank_transfer" && row.referenceId === DEMO_IDS.internalTransfer,
    );
    assertSeedInvariant(
      transferRows.length === 2 &&
        transferRows[0]?.bankAccountId !== transferRows[1]?.bankAccountId &&
        transferRows.some((row) => row.type === "INFLOW") &&
        transferRows.some((row) => row.type === "OUTFLOW") &&
        transferRows.every(
          (row) =>
            parseMoneyToMinor(row.amount) === parseMoneyToMinor(transferRows[0]?.amount ?? "0"),
        ),
      "seeded bank transfer must be a balanced pair with one shared reference",
    );

    for (const transaction of cashTransactionsForValidation) {
      assertSeedInvariant(
        auditsForValidation.some(
          (audit) =>
            audit.targetTable === "bank_account" &&
            audit.targetId === transaction.bankAccountId &&
            audit.newState?.includes(transaction.id),
        ),
        `cash transaction ${transaction.id} is missing balance audit evidence`,
      );
    }

    for (const inventoryRow of inventoriesForValidation) {
      const calculatedStock = movementsForValidation
        .filter(
          (row) =>
            row.materialId === inventoryRow.materialId &&
            row.inventoryLocationId === inventoryRow.locationId,
        )
        .reduce((sum, row) => {
          if (row.movementDirection === "IN") return sum + parseMoneyToMinor(row.quantity);
          if (row.movementDirection === "OUT") return sum - parseMoneyToMinor(row.quantity);
          return sum;
        }, 0n);
      assertSeedInvariant(
        calculatedStock === parseMoneyToMinor(inventoryRow.currentStock),
        `inventory ${inventoryRow.id} does not reconcile with stock movements`,
      );
    }

    for (const batch of openingBatchesForValidation) {
      const items = openingItemsForValidation.filter((item) => item.batchId === batch.id);
      assertSeedInvariant(items.length > 0, `opening batch ${batch.batchNumber} has no items`);
      if (batch.status === "POSTED") {
        assertSeedInvariant(
          batch.requestedById !== batch.approvedById,
          `posted opening batch ${batch.batchNumber} violates maker-checker`,
        );
        assertSeedInvariant(
          items.every((item) => item.stockMovementId !== null),
          `posted opening batch ${batch.batchNumber} has an item without stock movement`,
        );
      }
    }

    assertSeedInvariant(
      vendorPaymentsForValidation
        .filter((payment) => payment.status === "COMPLETED")
        .every((payment) => payment.cashTransactionId !== null),
      "completed vendor payment is missing its cash transaction",
    );
    assertSeedInvariant(
      projectCostsForValidation
        .filter((cost) => cost.status === "PAID")
        .every((cost) => cost.bankAccountId !== null && cost.cashTransactionId !== null),
      "paid project cost is missing bank or cash transaction linkage",
    );

    for (const receipt of receiptsForValidation.filter((row) => row.status === "POSTED")) {
      const items = receiptItemsForValidation.filter((item) => item.goodsReceiptId === receipt.id);
      assertSeedInvariant(
        items.length > 0 && items.every((item) => item.stockMovementId !== null),
        `posted goods receipt ${receipt.receiptNumber} is not fully linked to stock movements`,
      );
    }
    for (const transfer of transfersForValidation.filter((row) => row.status === "POSTED")) {
      const items = transferItemsForValidation.filter(
        (item) => item.stockTransferId === transfer.id,
      );
      assertSeedInvariant(
        items.length > 0 &&
          items.every((item) => item.outMovementId !== null && item.inMovementId !== null),
        `posted stock transfer ${transfer.transferNumber} is missing movement linkage`,
      );
    }
    for (const count of countsForValidation.filter((row) => row.status === "POSTED")) {
      const varianceItems = countItemsForValidation.filter(
        (item) => item.stockCountId === count.id && parseMoneyToMinor(item.varianceQuantity) !== 0n,
      );
      assertSeedInvariant(
        varianceItems.every((item) => item.stockMovementId !== null),
        `posted stock count ${count.countNumber} has an unposted variance`,
      );
    }

    const budgetById = new Map(budgetsForValidation.map((row) => [row.id, row]));
    const categoryById = new Map(categoriesForValidation.map((row) => [row.id, row]));
    for (const planItem of planItemsForValidation) {
      const budgetRow = budgetById.get(planItem.projectBudgetId);
      const categoryRow = categoryById.get(planItem.projectBudgetCategoryId);
      assertSeedInvariant(
        budgetRow?.projectId === planItem.projectId &&
          categoryRow?.projectBudgetId === planItem.projectBudgetId &&
          categoryRow.expenseCategoryId === planItem.expenseCategoryId,
        `category plan item ${planItem.id} has cross-project or cross-category linkage`,
      );
    }
    for (const expense of expensesForValidation) {
      const budgetRow = budgetById.get(expense.projectBudgetId);
      const categoryRow = categoryById.get(expense.projectBudgetCategoryId);
      assertSeedInvariant(
        budgetRow?.projectId === expense.projectId &&
          categoryRow?.projectBudgetId === expense.projectBudgetId &&
          categoryRow.expenseCategoryId === expense.expenseCategoryId,
        `canonical expense ${expense.id} has cross-project or cross-category linkage`,
      );
      assertSeedInvariant(
        (parseMoneyToMinor(expense.quantity) * parseMoneyToMinor(expense.unitCost)) / 100n ===
          parseMoneyToMinor(expense.amount),
        `canonical expense ${expense.id} quantity and unit cost do not equal amount`,
      );
      if (expense.legacyProjectCostId) {
        const legacy = projectCostsForValidation.find(
          (cost) => cost.id === expense.legacyProjectCostId,
        );
        assertSeedInvariant(
          legacy !== undefined &&
            legacy.projectId === expense.projectId &&
            legacy.projectBudgetCategoryId === expense.projectBudgetCategoryId &&
            legacy.status === expense.status &&
            parseMoneyToMinor(legacy.quantity) === parseMoneyToMinor(expense.quantity) &&
            parseMoneyToMinor(legacy.unitPrice) === parseMoneyToMinor(expense.unitCost) &&
            parseMoneyToMinor(legacy.amount) === parseMoneyToMinor(expense.amount),
          `canonical expense ${expense.id} drifted from legacy project cost`,
        );
      }
    }
    for (const cost of projectCostsForValidation) {
      const categoryRow = categoryById.get(cost.projectBudgetCategoryId);
      const budgetRow = categoryRow ? budgetById.get(categoryRow.projectBudgetId) : undefined;
      assertSeedInvariant(
        budgetRow?.projectId === cost.projectId,
        `project cost ${cost.id} is linked to another project's budget category`,
      );
      assertSeedInvariant(
        (parseMoneyToMinor(cost.quantity) * parseMoneyToMinor(cost.unitPrice)) / 100n ===
          parseMoneyToMinor(cost.amount),
        `project cost ${cost.id} quantity and unit price do not equal amount`,
      );
    }
    for (const bill of billsForValidation) {
      const categoryRow = categoryById.get(bill.projectBudgetCategoryId);
      const budgetRow = categoryRow ? budgetById.get(categoryRow.projectBudgetId) : undefined;
      assertSeedInvariant(
        budgetRow?.projectId === bill.projectId,
        `vendor bill ${bill.billNumber} is linked to another project's budget category`,
      );
    }

    const smallVendorApproval = approvalsForValidation.find(
      (row) =>
        row.referenceType === "vendor_payment" &&
        row.referenceId === "34043404-3404-3404-3404-340434043401",
    );
    const largeVendorApproval = approvalsForValidation.find(
      (row) =>
        row.referenceType === "vendor_payment" &&
        row.referenceId === "34043404-3404-3404-3404-340434043402",
    );
    assertSeedInvariant(
      smallVendorApproval === undefined && largeVendorApproval?.status === "PENDING",
      "vendor approval threshold scenarios are not represented correctly",
    );

    const mentengSnapshot = snapshotsForValidation.find(
      (row) => row.projectId === DEMO_IDS.projects.menteng,
    );
    const mentengBudget = budgetsForValidation.find(
      (row) => row.projectId === DEMO_IDS.projects.menteng,
    );
    const mentengSnapshotActual = categoriesForValidation
      .filter((row) => row.projectBudgetId === mentengBudget?.id)
      .reduce((sum, row) => sum + parseMoneyToMinor(row.actualAmount), 0n);
    assertSeedInvariant(
      mentengSnapshot !== undefined &&
        parseMoneyToMinor(mentengSnapshot.actualCost) === mentengSnapshotActual,
      "Menteng profitability snapshot does not match category detail",
    );

    const senopatiBudget = budgetsForValidation.find(
      (row) => row.projectId === DEMO_IDS.projects.senopati,
    );
    const senopatiProject = projectsForValidation.find(
      (row) => row.id === DEMO_IDS.projects.senopati,
    );
    const senopatiInvoices = clientInvoicesForValidation.filter(
      (row) => row.projectId === DEMO_IDS.projects.senopati,
    );
    const senopatiInvoiceTotal = senopatiInvoices.reduce(
      (sum, row) => sum + parseMoneyToMinor(row.amount),
      0n,
    );
    const senopatiPaymentCashIds = clientPaymentsForValidation
      .filter((payment) =>
        senopatiInvoices.some((invoice) => invoice.id === payment.clientInvoiceId),
      )
      .map((payment) => payment.cashTransactionId);
    assertSeedInvariant(
      senopatiProject?.status === "ACTIVE" &&
        senopatiBudget?.status === "APPROVED" &&
        rabsForValidation.filter(
          (row) => row.projectId === DEMO_IDS.projects.senopati && row.status === "APPROVED",
        ).length === 1 &&
        senopatiInvoices.every((row) => row.status === "PAID") &&
        senopatiInvoiceTotal === parseMoneyToMinor(senopatiProject.totalContractValue) &&
        billsForValidation.every((row) => row.projectId !== DEMO_IDS.projects.senopati) &&
        projectCostsForValidation.every((row) => row.projectId !== DEMO_IDS.projects.senopati) &&
        expensesForValidation.every((row) => row.projectId !== DEMO_IDS.projects.senopati) &&
        movementsForValidation.every((row) => row.projectId !== DEMO_IDS.projects.senopati) &&
        senopatiPaymentCashIds.every(
          (cashId) => cashTransactionById.get(cashId)?.reconciled === true,
        ),
      "Senopati closing sandbox is not financially ready",
    );
    console.log("Seed invariants passed.");
  });

  await writeDemoFixtures();
  console.log("Connected demo database seeding executed successfully!");
  console.log("Test login credentials:");
  console.log("- Ronald (Owner): ronald@dekoria.com / password123");
  console.log("- Lisa (Finance Admin): lisa@dekoria.com / password123");
  console.log("- Budi (PM): budi@dekoria.com / password123");
  console.log("- Siti (PM): siti@dekoria.com / password123");
  console.log("- Agus (Purchasing): agus@dekoria.com / password123");
}

if (import.meta.main) {
  seedDemoDatabase().catch((err: unknown) => {
    console.error("Seeding failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
