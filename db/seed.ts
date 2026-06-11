import { db } from "./index";
import {
  role,
  user,
  client,
  vendor,
  bankAccount,
  projectCostCategory,
  project,
  projectBudget,
  projectBudgetItem,
  clientInvoice,
  cashTransaction,
  clientPayment,
  vendorBill,
  vendorPayment,
  projectCost,
  approval,
  aiRun,
  notification,
  auditLog
} from "./schema";

async function main(): Promise<void> {
  console.log("Starting database seeding...");

  await db.transaction(async (tx) => {
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
    ]).onConflictDoNothing();

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
    ]).onConflictDoNothing();

    // 3. Seed Clients
    console.log("Seeding clients...");
    await tx.insert(client).values([
      {
        id: "44444444-4444-4444-4444-444444444441",
        name: "Alexandra Siregar",
        email: "alexandra@siregar.com",
        phone: "081122334455",
        address: "Jl. Teuku Umar No. 12, Menteng, Jakarta Pusat",
      },
      {
        id: "44444444-4444-4444-4444-444444444442",
        name: "Haryanto Wijaya",
        companyName: "PT Sinar Sejahtera",
        email: "haryanto@wijaya.com",
        phone: "081234567890",
        address: "Sudirman Suites Penthouse A, Jakarta Selatan",
      },
    ]).onConflictDoNothing();

    // 4. Seed Vendors
    console.log("Seeding vendors...");
    await tx.insert(vendor).values([
      {
        id: "55555555-5555-5555-5555-555555555551",
        name: "PT Cahaya Abadi Material",
        email: "sales@cahayaabadi.com",
        phone: "021-5551234",
        address: "Kawasan Industri Pulogadung Blok C, Jakarta Timur",
        bankName: "BCA",
        bankAccountNumber: "1234567890",
        bankAccountHolder: "PT Cahaya Abadi Material",
      },
      {
        id: "55555555-5555-5555-5555-555555555552",
        name: "CV Kayu Jati Luhur",
        email: "cvkayujati@gmail.com",
        phone: "081199887766",
        address: "Jl. Raya Jepara No. 45, Jepara, Jawa Tengah",
        bankName: "Mandiri",
        bankAccountNumber: "0987654321",
        bankAccountHolder: "CV Kayu Jati Luhur",
      },
      {
        id: "55555555-5555-5555-5555-555555555553",
        name: "Jasa MEP Pak Slamet",
        email: "slametmep@gmail.com",
        phone: "081333444555",
        address: "Kp. Melayu RT 04/05, Jakarta Selatan",
        bankName: "BCA",
        bankAccountNumber: "5554443322",
        bankAccountHolder: "Slamet Prasetyo",
      },
    ]).onConflictDoNothing();

    // 5. Seed Bank Accounts
    console.log("Seeding bank accounts...");
    await tx.insert(bankAccount).values([
      {
        id: "66666666-6666-6666-6666-666666666661",
        name: "BCA Operational",
        accountNumber: "8889991122",
        bankName: "BCA",
        holderName: "PT Dekoria Desain Estetika",
        balance: "735000000.00",
      },
      {
        id: "66666666-6666-6666-6666-666666666662",
        name: "Mandiri Project",
        accountNumber: "11122233344",
        bankName: "Mandiri",
        holderName: "PT Dekoria Desain Estetika",
        balance: "710000000.00",
      },
      {
        id: "66666666-6666-6666-6666-666666666663",
        name: "Petty Cash Office",
        accountNumber: "9990001112",
        bankName: "BCA",
        holderName: "Lisa Permata (Cashier)",
        balance: "13000000.00",
      },
    ]).onConflictDoNothing();

    // 6. Seed Cost Categories
    console.log("Seeding project cost categories...");
    await tx.insert(projectCostCategory).values([
      {
        id: "99999999-9999-9999-9999-999999999991",
        name: "MATERIAL",
        description: "Pembelian bahan bangunan & material finishing interior",
      },
      {
        id: "99999999-9999-9999-9999-999999999992",
        name: "SUBCONTRACTOR",
        description: "Jasa instalasi khusus & upah tukang subkon luar",
      },
      {
        id: "99999999-9999-9999-9999-999999999993",
        name: "OPERATIONAL",
        description: "Biaya operasional lapangan, bensin, konsumsi, dan koordinasi",
      },
      {
        id: "99999999-9999-9999-9999-999999999994",
        name: "OTHER",
        description: "Biaya tak terduga non-rutin",
      },
    ]).onConflictDoNothing();

    // 7. Seed Projects
    console.log("Seeding projects...");
    await tx.insert(project).values([
      {
        id: "77777777-7777-7777-7777-777777777771",
        name: "Menteng Residence - Luxury Kitchen Remodel",
        clientId: "44444444-4444-4444-4444-444444444441",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "ACTIVE",
        financialHealth: "CRITICAL",
        totalContractValue: "650000000.00",
        startDate: new Date("2026-05-15"),
        endDate: new Date("2026-08-15"),
      },
      {
        id: "77777777-7777-7777-7777-777777777772",
        name: "Sudirman Suites - Penthouse Fit-Out",
        clientId: "44444444-4444-4444-4444-444444444442",
        projectManagerId: "33333333-3333-3333-3333-333333333332",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
        totalContractValue: "1200000000.00",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-10-01"),
      },
    ]).onConflictDoNothing();

    // 8. Seed Budgets
    console.log("Seeding budgets...");
    await tx.insert(projectBudget).values([
      {
        id: "88888888-8888-8888-8888-888888888881",
        projectId: "77777777-7777-7777-7777-777777777771",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-05-14T10:00:00Z"),
        notes: "RAB disetujui Owner dengan target margin 7.6%",
      },
      {
        id: "88888888-8888-8888-8888-888888888882",
        projectId: "77777777-7777-7777-7777-777777777772",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-05-28T14:00:00Z"),
        notes: "RAB Sudirman Suites disetujui, target margin 12.5%",
      },
    ]).onConflictDoNothing();

    // 9. Seed Budget Items
    console.log("Seeding budget items...");
    await tx.insert(projectBudgetItem).values([
      // Proyek Menteng
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Finishing Kabinet Dapur (HPL & Duco)",
        allocatedAmount: "220000000.00",
        actualSpent: "210000000.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Carrara Marble Countertop & Backsplash",
        allocatedAmount: "180000000.00",
        actualSpent: "0.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999992",
        name: "Pekerjaan MEP & Kelistrikan Dapur",
        allocatedAmount: "70000000.00",
        actualSpent: "65000000.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999992",
        name: "Upah Pertukangan Sipil Lapangan",
        allocatedAmount: "90000000.00",
        actualSpent: "0.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999993",
        name: "Transportasi & Operasional Lapangan PM",
        allocatedAmount: "40000000.00",
        actualSpent: "42000000.00",
      },
      // Proyek Sudirman
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Partisi Dinding Gypsum & Plafon Penthouse",
        allocatedAmount: "350000000.00",
        actualSpent: "0.00",
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Custom Wardrobe Master Bedroom",
        allocatedAmount: "400000000.00",
        actualSpent: "0.00",
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999992",
        name: "Pekerjaan MEP & Penerangan Penthouse",
        allocatedAmount: "150000000.00",
        actualSpent: "0.00",
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999992",
        name: "Upah Tenaga Kerja & Tukang",
        allocatedAmount: "200000000.00",
        actualSpent: "0.00",
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5",
        projectBudgetId: "88888888-8888-8888-8888-888888888882",
        costCategoryId: "99999999-9999-9999-9999-999999999993",
        name: "Perizinan & Koordinasi Gedung",
        allocatedAmount: "50000000.00",
        actualSpent: "0.00",
      },
    ]).onConflictDoNothing();

    // 10. Seed Client Invoices
    console.log("Seeding client invoices...");
    await tx.insert(clientInvoice).values([
      {
        id: "01010101-0101-0101-0101-010101010101",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/001",
        amount: "195000000.00",
        status: "PAID",
        stage: "DP",
        dueDate: new Date("2026-06-01T23:59:59Z"),
        notes: "DP 30% Klien Alexandra Menteng",
      },
      {
        id: "01010101-0101-0101-0101-010101010102",
        projectId: "77777777-7777-7777-7777-777777777771",
        invoiceNumber: "INV/2026/002",
        amount: "325000000.00",
        status: "UNPAID",
        stage: "PROGRESS_1",
        dueDate: new Date("2026-06-25T23:59:59Z"),
        notes: "Termin Progress 50% Lapangan",
      },
      {
        id: "01010101-0101-0101-0101-010101010103",
        projectId: "77777777-7777-7777-7777-777777777772",
        invoiceNumber: "INV/2026/003",
        amount: "360000000.00",
        status: "PAID",
        stage: "DP",
        dueDate: new Date("2026-06-05T23:59:59Z"),
        notes: "DP 30% Sudirman Suites Penthouse",
      },
    ]).onConflictDoNothing();

    // 11. Seed Cash Transactions (Ledger Entries)
    console.log("Seeding ledger cash transactions...");
    await tx.insert(cashTransaction).values([
      // Client Inflows
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc01",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "DEBIT",
        category: "client_payment",
        amount: "195000000.00",
        description: "Pembayaran Lunas DP 30% - Ibu Alexandra Menteng",
        reconciled: true,
        reconciliationDate: new Date("2026-06-01T11:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020201",
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc02",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        type: "DEBIT",
        category: "client_payment",
        amount: "360000000.00",
        description: "Pembayaran Lunas DP 30% - Bpk Haryanto Sudirman",
        reconciled: true,
        reconciliationDate: new Date("2026-06-05T14:30:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "client_payment",
        referenceId: "02020202-0202-0202-0202-020202020202",
      },
      // Vendor Outflow (Bill 1)
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        type: "CREDIT",
        category: "vendor_payment",
        amount: "210000000.00",
        description: "Pembayaran Tagihan Material Kabinet - PT Cahaya Abadi",
        reconciled: true,
        reconciliationDate: new Date("2026-06-10T16:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "vendor_payment",
        referenceId: "03030303-0303-0303-0303-030303030301",
      },
      // Petty Cash Outflows (Field requests PM)
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc04",
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        type: "CREDIT",
        category: "reimbursement",
        amount: "65000000.00",
        description: "Pelunasan Dana Reimbursement PM Budi - MEP Kabel Eterna",
        reconciled: true,
        reconciliationDate: new Date("2026-06-03T14:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "project_cost",
        referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001",
      },
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccc05",
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        type: "CREDIT",
        category: "reimbursement",
        amount: "42000000.00",
        description: "Pelunasan Dana Akomodasi Scaffolding - Over Budget Approved",
        reconciled: true,
        reconciliationDate: new Date("2026-06-08T11:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "project_cost",
        referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
      },
    ]).onConflictDoNothing();

    // 12. Seed Client Payments
    console.log("Seeding client payments...");
    await tx.insert(clientPayment).values([
      {
        id: "02020202-0202-0202-0202-020202020201",
        clientInvoiceId: "01010101-0101-0101-0101-010101010101",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc01",
        amountPaid: "195000000.00",
        paymentDate: new Date("2026-06-01T10:30:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-BCA-9831",
      },
      {
        id: "02020202-0202-0202-0202-020202020202",
        clientInvoiceId: "01010101-0101-0101-0101-010101010103",
        bankAccountId: "66666666-6666-6666-6666-666666666662",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc02",
        amountPaid: "360000000.00",
        paymentDate: new Date("2026-06-05T13:00:00Z"),
        receivedById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "TRF-MND-4412",
      },
    ]).onConflictDoNothing();

    // 13. Seed Vendor Bills
    console.log("Seeding vendor bills...");
    await tx.insert(vendorBill).values([
      {
        id: "33033303-3303-3303-3303-330333033301",
        vendorId: "55555555-5555-5555-5555-555555555551",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        billNumber: "BILL-2026-049",
        amount: "210000000.00",
        status: "PAID",
        dueDate: new Date("2026-06-10T23:59:59Z"),
        notes: "Material multipleks finishing HPL untuk dapur Menteng",
      },
      {
        id: "33033303-3303-3303-3303-330333033302",
        vendorId: "55555555-5555-5555-5555-555555555552",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        billNumber: "BILL-2026-057",
        amount: "175000000.00",
        status: "UNPAID",
        dueDate: new Date("2026-06-25T23:59:59Z"),
        notes: "Marmer alam Carrara Italia impor slab utuh",
      },
    ]).onConflictDoNothing();

    // 14. Seed Vendor Payments
    console.log("Seeding vendor payments...");
    await tx.insert(vendorPayment).values([
      {
        id: "03030303-0303-0303-0303-030303030301",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        amountPaid: "210000000.00",
        status: "COMPLETED",
        paymentDate: new Date("2026-06-10T15:30:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "LLG-BCA-0012",
      },
    ]).onConflictDoNothing();

    // 15. Seed Project Costs
    console.log("Seeding project field costs...");
    await tx.insert(projectCost).values([
      {
        id: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        requestedById: "33333333-3333-3333-3333-333333333331",
        amount: "65000000.00",
        description: "Belanja kabel Eterna, MCB Schneider, & conduit PVC",
        receiptImageUrl: "https://storage.googleapis.com/atria-receipts/rec-09123.jpg",
        status: "PAID",
        budgetOverrun: false,
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc04",
        verifiedById: "22222222-2222-2222-2222-222222222222",
        verifiedAt: new Date("2026-06-03T09:00:00Z"),
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-06-03T12:00:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        paidAt: new Date("2026-06-03T14:00:00Z"),
      },
      {
        id: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
        requestedById: "33333333-3333-3333-3333-333333333331",
        amount: "42000000.00",
        description: "Klaim akomodasi, sewa scaffolding, & konsumsi lembur tukang",
        receiptImageUrl: "https://storage.googleapis.com/atria-receipts/rec-09124.jpg",
        status: "PAID",
        budgetOverrun: true,
        bankAccountId: "66666666-6666-6666-6666-666666666663",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc05",
        verifiedById: "22222222-2222-2222-2222-222222222222",
        verifiedAt: new Date("2026-06-07T10:00:00Z"),
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-06-08T09:00:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        paidAt: new Date("2026-06-08T11:00:00Z"),
      },
    ]).onConflictDoNothing();

    // 16. Seed Approvals
    console.log("Seeding transaction approvals...");
    await tx.insert(approval).values([
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e001",
        approverId: "11111111-1111-1111-1111-111111111111",
        referenceType: "project_cost",
        referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001",
        status: "APPROVED",
        notes: "Disetujui, sesuai nota pembelian material MEP.",
      },
      {
        id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e002",
        approverId: "11111111-1111-1111-1111-111111111111",
        referenceType: "project_cost",
        referenceId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
        status: "APPROVED",
        notes: "Override anggaran disetujui. PM wajib memastikan tidak ada penambahan operasional lagi.",
      },
    ]).onConflictDoNothing();

    // 17. Seed AI Runs
    console.log("Seeding AI run logs...");
    await tx.insert(aiRun).values([
      {
        id: "a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a001",
        runType: "OCR_RECEIPT",
        runById: "33333333-3333-3333-3333-333333333331",
        status: "COMPLETED",
        payload: '{"imageUrl": "https://storage.googleapis.com/atria-receipts/rec-09123.jpg"}',
        result: '{"vendorName": "Toko Listrik Jaya", "transactionDate": "2026-06-03", "totalAmount": 65000000, "items": [{"name": "Kabel Eterna", "qty": 10, "price": 6500000}]}',
        tokensUsed: 1200,
      },
    ]).onConflictDoNothing();

    // 18. Seed Notifications
    console.log("Seeding notifications and budget alerts...");
    await tx.insert(notification).values([
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd01",
        userId: "11111111-1111-1111-1111-111111111111",
        title: "WARNING: Budget Limit 90% Terlampaui",
        message: "Anggaran MEP Proyek Menteng telah terpakai Rp 65.000.000 dari alokasi Rp 70.000.000 (92.8%).",
        read: false,
        severity: "WARNING",
        referenceType: "project_budget_item",
        referenceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
      },
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd02",
        userId: "11111111-1111-1111-1111-111111111111",
        title: "CRITICAL: Anggaran Proyek Jebol!",
        message: "Anggaran Operasional PM Proyek Menteng telah melampaui batas sebesar Rp 42.000.000 dari alokasi Rp 40.000.000 (105.0%).",
        read: false,
        severity: "CRITICAL",
        referenceType: "project_budget_item",
        referenceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
      },
    ]).onConflictDoNothing();

    // 19. Seed Audit Logs
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
        ipAddress: "192.168.1.10",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26)",
      },
      {
        id: "99099909-9909-9909-9909-990999099902",
        userId: "22222222-2222-2222-2222-222222222222",
        action: "PAY_FIELD_REQUEST",
        targetTable: "project_cost",
        targetId: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
        originalState: '{"status": "APPROVED", "actual_spent": "0.00"}',
        newState: '{"status": "PAID", "actual_spent": "42000000.00"}',
        ipAddress: "192.168.1.10",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26)",
      },
    ]).onConflictDoNothing();
  });

  console.log("Database seeding completed successfully!");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
