import { auth } from "@/lib/auth";
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
  auditLog,
  account,
} from "./schema";

async function main(): Promise<void> {
  console.log("Starting database cleanup and seeding...");

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
    ]);

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
    ]);

    // 5. Seed Bank Accounts
    console.log("Seeding bank accounts...");
    await tx.insert(bankAccount).values([
      {
        id: "66666666-6666-6666-6666-666666666661",
        name: "BCA Operational",
        accountNumber: "8889991122",
        bankName: "BCA",
        holderName: "PT Dekoria Desain Estetika",
        balance: "625000000.00", // 480M awal + 195M termin - 50M vendor
      },
      {
        id: "66666666-6666-6666-6666-666666666662",
        name: "Mandiri Project",
        accountNumber: "11122233344",
        bankName: "Mandiri",
        holderName: "PT Dekoria Desain Estetika",
        balance: "360000000.00", // 360M termin masuk
      },
      {
        id: "66666666-6666-6666-6666-666666666663",
        name: "Petty Cash Office",
        accountNumber: "9990001112",
        bankName: "BCA",
        holderName: "Lisa Permata (Cashier)",
        balance: "10000000.00",
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
        name: "Menteng Residence - Luxury Kitchen Remodel",
        clientId: "44444444-4444-4444-4444-444444444441",
        projectManagerId: "33333333-3333-3333-3333-333333333331",
        status: "ACTIVE",
        financialHealth: "HEALTHY",
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
    ]);

    // 8. Seed Budgets
    console.log("Seeding budgets...");
    await tx.insert(projectBudget).values([
      {
        id: "88888888-8888-8888-8888-888888888881",
        projectId: "77777777-7777-7777-7777-777777777771",
        status: "APPROVED",
        approvedById: "11111111-1111-1111-1111-111111111111",
        approvedAt: new Date("2026-05-14T10:00:00Z"),
        notes: "RAB disetujui Owner Menteng",
      },
    ]);

    // 9. Seed Budget Items
    console.log("Seeding budget items...");
    await tx.insert(projectBudgetItem).values([
      // Proyek Menteng
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "Multipleks 18mm Meranti",
        budgetCategory: "Material Kayu",
        quantity: "800.00",
        unit: "lembar",
        unitPrice: "250000.00",
        allocatedAmount: "200000000.00",
        actualSpent: "50000000.00",
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        projectBudgetId: "88888888-8888-8888-8888-888888888881",
        costCategoryId: "99999999-9999-9999-9999-999999999991",
        name: "HPL Taco Light Oak (T-123)",
        budgetCategory: "Material Finishing",
        quantity: "750.00",
        unit: "lembar",
        unitPrice: "200000.00",
        allocatedAmount: "150000000.00",
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
        amount: "200000000.00",
        status: "UNPAID",
        stage: "PROGRESS_1",
        dueDate: new Date("2026-06-25T23:59:59Z"),
        notes: "Termin 2 - Progress 50% Lapangan (Dapat diuji pembayaran)",
      },
      // Sudirman
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
    ]);

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
        amount: "50000000.00",
        description: "Pembayaran Tagihan Material Kabinet - PT Cahaya Abadi",
        reconciled: true,
        reconciliationDate: new Date("2026-06-10T16:00:00Z"),
        reconciledById: "22222222-2222-2222-2222-222222222222",
        referenceType: "vendor_payment",
        referenceId: "03030303-0303-0303-0303-030303030301",
      },
    ]);

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
    ]);

    // 13. Seed Vendor Bills
    console.log("Seeding vendor bills...");
    await tx.insert(vendorBill).values([
      {
        id: "33033303-3303-3303-3303-330333033301",
        vendorId: "55555555-5555-5555-5555-555555555551",
        projectId: "77777777-7777-7777-7777-777777777771",
        projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        billNumber: "BILL-2026-001",
        amount: "50000000.00",
        status: "PAID",
        dueDate: new Date("2026-06-10T23:59:59Z"),
        notes: "Uang muka material kabinet Menteng",
      },
    ]);

    // 14. Seed Vendor Payments
    console.log("Seeding vendor payments...");
    await tx.insert(vendorPayment).values([
      {
        id: "03030303-0303-0303-0303-030303030301",
        vendorBillId: "33033303-3303-3303-3303-330333033301",
        bankAccountId: "66666666-6666-6666-6666-666666666661",
        cashTransactionId: "cccccccc-cccc-cccc-cccc-cccccccccc03",
        amountPaid: "50000000.00",
        status: "COMPLETED",
        paymentDate: new Date("2026-06-10T15:30:00Z"),
        paidById: "22222222-2222-2222-2222-222222222222",
        referenceNumber: "LLG-BCA-0012",
      },
    ]);

    // 15. Seed Project Costs & Approvals
    console.log("Seeding project field costs & approvals...");

    // Cost 1: PM Claim (Approved but unpaid, to test disburse)
    const cost1Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001";
    await tx.insert(projectCost).values({
      id: cost1Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      requestedById: "33333333-3333-3333-3333-333333333331",
      amount: "6000000.00",
      description: "Belanja Cat Duco Nippon Paint & Thinner",
      receiptImageUrl: "http://localhost:3000/receipt_test.png",
      status: "APPROVED",
      budgetOverrun: false,
      createdAt: new Date("2026-06-11T09:00:00Z"),
      updatedAt: new Date("2026-06-11T12:00:00Z"),
    });

    await tx.insert(approval).values({
      id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e001",
      approverId: "11111111-1111-1111-1111-111111111111",
      referenceType: "project_cost",
      referenceId: cost1Id,
      status: "APPROVED",
      notes: "Disetujui Owner",
    });

    // Cost 2: PM Claim (Submitted, waiting for verification)
    await tx.insert(projectCost).values({
      id: "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002",
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      requestedById: "33333333-3333-3333-3333-333333333331",
      amount: "1500000.00",
      description: "Uang bensin operasional & parkir lapangan",
      receiptImageUrl: "http://localhost:3000/receipt_test.png",
      status: "SUBMITTED",
      budgetOverrun: false,
      createdAt: new Date("2026-06-12T08:00:00Z"),
      updatedAt: new Date("2026-06-12T08:00:00Z"),
    });

    // Cost 3: PM Claim (Submitted, requires approval, to test approve/reject in Payments menu)
    const cost3Id = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f003";
    await tx.insert(projectCost).values({
      id: cost3Id,
      projectId: "77777777-7777-7777-7777-777777777771",
      projectBudgetItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      requestedById: "33333333-3333-3333-3333-333333333331",
      amount: "8000000.00",
      description: "Sewa mobil box angkut marmer slab",
      receiptImageUrl: "http://localhost:3000/receipt_test.png",
      status: "SUBMITTED",
      budgetOverrun: false,
      createdAt: new Date("2026-06-12T10:00:00Z"),
      updatedAt: new Date("2026-06-12T10:00:00Z"),
    });

    await tx.insert(approval).values({
      id: "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e003",
      approverId: "11111111-1111-1111-1111-111111111111",
      referenceType: "project_cost",
      referenceId: cost3Id,
      status: "PENDING",
      notes: "Nominal pengeluaran lapangan mencapai/melebihi Rp 5.000.000.",
    });

    // 16. Seed AI Runs
    console.log("Seeding AI run logs...");
    await tx.insert(aiRun).values([
      {
        id: "a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a001",
        runType: "OCR_RECEIPT",
        runById: "33333333-3333-3333-3333-333333333331",
        status: "COMPLETED",
        payload: '{"imageUrl": "http://localhost:3000/receipt_test.png"}',
        result: '{"vendorName": "Toko Nippon Paint", "transactionDate": "2026-06-11", "totalAmount": 6000000}',
        tokensUsed: 120,
      },
    ]);

    // 17. Seed Notifications
    console.log("Seeding notifications...");
    await tx.insert(notification).values([
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddd01",
        userId: "11111111-1111-1111-1111-111111111111",
        title: "WARNING: Anggaran Mendekati Limit",
        message: "Item anggaran Multipleks 18mm Meranti telah terpakai Rp 50.000.000 (25.0%).",
        read: false,
        severity: "WARNING",
        referenceType: "project_budget_item",
        referenceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      },
    ]);

    // 18. Seed Audit Logs
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

  console.log("Database seeding completed successfully!");
  console.log("Default development login credentials:");
  console.log("- ronald@dekoria.com / password123 (owner)");
  console.log("- lisa@dekoria.com / password123 (finance_admin)");
  console.log("- budi@dekoria.com / password123 (project_manager)");
  console.log("- siti@dekoria.com / password123 (project_manager)");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
