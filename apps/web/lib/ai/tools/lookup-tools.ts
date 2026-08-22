import "server-only";

import { db } from "@/db";
import {
  client,
  clientInvoice,
  inventoryLocation,
  materialCategory,
  materialInventory,
  materialMaster,
  project,
  projectCost,
  user,
  vendor,
  vendorBill,
  vendorPayment,
} from "@/db/schema";
import { tool } from "ai";
import { and, asc, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { z } from "zod";

import {
  accessibleProjectIds,
  hasGlobalScope,
  hasPermission,
  permissionDenied,
  projectScopeCondition,
  type AiToolContext,
} from "./context";
import { daysUntil, describeFilters, money, toNumber } from "./shared";

const MAX_LOOKUP_ROWS = 20;

export function buildLookupTools(context: AiToolContext) {
  return {
    listVendors: tool({
      description:
        "Search and list registered vendors / suppliers. Use when the user mentions a vendor name to find their vendorId.",
      inputSchema: z.object({
        query: z.string().min(1).optional().describe("Search term for vendor name or category."),
        limit: z.number().int().min(1).max(MAX_LOOKUP_ROWS).default(10),
      }),
      execute: async ({ query, limit }) => {
        const conditions = [eq(vendor.isActive, true)];
        if (query) {
          conditions.push(or(ilike(vendor.name, `%${query}%`), ilike(vendor.email, `%${query}%`))!);
        }

        const rows = await db
          .select({
            id: vendor.id,
            name: vendor.name,
            email: vendor.email,
            phone: vendor.phone,
            bankName: vendor.bankName,
          })
          .from(vendor)
          .where(and(...conditions))
          .orderBy(asc(vendor.name))
          .limit(limit);

        return {
          vendors: rows.map((v) => ({
            vendorId: v.id,
            name: v.name,
            email: v.email,
            phone: v.phone,
            bankName: v.bankName,
          })),
        };
      },
    }),

    listClients: tool({
      description:
        "Search and list registered clients. Use when the user wants to create a project or look up client information.",
      inputSchema: z.object({
        query: z.string().min(1).optional().describe("Search term for client name, company, or email."),
        limit: z.number().int().min(1).max(MAX_LOOKUP_ROWS).default(10),
      }),
      execute: async ({ query, limit }) => {
        const conditions = [];
        if (query) {
          conditions.push(
            or(
              ilike(client.name, `%${query}%`),
              ilike(client.companyName, `%${query}%`),
              ilike(client.email, `%${query}%`),
            )!,
          );
        }

        const rows = await db
          .select({
            id: client.id,
            name: client.name,
            companyName: client.companyName,
            email: client.email,
            phone: client.phone,
            address: client.address,
          })
          .from(client)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(asc(client.name))
          .limit(limit);

        return {
          clients: rows.map((c) => ({
            clientId: c.id,
            name: c.name,
            companyName: c.companyName,
            email: c.email,
            phone: c.phone,
            address: c.address,
          })),
        };
      },
    }),

    getMaterialCatalog: tool({
      description:
        "Search materials from Material Master catalog with unit and stock on hand across locations.",
      inputSchema: z.object({
        query: z.string().min(1).optional().describe("Search term for material name, brand, or code."),
        limit: z.number().int().min(1).max(MAX_LOOKUP_ROWS).default(10),
      }),
      execute: async ({ query, limit }) => {
        if (!hasPermission(context, "view:material")) {
          return permissionDenied("katalog material");
        }

        const conditions = [eq(materialMaster.isActive, true)];
        if (query) {
          conditions.push(
            or(
              ilike(materialMaster.name, `%${query}%`),
              ilike(materialMaster.brand, `%${query}%`),
              ilike(materialMaster.code, `%${query}%`),
            )!,
          );
        }

        const rows = await db
          .select({
            id: materialMaster.id,
            name: materialMaster.name,
            code: materialMaster.code,
            unit: materialMaster.unit,
            categoryName: materialCategory.name,
            brand: materialMaster.brand,
            specification: materialMaster.specification,
          })
          .from(materialMaster)
          .leftJoin(materialCategory, eq(materialMaster.categoryId, materialCategory.id))
          .where(and(...conditions))
          .orderBy(asc(materialMaster.name))
          .limit(limit);

        const materialIds = rows.map((r) => r.id);
        const inventories =
          materialIds.length > 0
            ? await db
                .select({
                  materialId: materialInventory.materialId,
                  currentStock: materialInventory.currentStock,
                  reservedStock: materialInventory.reservedStock,
                  averageCost: materialInventory.averageCost,
                  locationName: inventoryLocation.name,
                })
                .from(materialInventory)
                .innerJoin(inventoryLocation, eq(materialInventory.locationId, inventoryLocation.id))
                .where(inArray(materialInventory.materialId, materialIds))
            : [];

        return {
          materials: rows.map((m) => {
            const locStocks = inventories.filter((inv) => inv.materialId === m.id);
            const totalStock = locStocks.reduce((sum, inv) => sum + toNumber(inv.currentStock), 0);
            const totalReserved = locStocks.reduce((sum, inv) => sum + toNumber(inv.reservedStock), 0);
            const avgCost = locStocks.length > 0 ? toNumber(locStocks[0].averageCost) : 0;

            return {
              materialId: m.id,
              name: m.name,
              code: m.code ?? "-",
              unit: m.unit,
              categoryName: m.categoryName ?? "Umum",
              brand: m.brand ?? "-",
              specification: m.specification ?? "-",
              averageCost: money(String(avgCost)),
              totalStockOnHand: totalStock,
              totalAvailableStock: Math.max(0, totalStock - totalReserved),
              locations: locStocks.map((loc) => ({
                location: loc.locationName,
                stock: toNumber(loc.currentStock),
              })),
            };
          }),
        };
      },
    }),

    getInventoryLocations: tool({
      description: "List warehouse and site inventory locations.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPermission(context, "view:material")) {
          return permissionDenied("lokasi gudang");
        }

        const rows = await db.query.inventoryLocation.findMany({
          where: eq(inventoryLocation.isActive, true),
          columns: { id: true, name: true, description: true, isActive: true },
          orderBy: [asc(inventoryLocation.name)],
        });

        return {
          locations: rows.map((loc) => ({
            locationId: loc.id,
            name: loc.name,
            description: loc.description ?? "",
          })),
        };
      },
    }),

    getUnpaidVendorBills: tool({
      description:
        "List unpaid or scheduled vendor bills with their vendorPaymentId, due date, outstanding amount, and bill details. Essential before proposing a vendor bill payment.",
      inputSchema: z.object({
        vendorName: z.string().min(2).optional().describe("Filter by vendor name."),
        projectName: z.string().min(2).optional().describe("Filter by project name."),
        limit: z.number().int().min(1).max(MAX_LOOKUP_ROWS).default(10),
      }),
      execute: async ({ vendorName, projectName, limit }) => {
        if (!hasPermission(context, "view:vendor_bill")) {
          return permissionDenied("data tagihan vendor");
        }

        const projectIds = await accessibleProjectIds(context);
        const scope = projectScopeCondition(projectIds, vendorBill.projectId);

        const conditions = [ne(vendorBill.status, "PAID"), ne(vendorBill.status, "VOID")];
        if (scope) conditions.push(scope);
        if (projectName) conditions.push(ilike(project.name, `%${projectName}%`));
        if (vendorName) conditions.push(ilike(vendor.name, `%${vendorName}%`));

        const bills = await db
          .select({
            billId: vendorBill.id,
            billNumber: vendorBill.billNumber,
            amount: vendorBill.amount,
            status: vendorBill.status,
            dueDate: vendorBill.dueDate,
            projectId: vendorBill.projectId,
            projectName: project.name,
            vendorId: vendor.id,
            vendorName: vendor.name,
            projectBudgetCategoryId: vendorBill.projectBudgetCategoryId,
          })
          .from(vendorBill)
          .innerJoin(project, eq(vendorBill.projectId, project.id))
          .innerJoin(vendor, eq(vendorBill.vendorId, vendor.id))
          .where(and(...conditions))
          .orderBy(asc(vendorBill.dueDate))
          .limit(limit);

        if (bills.length === 0) {
          return { appliedFilters: describeFilters([vendorName ? `Vendor "${vendorName}"` : null]), bills: [] };
        }

        const billIds = bills.map((b) => b.billId);
        const payments = await db
          .select({
            id: vendorPayment.id,
            vendorBillId: vendorPayment.vendorBillId,
            amountPaid: vendorPayment.amountPaid,
            status: vendorPayment.status,
            paymentDate: vendorPayment.paymentDate,
            bankAccountId: vendorPayment.bankAccountId,
          })
          .from(vendorPayment)
          .where(inArray(vendorPayment.vendorBillId, billIds));

        return {
          bills: bills.map((b) => {
            const billPayments = payments.filter((p) => p.vendorBillId === b.billId);
            const pendingPayment = billPayments.find((p) => p.status === "PENDING");
            const completedAmount = billPayments
              .filter((p) => p.status === "COMPLETED")
              .reduce((sum, p) => sum + toNumber(p.amountPaid), 0);
            const outstanding = Math.max(0, toNumber(b.amount) - completedAmount);
            const days = daysUntil(b.dueDate);

            return {
              billId: b.billId,
              billNumber: b.billNumber,
              vendorName: b.vendorName,
              projectName: b.projectName,
              projectId: b.projectId,
              projectBudgetCategoryId: b.projectBudgetCategoryId,
              totalAmount: money(b.amount),
              outstandingAmount: money(String(outstanding)),
              status: b.status,
              dueDate: b.dueDate.toISOString().slice(0, 10),
              dueInDays: days,
              pendingVendorPaymentId: pendingPayment?.id ?? null,
              pendingPaymentAmount: pendingPayment ? money(pendingPayment.amountPaid) : null,
            };
          }),
        };
      },
    }),

    getUnpaidClientInvoices: tool({
      description:
        "List unpaid or partially paid client invoices with invoiceId, invoiceNumber, amount, and project info. Essential before proposing recording a client payment.",
      inputSchema: z.object({
        projectName: z.string().min(2).optional().describe("Filter by project name."),
        limit: z.number().int().min(1).max(MAX_LOOKUP_ROWS).default(10),
      }),
      execute: async ({ projectName, limit }) => {
        if (!hasPermission(context, "view:cost")) {
          return permissionDenied("data invoice klien");
        }

        const projectIds = await accessibleProjectIds(context);
        const scope = projectScopeCondition(projectIds, clientInvoice.projectId);

        const conditions = [ne(clientInvoice.status, "PAID"), ne(clientInvoice.status, "VOID")];
        if (scope) conditions.push(scope);
        if (projectName) conditions.push(ilike(project.name, `%${projectName}%`));

        const rows = await db
          .select({
            invoiceId: clientInvoice.id,
            invoiceNumber: clientInvoice.invoiceNumber,
            amount: clientInvoice.amount,
            status: clientInvoice.status,
            dueDate: clientInvoice.dueDate,
            projectId: clientInvoice.projectId,
            projectName: project.name,
            clientName: client.name,
          })
          .from(clientInvoice)
          .innerJoin(project, eq(clientInvoice.projectId, project.id))
          .innerJoin(client, eq(project.clientId, client.id))
          .where(and(...conditions))
          .orderBy(asc(clientInvoice.dueDate))
          .limit(limit);

        return {
          invoices: rows.map((row) => ({
            invoiceId: row.invoiceId,
            invoiceNumber: row.invoiceNumber,
            projectName: row.projectName,
            clientName: row.clientName,
            amount: money(row.amount),
            status: row.status,
            dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
          })),
        };
      },
    }),

    getPendingExpenseApprovals: tool({
      description:
        "List pending field expense claims waiting for review/verification/approval with expenseId, project, status (SUBMITTED = Menunggu Verifikasi, VERIFIED = Menunggu Persetujuan), amount, PM requester, and overrun risk.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(MAX_LOOKUP_ROWS).default(10),
      }),
      execute: async ({ limit }) => {
        if (!hasPermission(context, "approve:cost") || !hasGlobalScope(context)) {
          return permissionDenied("persetujuan pengeluaran");
        }

        const rows = await db
          .select({
            expenseId: projectCost.id,
            description: projectCost.description,
            amount: projectCost.amount,
            status: projectCost.status,
            budgetOverrun: projectCost.budgetOverrun,
            createdAt: projectCost.createdAt,
            projectName: project.name,
            requesterName: user.name,
          })
          .from(projectCost)
          .innerJoin(project, eq(projectCost.projectId, project.id))
          .innerJoin(user, eq(projectCost.requestedById, user.id))
          .where(or(eq(projectCost.status, "SUBMITTED"), eq(projectCost.status, "VERIFIED")))
          .orderBy(desc(projectCost.createdAt))
          .limit(limit);

        return {
          pendingExpenses: rows.map((r) => ({
            expenseId: r.expenseId,
            projectName: r.projectName,
            description: r.description,
            amount: money(r.amount),
            status: r.status,
            statusLabel: r.status === "SUBMITTED" ? "Menunggu Verifikasi" : "Menunggu Persetujuan",
            budgetOverrun: r.budgetOverrun,
            submittedBy: r.requesterName,
            expenseDate: r.createdAt.toISOString().slice(0, 10),
          })),
        };
      },
    }),
  };
}
