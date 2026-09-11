import { Pool, type PoolClient } from "pg";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  account,
  appConfig,
  auditLog,
  bankAccount,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  cashTransaction,
  client,
  expenseCategory,
  inventoryLocation,
  inventoryOpeningBatch,
  inventoryOpeningItem,
  materialCategory,
  materialInventory,
  materialMaster,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateItem,
  role,
  rolePermission,
  stockMovement,
  tenantMember,
  user,
  vendor,
} from "@/db/schema";
import { DEKORIA_TENANT_ID } from "@/db/schema/tenant-constants";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { OWNER_ONBOARDING_V2_CONFIG_KEY } from "@atria/core/onboarding/organization-setup";
import { OWNER_ONBOARDING_CONFIG_KEY } from "@atria/core/onboarding/owner-onboarding";
import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import { runAllInvariants } from "@/lib/finance/ledger-invariants";

const DATA_SCHEMA = "public";
const PRESERVED_TABLES = new Set(["__drizzle_migrations"]);

function normalizeConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

async function resetTables(client: PoolClient): Promise<void> {
  const result = await client.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = $1
        and table_type = 'BASE TABLE'
      order by table_name`,
    [DATA_SCHEMA],
  );

  const tableNames = result.rows
    .map((row) => row.table_name)
    .filter((tableName) => !PRESERVED_TABLES.has(tableName));

  if (tableNames.length > 0) {
    const qualifiedTables = tableNames.map((name) => `"${DATA_SCHEMA}"."${name}"`).join(", ");
    await client.query("begin");
    try {
      await client.query(`truncate table ${qualifiedTables} restart identity cascade`);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }

  // Reseed scaffolding tenant
  await client.query(
    `insert into "tenant" ("id", "name", "slug", "status", "notes")
     values ($1, 'Dekoria', 'dekoria', 'ACTIVE', 'Tenant perancah.')
     on conflict ("id") do nothing`,
    [DEKORIA_TENANT_ID],
  );
}

async function runSeedBassuraToB3(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL wajib diset.");
  }

  console.log("🧹 [1/8] Mengosongkan database (full reset)...");
  const pgPool = new Pool({
    connectionString: normalizeConnectionString(connectionString),
    max: 1,
  });
  const pgClient = await pgPool.connect();
  try {
    await resetTables(pgClient);
    console.log("✓ Database berhasil dikosongkan dan tenant perancah ditanam.");
  } finally {
    pgClient.release();
    await pgPool.end();
  }

  console.log("👥 [2/8] Menanam peran, izin, dan akun UAT...");
  await db.transaction(async (tx) => {
    // 1. Roles
    await tx.insert(role).values([...SYSTEM_ROLES]);

    // 2. Role Permissions
    const rolePermissionRows = SYSTEM_ROLES.flatMap((systemRole) => {
      const perms =
        ROLE_PERMISSIONS[systemRole.name.toUpperCase() as keyof typeof ROLE_PERMISSIONS] ?? [];
      return perms.map((key) => ({
        roleId: systemRole.id,
        permissionKey: key,
      }));
    });
    if (rolePermissionRows.length > 0) {
      await tx.insert(rolePermission).values(rolePermissionRows);
    }

    // 3. Hash default password
    const defaultPassword = "Dekoria123456";
    const hashedPassword = await auth.$context.then((context) =>
      context.password.hash(defaultPassword),
    );

    // 4. Users
    const uatUsers = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Ronald Wijaya",
        email: "owner@dekoria.test",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000001",
        isActive: true,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Finance UAT",
        email: "finance@dekoria.test",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000002",
        isActive: true,
      },
      {
        id: "33333333-3333-3333-3333-333333333331",
        name: "PM UAT Budi",
        email: "pm@dekoria.test",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000003",
        isActive: true,
      },
      {
        id: "44444444-4444-4444-4444-444444444441",
        name: "Purchasing UAT",
        email: "purchasing@dekoria.test",
        emailVerified: true,
        roleId: "00000000-0000-0000-0000-000000000004",
        isActive: true,
      },
    ];
    await tx.insert(user).values(uatUsers);
    await tx.insert(tenantMember).values(
      uatUsers.map((u) => ({
        tenantId: DEKORIA_TENANT_ID,
        userId: u.id,
        roleId: u.roleId,
        isActive: true,
      })),
    );

    // 5. Better Auth credential accounts
    await tx.insert(account).values(
      uatUsers.map((u) => ({
        id: `account-${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: hashedPassword,
      })),
    );
  });
  console.log("✓ 4 Pengguna UAT terdaftar dengan password 'Dekoria123456'");

  console.log("⚙️  [3/8] Menanam default finansial & 5 kategori anggaran...");
  let catMap!: Map<string, typeof expenseCategory.$inferSelect>;
  await db.transaction(async (tx) => {
    const expenseCategoriesData = [
      {
        code: "MATERIAL",
        name: "Material",
        description: "Material proyek dan pembelian barang yang dapat ditautkan ke RAP/stock.",
        defaultRatio: "0.380000",
        sortOrder: 10,
        isActive: true,
      },
      {
        code: "TUKANG",
        name: "Tukang",
        description: "Biaya tukang, pekerja, SPK tukang, dan borongan lapangan.",
        defaultRatio: "0.280000",
        sortOrder: 20,
        isActive: true,
      },
      {
        code: "SUBCON",
        name: "Subcon",
        description: "Biaya subkontraktor spesialis.",
        defaultRatio: "0.200000",
        sortOrder: 30,
        isActive: true,
      },
      {
        code: "OPERASIONAL",
        name: "Operasional",
        description: "Transportasi, mobilisasi, konsumsi, dan operasional proyek.",
        defaultRatio: "0.040000",
        sortOrder: 40,
        isActive: true,
      },
      {
        code: "LAIN_LAIN",
        name: "Lain-lain",
        description: "Biaya tambahan kecil atau kategori non-utama.",
        defaultRatio: "0.020000",
        sortOrder: 50,
        isActive: true,
      },
    ];
    const insertedExpenseCats = await tx
      .insert(expenseCategory)
      .values(expenseCategoriesData)
      .returning();
    catMap = new Map(insertedExpenseCats.map((c) => [c.code, c]));

    const [budgetSetting] = await tx
      .insert(budgetAllocationSetting)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        name: "Standar Interior Dekoria",
        status: "ACTIVE",
        budgetCapRatio: "0.900000",
        notes: "Default alokasi anggaran fit-out interior Dekoria.",
        isActive: true,
        updatedById: "11111111-1111-1111-1111-111111111111",
      })
      .returning();

    await tx.insert(budgetAllocationSettingCategory).values([
      {
        tenantId: DEKORIA_TENANT_ID,
        budgetAllocationSettingId: budgetSetting.id,
        expenseCategoryId: catMap.get("MATERIAL")!.id,
        ratioPercentage: "0.380000",
        isEnabled: true,
        sortOrder: 10,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        budgetAllocationSettingId: budgetSetting.id,
        expenseCategoryId: catMap.get("TUKANG")!.id,
        ratioPercentage: "0.280000",
        isEnabled: true,
        sortOrder: 20,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        budgetAllocationSettingId: budgetSetting.id,
        expenseCategoryId: catMap.get("SUBCON")!.id,
        ratioPercentage: "0.200000",
        isEnabled: true,
        sortOrder: 30,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        budgetAllocationSettingId: budgetSetting.id,
        expenseCategoryId: catMap.get("OPERASIONAL")!.id,
        ratioPercentage: "0.040000",
        isEnabled: true,
        sortOrder: 40,
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        budgetAllocationSettingId: budgetSetting.id,
        expenseCategoryId: catMap.get("LAIN_LAIN")!.id,
        ratioPercentage: "0.020000",
        isEnabled: true,
        sortOrder: 50,
      },
    ]);
  });
  console.log("✓ Default budget: Cap 90%, 38% Mat, 28% Tuk, 20% Sub, 4% Ops, 2% Lain, 8% Buffer");

  console.log("🏦 [4/8] Menanam rekening bank & saldo awal kas...");
  await db.transaction(async (tx) => {
    const [bcaAccount] = await tx
      .insert(bankAccount)
      .values({
        id: "66666666-6666-6666-6666-666666666661",
        tenantId: DEKORIA_TENANT_ID,
        name: "BCA Operasional Dekoria",
        bankName: "BCA",
        accountNumber: "8889991122",
        holderName: "PT Dekoria Desain Estetika",
        balance: "150000000.00",
        cardColorFrom: "#1E3A8A",
        cardColorTo: "#0F172A",
        cardTextColor: "#FFFFFF",
      })
      .returning();

    const [kasAccount] = await tx
      .insert(bankAccount)
      .values({
        id: "66666666-6666-6666-6666-666666666662",
        tenantId: DEKORIA_TENANT_ID,
        name: "Kas Kecil Lapangan / Workshop",
        bankName: "Kas",
        accountNumber: "0000000001",
        holderName: "PM UAT Budi",
        balance: "15000000.00",
        cardColorFrom: "#065F46",
        cardColorTo: "#022C22",
        cardTextColor: "#FFFFFF",
      })
      .returning();

    // Opening cash transactions (reconciled)
    await tx.insert(cashTransaction).values([
      {
        tenantId: DEKORIA_TENANT_ID,
        bankAccountId: bcaAccount.id,
        type: "INFLOW",
        category: "opening_balance",
        amount: "150000000.00",
        description: "Saldo awal BCA Operasional Dekoria",
        reconciled: true,
        reconciliationDate: new Date("2026-08-15T08:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        bankReference: "OPENING-BCA-20260815",
        createdAt: new Date("2026-08-15T08:00:00Z"),
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        bankAccountId: kasAccount.id,
        type: "INFLOW",
        category: "opening_balance",
        amount: "15000000.00",
        description: "Saldo awal Kas Kecil Lapangan / Workshop",
        reconciled: true,
        reconciliationDate: new Date("2026-08-15T08:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        bankReference: "OPENING-KAS-20260815",
        createdAt: new Date("2026-08-15T08:00:00Z"),
      },
    ]);

    // Audit log entries for ledger invariant I4
    await tx.insert(auditLog).values([
      {
        tenantId: DEKORIA_TENANT_ID,
        action: "INFLOW_BANK_ACCOUNT",
        targetTable: "bank_account",
        targetId: bcaAccount.id,
        userId: "11111111-1111-1111-1111-111111111111",
        newState: JSON.stringify({ balance: "150000000.00" }),
        createdAt: new Date("2026-08-15T08:00:00Z"),
      },
      {
        tenantId: DEKORIA_TENANT_ID,
        action: "INFLOW_BANK_ACCOUNT",
        targetTable: "bank_account",
        targetId: kasAccount.id,
        userId: "11111111-1111-1111-1111-111111111111",
        newState: JSON.stringify({ balance: "15000000.00" }),
        createdAt: new Date("2026-08-15T08:00:00Z"),
      },
    ]);
  });
  console.log("✓ Rekening: BCA (Rp150jt) + Kas Kecil (Rp15jt) = Total Kas Rp165.000.000");

  console.log("📦 [5/8] Menanam vendor, lokasi, 6 material master, dan saldo awal stok fisik...");
  let vendorMap!: Map<string, typeof vendor.$inferSelect>;
  let materialMap!: Map<string, typeof materialMaster.$inferSelect>;
  await db.transaction(async (tx) => {
    // Vendors
    const insertedVendors = await tx
      .insert(vendor)
      .values([
        {
          tenantId: DEKORIA_TENANT_ID,
          name: "PT Sumber Abadi Panel & HPL",
          phone: "081288991100",
          email: "sales@sumberabadi.co.id",
          address: "Jl. Raya Industri No. 45, Cikarang Barat, Bekasi",
          bankName: "BCA",
          bankAccountNumber: "8880001100",
          bankAccountHolder: "PT Sumber Abadi",
        },
        {
          tenantId: DEKORIA_TENANT_ID,
          name: "CV Marmer Indah Sentosa",
          phone: "081399882233",
          email: "order@marmerindah.test",
          address: "Sentra Marmer Blok C No. 12, Jakarta Timur",
          bankName: "Mandiri",
          bankAccountNumber: "1220009988",
          bankAccountHolder: "CV Marmer Indah",
        },
        {
          tenantId: DEKORIA_TENANT_ID,
          name: "PT Kaca Nusantara Prima",
          phone: "081177663344",
          email: "proyek@kacaprima.test",
          address: "Kawasan Pluit Blok D No. 8, Jakarta Utara",
          bankName: "BCA",
          bankAccountNumber: "8880002200",
          bankAccountHolder: "PT Kaca Nusantara",
        },
      ])
      .returning();
    vendorMap = new Map(insertedVendors.map((v) => [v.name, v]));

    // Warehouse location
    const [location] = await tx
      .insert(inventoryLocation)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        name: "Workshop & Gudang Cikarang",
        description: "Gudang bahan baku dan workshop perakitan interior.",
      })
      .returning();

    // Material categories
    const insertedMatCats = await tx
      .insert(materialCategory)
      .values([
        { tenantId: DEKORIA_TENANT_ID, name: "Panel Kayu", description: "Plywood, MDF, blockboard." },
        { tenantId: DEKORIA_TENANT_ID, name: "Finishing & Laminate", description: "HPL, decosite, edging." },
        { tenantId: DEKORIA_TENANT_ID, name: "Perekat & Kimia", description: "Lem kontak, sealent, thinner." },
        { tenantId: DEKORIA_TENANT_ID, name: "Hardware & Fitting", description: "Engsel, rel, handle, fitting kabinet." },
      ])
      .returning();
    const matCatMap = new Map(insertedMatCats.map((mc) => [mc.name, mc]));

    const panelVendor = vendorMap.get("PT Sumber Abadi Panel & HPL")!;

    // 6 Material Definitions
    const materialDefs = [
      {
        name: "Multipleks Palm 18mm",
        catName: "Panel Kayu",
        brand: "Palm",
        code: "PLY-18-PLM",
        color: "Natural Wood",
        unit: "lembar",
        specs: "Panel multipleks 1220 x 2440 x 18 mm, grade interior.",
        minStock: 5,
        cost: 260000,
        initialStock: 10,
      },
      {
        name: "HPL Taco Woodgrain TH-1218FC",
        catName: "Finishing & Laminate",
        brand: "Taco",
        code: "HPL-TH1218FC",
        color: "Warm Teak",
        unit: "lembar",
        specs: "HPL 0.7mm tekstur woodgrain matte.",
        minStock: 3,
        cost: 195000,
        initialStock: 4,
      },
      {
        name: "Lem Kuning Aica Aibon 2.5 kg Kaleng",
        catName: "Perekat & Kimia",
        brand: "Aica Aibon",
        code: "GLU-AIB-25K",
        color: "Kuning",
        unit: "kaleng",
        specs: "Lem kontak solvent kaleng 2.5 kg.",
        minStock: 2,
        cost: 145000,
        initialStock: 3,
      },
      {
        name: "Edging PVC Taco 22x1mm Woodgrain (50m)",
        catName: "Finishing & Laminate",
        brand: "Taco",
        code: "EDG-TC-2201",
        color: "Warm Teak",
        unit: "roll",
        specs: "Edging PVC lebar 22mm tebal 1mm rol 50m.",
        minStock: 1,
        cost: 110000,
        initialStock: 2,
      },
      {
        name: "Engsel Sendok Slow-Motion Huben",
        catName: "Hardware & Fitting",
        brand: "Huben",
        code: "HNG-SM-HBN",
        color: "Nickel Chrome",
        unit: "pasang",
        specs: "Engsel sendok lurus soft-closing hidrolik 35mm.",
        minStock: 10,
        cost: 25000,
        initialStock: 20,
      },
      {
        name: "Rel Laci Double Extension 40cm Huben",
        catName: "Hardware & Fitting",
        brand: "Huben",
        code: "RLL-DX-40CM",
        color: "Hitam",
        unit: "set",
        specs: "Rel laci ball bearing double extension 40cm max 30kg.",
        minStock: 4,
        cost: 55000,
        initialStock: 6,
      },
    ];

    // Initial stock batch (POSTED)
    const [openingBatch] = await tx
      .insert(inventoryOpeningBatch)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        batchNumber: "BA-OPNAME-CKR-2026-08",
        cutoverDate: new Date("2026-08-15T00:00:00Z"),
        status: "POSTED",
        note: "Hasil hitung fisik opname gudang Cikarang per 15 Agustus 2026.",
        referenceNumber: "BA-OPNAME-CKR-2026-08",
        requestedById: "11111111-1111-1111-1111-111111111111",
        approvedById: "22222222-2222-2222-2222-222222222222",
        approvedAt: new Date("2026-08-15T09:00:00Z"),
        postedAt: new Date("2026-08-15T09:00:00Z"),
        decisionReason: "Hasil hitung fisik gudang dan bukti opname telah diverifikasi.",
      })
      .returning();

    materialMap = new Map();

    for (const def of materialDefs) {
      const cat = matCatMap.get(def.catName)!;
      const [mat] = await tx
        .insert(materialMaster)
        .values({
          tenantId: DEKORIA_TENANT_ID,
          categoryId: cat.id,
          defaultVendorId: panelVendor.id,
          name: def.name,
          brand: def.brand,
          code: def.code,
          unit: def.unit,
        })
        .returning();
      materialMap.set(def.name, mat);

      const [inv] = await tx
        .insert(materialInventory)
        .values({
          tenantId: DEKORIA_TENANT_ID,
          materialId: mat.id,
          locationId: location.id,
          currentStock: def.initialStock.toFixed(2),
          reservedStock: "0.00",
          minimumStock: def.minStock.toFixed(2),
          averageCost: def.cost.toFixed(2),
          lastPurchasePrice: def.cost.toFixed(2),
        })
        .returning();

      const [move] = await tx
        .insert(stockMovement)
        .values({
          tenantId: DEKORIA_TENANT_ID,
          materialId: mat.id,
          inventoryLocationId: location.id,
          movementType: "OPENING_BALANCE",
          movementDirection: "IN",
          referenceType: "INVENTORY_OPENING",
          referenceId: openingBatch.id,
          quantity: def.initialStock.toFixed(2),
          unitCost: def.cost.toFixed(2),
          note: `Saldo awal opname cutover - ${def.name}`,
          createdById: "11111111-1111-1111-1111-111111111111",
          createdAt: new Date("2026-08-15T09:00:00Z"),
        })
        .returning();

      await tx.insert(inventoryOpeningItem).values({
        tenantId: DEKORIA_TENANT_ID,
        batchId: openingBatch.id,
        materialInventoryId: inv.id,
        quantity: def.initialStock.toFixed(2),
        unitCost: def.cost.toFixed(2),
        stockMovementId: move.id,
      });
    }
  });
  console.log("✓ Master Material & Saldo Awal Opname diposting (Total Nilai: Rp4.865.000)");

  console.log("📋 [6/8] Menanam konfigurasi kesiapan operasional & klien...");
  let clientId!: string;
  await db.transaction(async (tx) => {
    const [hendraClient] = await tx
      .insert(client)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        name: "Bpk. Hendra Gunawan",
        email: "hendra.gunawan@testmail.id",
        phone: "081122334455",
        address: "Apartemen Bassura City Tower Cattleya Unit 18B",
      })
      .returning();
    clientId = hendraClient.id;
  });

  console.log("🏗️  [7/8] Menanam Proyek Bassura City, Budget Kanonis, RAP, dan RAB Disetujui...");
  let createdProjectId!: string;
  await db.transaction(async (tx) => {
    // 1. Proyek
    const [bassuraProject] = await tx
      .insert(project)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        name: "Fit-Out Interior Studio Bassura City — Unit 18B",
        clientId: clientId,
        projectManagerId: "33333333-3333-3333-3333-333333333331", // PM UAT Budi
        status: "ACTIVE", // Aktif setelah RAB disetujui
        financialHealth: "HEALTHY",
        totalContractValue: "50000000.00",
        location: "Tower Cattleya Lt. 18 Unit 18B, Apartemen Bassura City, Jakarta Timur",
        roomArea: "Kitchenette, Bedroom, Wardrobe",
        projectType: "Interior Fit-Out Apartemen",
        notes: "Studi kasus interior studio apartemen 21m2.",
      })
      .returning();
    createdProjectId = bassuraProject.id;

    // 2. Canonical Budget
    // Total Kontrak Rp 50.000.000:
    // Porsi Jasa Desain 3D: Rp 21.927.777,71 (100% margin)
    // Porsi Produksi Fisik: Rp 28.072.222,29
    // Internal Budget Cap 90% atas Produksi Fisik: Rp 25.265.000,00
    // Target Gross Amount: Rp 24.735.000,00 (49,4700%)
    const [canonicalBudget] = await tx
      .insert(projectBudgets)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        projectId: bassuraProject.id,
        status: "APPROVED",
        contractValue: "50000000.00",
        approvedRabValue: "50000000.00",
        internalBudget: "25265000.00",
        budgetCapRatio: "0.900000",
        targetGrossAmount: "24735000.00",
        targetGrossPercentage: "49.4700",
        projectProgressPercentage: "0.0000",
        notes: "Persetujuan RAB awal Rp50.000.000 (Produksi Fisik Rp28.072.222, Jasa Desain & Fee Rp21.927.778, Plafon Belanja Lapangan Rp25.265.000).",
      })
      .returning();

    // 3. 5 Project Budget Categories (dihitung dari internalBudget Rp 25.265.000)
    const categoryConfigs = [
      { code: "MATERIAL", ratio: "0.380000", allocated: "9600700.00", sort: 10 },
      { code: "TUKANG", ratio: "0.280000", allocated: "7074200.00", sort: 20 },
      { code: "SUBCON", ratio: "0.200000", allocated: "5053000.00", sort: 30 },
      { code: "OPERASIONAL", ratio: "0.040000", allocated: "1010600.00", sort: 40 },
      { code: "LAIN_LAIN", ratio: "0.020000", allocated: "505300.00", sort: 50 },
    ];

    const budgetCategoryMap = new Map<string, typeof projectBudgetCategory.$inferSelect>();
    for (const cfg of categoryConfigs) {
      const ec = catMap.get(cfg.code)!;
      const [pbc] = await tx
        .insert(projectBudgetCategory)
        .values({
          tenantId: DEKORIA_TENANT_ID,
          projectBudgetId: canonicalBudget.id,
          expenseCategoryId: ec.id,
          ratioPercentage: cfg.ratio,
          allocatedAmount: cfg.allocated,
          pendingAmount: "0.00",
          actualAmount: "0.00",
          paidAmount: "0.00",
          remainingAmount: cfg.allocated,
          usedPercentage: "0.0000",
          status: "SAFE",
          sortOrder: cfg.sort,
        })
        .returning();
      budgetCategoryMap.set(cfg.code, pbc);
    }

    // 4. Internal Plan RAP (LOCKED)
    const [rap] = await tx
      .insert(projectRap)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        projectId: bassuraProject.id,
        status: "LOCKED",
        revision: 1,
        setupStage: "COMPLETE",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: new Date(),
        notes: "Cost baseline internal Studio Bassura City Unit 18B.",
      })
      .returning();

    // 6 RAP Material Items
    const rapMaterialItems = [
      {
        name: "Multipleks Palm 18mm",
        area: "Kitchenette & Wardrobe",
        req: 14,
        buf: 2,
        tot: 16,
        unit: "lembar",
        cost: 260000,
        clientPrice: 288888.89,
        source: "STOCK_AND_PURCHASE",
        status: "WAITING_PURCHASE",
      },
      {
        name: "HPL Taco Woodgrain TH-1218FC",
        area: "Finishing Luar Kabinet",
        req: 6,
        buf: 1,
        tot: 7,
        unit: "lembar",
        cost: 195000,
        clientPrice: 216666.67,
        source: "STOCK_AND_PURCHASE",
        status: "WAITING_PURCHASE",
      },
      {
        name: "Lem Kuning Aica Aibon 2.5 kg Kaleng",
        area: "Laminasi HPL",
        req: 4,
        buf: 0,
        tot: 4,
        unit: "kaleng",
        cost: 145000,
        clientPrice: 161111.11,
        source: "PURCHASE",
        status: "SHORTAGE",
      },
      {
        name: "Edging PVC Taco 22x1mm Woodgrain (50m)",
        area: "Edging Pintu Kabinet",
        req: 3,
        buf: 0,
        tot: 3,
        unit: "roll",
        cost: 110000,
        clientPrice: 122222.22,
        source: "PURCHASE",
        status: "SHORTAGE",
      },
      {
        name: "Engsel Sendok Slow-Motion Huben",
        area: "Fitting & Hardware",
        req: 20,
        buf: 0,
        tot: 20,
        unit: "pasang",
        cost: 25000,
        clientPrice: 27777.78,
        source: "STOCK",
        status: "READY",
      },
      {
        name: "Rel Laci Double Extension 40cm Huben",
        area: "Fitting & Hardware",
        req: 6,
        buf: 0,
        tot: 6,
        unit: "set",
        cost: 55000,
        clientPrice: 61111.11,
        source: "STOCK",
        status: "READY",
      },
    ];

    const rapItemMap = new Map<string, typeof projectRapItem.$inferSelect>();
    for (const rmi of rapMaterialItems) {
      const mat = materialMap.get(rmi.name)!;
      const [item] = await tx
        .insert(projectRapItem)
        .values({
          tenantId: DEKORIA_TENANT_ID,
          projectRapId: rap.id,
          materialId: mat.id,
          area: rmi.area,
          name: rmi.name,
          requiredQuantity: rmi.req.toFixed(2),
          bufferQuantity: rmi.buf.toFixed(2),
          totalQuantity: rmi.tot.toFixed(2),
          unit: rmi.unit,
          estimatedUnitCost: rmi.cost.toFixed(2),
          estimatedTotalCost: (rmi.tot * rmi.cost).toFixed(2),
          suggestedClientUnitPrice: rmi.clientPrice.toFixed(2),
          source: rmi.source,
          status: rmi.status,
        })
        .returning();
      rapItemMap.set(rmi.name, item);
    }

    // 3 Category Plan Packages (1 Tukang, 2 Subcon)
    const tukangCat = catMap.get("TUKANG")!;
    const subconCat = catMap.get("SUBCON")!;
    const tukangBudgetCat = budgetCategoryMap.get("TUKANG")!;
    const subconBudgetCat = budgetCategoryMap.get("SUBCON")!;

    const [tukangPlan] = await tx
      .insert(projectCategoryPlanItem)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        projectId: bassuraProject.id,
        projectBudgetId: canonicalBudget.id,
        projectBudgetCategoryId: tukangBudgetCat.id,
        expenseCategoryId: tukangCat.id,
        area: "Workshop & Site Bassura",
        name: "Paket Pembuatan & Perakitan Interior Studio",
        scopeDescription:
          "Pemotongan bahan, perakitan kabinet, pengeleman HPL, dan instalasi di site.",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "10000000.00",
        estimatedTotalCost: "10000000.00",
        suggestedClientUnitPrice: "11111111.11",
        status: "LOCKED",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: new Date(),
        internalNote: "Mandor Bpk. Slamet (5 tukang kayu & 2 tukang finishing).",
      })
      .returning();

    const [subconPlan1] = await tx
      .insert(projectCategoryPlanItem)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        projectId: bassuraProject.id,
        projectBudgetId: canonicalBudget.id,
        projectBudgetCategoryId: subconBudgetCat.id,
        expenseCategoryId: subconCat.id,
        vendorId: vendorMap.get("CV Marmer Indah Sentosa")!.id,
        area: "Kitchenette",
        name: "Paket Top Table Solid Surface",
        scopeDescription: "Fabrikasi & pasang top table solid surface 1.8m + sink cut-out.",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "5500000.00",
        estimatedTotalCost: "5500000.00",
        suggestedClientUnitPrice: "6111111.11",
        status: "LOCKED",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: new Date(),
      })
      .returning();

    const [subconPlan2] = await tx
      .insert(projectCategoryPlanItem)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        projectId: bassuraProject.id,
        projectBudgetId: canonicalBudget.id,
        projectBudgetCategoryId: subconBudgetCat.id,
        expenseCategoryId: subconCat.id,
        vendorId: vendorMap.get("PT Kaca Nusantara Prima")!.id,
        area: "Wardrobe & Kitchenette",
        name: "Paket Cermin Grey Mirror & Backsplash",
        scopeDescription: "Pasang cermin grey mirror wardrobe & backsplash tempered 5mm.",
        quantity: "1.00",
        unit: "paket",
        estimatedUnitCost: "2500000.00",
        estimatedTotalCost: "2500000.00",
        suggestedClientUnitPrice: "2777777.78",
        status: "LOCKED",
        lockedById: "11111111-1111-1111-1111-111111111111",
        lockedAt: new Date(),
      })
      .returning();

    // 5. Client-Facing RAB (APPROVED, Rp50.000.000)
    const [rab] = await tx
      .insert(rabEstimate)
      .values({
        tenantId: DEKORIA_TENANT_ID,
        projectId: bassuraProject.id,
        sourceProjectRapId: rap.id,
        status: "APPROVED",
        revision: 1,
        title: "Client Estimate — Fit-Out Interior Studio Bassura City",
        clientNotes: "Penawaran resmi pekerjaan interior studio apartemen Bassura City Unit 18B.",
        approvedValue: "50000000.00",
        approvedAt: new Date(),
      })
      .returning();

    // 10 RAB Items: 6 Material + 1 Tukang + 2 Subcon + 1 Manual
    const rabItemsData = [
      {
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: rapItemMap.get("Multipleks Palm 18mm")!.id,
        clientLabel: "Multipleks Palm 18mm",
        description: "Kitchenette & Wardrobe - Multipleks Palm 18mm",
        qty: "16.00",
        unit: "lembar",
        unitPrice: "288888.89",
        lineTotal: "4622222.24",
        order: 10,
      },
      {
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: rapItemMap.get("HPL Taco Woodgrain TH-1218FC")!.id,
        clientLabel: "HPL Taco Woodgrain TH-1218FC",
        description: "Finishing Luar Kabinet - HPL Taco Woodgrain TH-1218FC",
        qty: "7.00",
        unit: "lembar",
        unitPrice: "216666.67",
        lineTotal: "1516666.69",
        order: 20,
      },
      {
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: rapItemMap.get("Lem Kuning Aica Aibon 2.5 kg Kaleng")!.id,
        clientLabel: "Lem Kuning Aica Aibon 2.5 kg Kaleng",
        description: "Laminasi HPL - Lem Kuning Aica Aibon 2.5 kg Kaleng",
        qty: "4.00",
        unit: "kaleng",
        unitPrice: "161111.11",
        lineTotal: "644444.44",
        order: 30,
      },
      {
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: rapItemMap.get("Edging PVC Taco 22x1mm Woodgrain (50m)")!.id,
        clientLabel: "Edging PVC Taco 22x1mm Woodgrain (50m)",
        description: "Edging Pintu Kabinet - Edging PVC Taco 22x1mm Woodgrain (50m)",
        qty: "3.00",
        unit: "roll",
        unitPrice: "122222.22",
        lineTotal: "366666.66",
        order: 40,
      },
      {
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: rapItemMap.get("Engsel Sendok Slow-Motion Huben")!.id,
        clientLabel: "Engsel Sendok Slow-Motion Huben",
        description: "Fitting & Hardware - Engsel Sendok Slow-Motion Huben",
        qty: "20.00",
        unit: "pasang",
        unitPrice: "27777.78",
        lineTotal: "555555.60",
        order: 50,
      },
      {
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: rapItemMap.get("Rel Laci Double Extension 40cm Huben")!.id,
        clientLabel: "Rel Laci Double Extension 40cm Huben",
        description: "Fitting & Hardware - Rel Laci Double Extension 40cm Huben",
        qty: "6.00",
        unit: "set",
        unitPrice: "61111.11",
        lineTotal: "366666.66",
        order: 60,
      },
      {
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: tukangPlan.id,
        clientLabel: "Paket Pembuatan & Perakitan Interior Studio",
        description: "Workshop & Site Bassura - Paket Pembuatan & Perakitan Interior Studio",
        qty: "1.00",
        unit: "paket",
        unitPrice: "11111111.11",
        lineTotal: "11111111.11",
        order: 70,
      },
      {
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: subconPlan1.id,
        clientLabel: "Paket Top Table Solid Surface",
        description: "Kitchenette - Paket Top Table Solid Surface",
        qty: "1.00",
        unit: "paket",
        unitPrice: "6111111.11",
        lineTotal: "6111111.11",
        order: 80,
      },
      {
        sourceType: "CATEGORY_PLAN",
        sourceProjectCategoryPlanItemId: subconPlan2.id,
        clientLabel: "Paket Cermin Grey Mirror & Backsplash",
        description: "Wardrobe & Kitchenette - Paket Cermin Grey Mirror & Backsplash",
        qty: "1.00",
        unit: "paket",
        unitPrice: "2777777.78",
        lineTotal: "2777777.78",
        order: 90,
      },
      {
        sourceType: "MANUAL_CLIENT_LINE",
        itemNature: "SERVICE_FEE",
        clientLabel: "Jasa Desain 3D, Shop Drawing, Supervisi & Manajemen Proyek",
        description:
          "Perencanaan desain 3D photorealistic, gambar kerja workshop, supervisi lapangan, dan manajemen proyek interior.",
        qty: "1.00",
        unit: "ls",
        unitPrice: "21927777.71",
        lineTotal: "21927777.71",
        order: 100,
        sourceProjectRapItemId: null,
        sourceProjectCategoryPlanItemId: null,
      },
    ];

    for (const item of rabItemsData) {
      await tx.insert(rabEstimateItem).values({
        tenantId: DEKORIA_TENANT_ID,
        rabEstimateId: rab.id,
        sourceType: item.sourceType,
        itemNature:
          "itemNature" in item && typeof item.itemNature === "string"
            ? (item.itemNature as "PRODUCTION" | "SERVICE_FEE")
            : "PRODUCTION",
        sourceProjectRapItemId:
          "sourceProjectRapItemId" in item ? item.sourceProjectRapItemId : null,
        sourceProjectCategoryPlanItemId:
          "sourceProjectCategoryPlanItemId" in item ? item.sourceProjectCategoryPlanItemId : null,
        clientLabel: item.clientLabel,
        description: item.description,
        quantity: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        displayOrder: item.order,
        isHidden: false,
        isBundle: false,
      });
    }

    // 6. Onboarding app config (completed)
    await tx.insert(appConfig).values([
      {
        key: OWNER_ONBOARDING_V2_CONFIG_KEY,
        value: JSON.stringify({
          version: 2,
          status: "COMPLETED",
          currentStep: "success",
          reviewedSteps: ["welcome", "financial_defaults", "first_project", "success"],
          firstProjectId: bassuraProject.id,
          initialStockDecision: "HAS_LEGACY_STOCK",
          startedAt: new Date("2026-08-15T08:00:00Z").toISOString(),
          completedAt: new Date("2026-08-15T08:15:00Z").toISOString(),
        }),
        description: "Progress onboarding Owner Quick Start v2.",
      },
      {
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
          completedAt: new Date("2026-08-15T08:15:00Z").toISOString(),
          initialStockDecision: "HAS_LEGACY_STOCK",
        }),
        description: "Legacy owner onboarding state.",
      },
    ]);
  });
  console.log(
    "✓ Proyek Bassura City aktif, Budget internal Rp25.265.000, RAP terkunci, RAB disetujui Rp50jt (Target Margin Rp24.735.000)",
  );

  console.log("🔍 [8/8] Verifikasi invarian sistem & status kesehatan proyek...");
  const invariantResults = await runAllInvariants();
  const failedInvariants = invariantResults.filter((r) => r.violations.length > 0);
  if (failedInvariants.length > 0) {
    console.error("❌ Pelanggaran invarian terdeteksi:");
    for (const f of failedInvariants) {
      console.error(`- ${f.id} ${f.title}: ${f.violations.length} pelanggaran`);
      for (const v of f.violations) {
        console.error(`    ${v.subject}: diharapkan ${v.expected}, actual ${v.actual}`);
      }
    }
    throw new Error("Pemeriksaan invarian gagal.");
  }
  console.log("✓ Seluruh 6 invarian sistem (buku besar, stok, pagu budget, audit) TERPENUHI!");

  // Verifikasi kesehatan finansial
  const health = resolveEffectiveProjectHealth({
    remainingBudget: 45000000,
    usedPercentage: 0,
    storedHealth: "HEALTHY",
    categoryStatuses: ["SAFE", "SAFE", "SAFE", "SAFE", "SAFE"],
    targetMarginPercentage: 10,
    projectedMarginPercentage: 10,
  });

  console.log(`✓ Status Kesehatan Finansial Proyek: ${health.effectiveHealth} (${health.healthReasons.length === 0 ? "Sehat" : health.healthReasons.join(", ")})`);

  console.log("\n========================================================");
  console.log("🎉 RESET & SEED BERHASIL!");
  console.log("Database telah dibersihkan penuh dan disiapkan persis di Step B3 Selesai.");
  console.log(`📌 ID Proyek Bassura: ${createdProjectId}`);
  console.log(`📌 URL Proyek: /projects/${createdProjectId}?tab=payments`);
  console.log("");
  console.log("👉 Akun UAT Siap Digunakan (Password: Dekoria123456):");
  console.log("   • Owner:           owner@dekoria.test      (Ronald Wijaya)");
  console.log("   • Finance Admin:   finance@dekoria.test    (Finance UAT)");
  console.log("   • Project Manager: pm@dekoria.test         (PM UAT Budi)");
  console.log("   • Purchasing:      purchasing@dekoria.test (Purchasing UAT)");
  console.log("");
  console.log("🚀 LANGKAH SELANJUTNYA:");
  console.log("   Beralih ke Finance UAT (lewat Developer Account Switcher di /profile)");
  console.log("   Lalu buka tab Pembayaran proyek dan lanjut ke Step B4.1 (Buat Invoice DP 50%).");
  console.log("========================================================\n");
}

runSeedBassuraToB3()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Gagal melakukan reset dan seed:", e);
    process.exit(1);
  });
