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
  auditLog,
  account,
} from "./schema";

async function main(): Promise<void> {
  console.log("Starting clean sandbox database seeding...");

  await db.transaction(async (tx) => {
    // Cleanup existing data in reverse dependency order
    console.log("Cleaning up database tables...");
    await tx.delete(auditLog);
    await tx.delete(notification);
    await tx.delete(aiRun);
    await tx.delete(approval);
    await tx.delete(projectCost);
    await tx.delete(vendorPayment);
    await tx.delete(vendorBill);
    await tx.delete(clientPayment);
    await tx.delete(cashTransaction);
    await tx.delete(clientInvoice);
    await tx.delete(projectBudgetItem);
    await tx.delete(projectBudget);
    await tx.delete(project);
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
      },
      {
        id: "66666666-6666-6666-6666-666666666662",
        name: "Kas Kecil PM Budi",
        accountNumber: "9990001112",
        bankName: "BCA Cashier",
        holderName: "Budi Santoso (Petty Cash)",
        balance: "15000000.00",
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
        billNumber: "BILL-2026-091",
        amount: "20000000.00",
        status: "APPROVED",
        dueDate: new Date("2026-06-30T23:59:59Z"),
        notes: "Invoice pembelian material kayu panel Multipleks - PT Cahaya Mas",
      },
    ]);

    // 14. Seed Project Costs (Field Expenses)
    console.log("Seeding project field costs & approvals...");

    // Cost 1: PM Claim (Approved but unpaid, to test disburse)
    const cost1Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001";
    await tx.insert(projectCost).values({
      id: cost1Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
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
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
