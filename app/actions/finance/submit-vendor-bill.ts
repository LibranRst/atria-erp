"use server";

import { db } from "@/db";
import { vendorBill } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { ActionResponse } from "@/lib/types/action-response";
import { submitVendorBillSchema, SubmitVendorBillInput } from "@/lib/validations/finance";

export async function submitVendorBill(
  input: SubmitVendorBillInput
): Promise<ActionResponse<typeof vendorBill.$inferSelect>> {
  const validation = submitVendorBillSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter input tidak valid." },
    };
  }

  const { vendorId, projectId, projectBudgetItemId, billNumber, amount, dueDate, notes } = validation.data;

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await import("next/headers")).cookies().toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi kedaluwarsa." },
      };
    }

    try {
      await assertPermission(session.user, "create:vendor_bill");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
    }

    // PM Scoping check
    try {
      const userRoleName = await resolveRoleName(session.user.roleId);
      if (userRoleName === "PROJECT_MANAGER" || userRoleName === "DESIGNER") {
        await assertProjectAccess(projectId, session.user.id, userRoleName);
      }
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
    }

    // Check duplicate bill number
    const existingBill = await db.query.vendorBill.findFirst({
      where: eq(vendorBill.billNumber, billNumber),
    });

    if (existingBill) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Tagihan dengan nomor ini sudah terdaftar." },
      };
    }

    // Save vendor bill with status UNPAID.
    const [bill] = await db
      .insert(vendorBill)
      .values({
        vendorId,
        projectId,
        projectBudgetItemId,
        billNumber,
        amount: amount.toFixed(2),
        status: "UNPAID",
        dueDate,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      data: bill,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Gagal mencatat tagihan." },
    };
  }
}
