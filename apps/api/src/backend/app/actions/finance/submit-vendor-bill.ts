import { resolveActor } from "@backend/server/actor";
import { assertFinancePermission, lockFinanceProject } from "@backend/server/usecases/finance/mutation-access";

import { db } from "@backend/db";
import { vendorBill, vendor } from "@backend/db/schema";
import { asc } from "drizzle-orm";
import {
  getActiveProjectsForExpense,
  type ProjectForExpense,
} from "@backend/app/actions/project/budget";
import { auth } from "@backend/lib/auth";
import { resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { ActionResponse } from "@atria/core/types/action-response";
import { submitVendorBillSchema, SubmitVendorBillInput } from "@atria/core/validations/finance";
import { createVendorBillTx } from "@backend/lib/finance/vendor-bill-write";

export async function submitVendorBill(
  input: SubmitVendorBillInput,
): Promise<ActionResponse<typeof vendorBill.$inferSelect>> {
  const validation = submitVendorBillSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter input tidak valid." },
    };
  }

  const {
    vendorId,
    projectId,
    projectBudgetCategoryId,
    projectCategoryPlanItemId,
    billNumber,
    amount,
    dueDate,
    notes,
  } = validation.data;

  try {
    const actor = await resolveActor();
    if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi kedaluwarsa." } };
    assertFinancePermission(actor, "create:vendor_bill");
    const bill = await db.transaction(async (tx) => {
      const currentProject = await lockFinanceProject(tx, actor, projectId);
      assertProjectStatusIsOperational(currentProject.status);
      return createVendorBillTx(tx, {        vendorId,
        projectId,
        projectBudgetCategoryId,
        projectCategoryPlanItemId,
        billNumber,
        amount,
        dueDate,
        notes,
        requestedById: actor.userId,
      });
    });

    return {
      success: true,
      data: bill,
    };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("FORBIDDEN:") || error.message.startsWith("PROJECT_NOT_ACTIVE:"))) return { success: false, error: { code: "FORBIDDEN", message: "Akses proyek atau pencatatan tagihan ditolak." } };
    if (error instanceof Error && error.message === "VENDOR_BILL_NUMBER_EXISTS") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Nomor tagihan ini sudah terdaftar." },
      };
    }
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Gagal mencatat tagihan.",
      },
    };
  }
}

export interface VendorBillFormData {
  projects: ProjectForExpense[];
  vendors: Array<{ id: string; name: string }>;
  userRole: string;
}

export async function getVendorBillFormData(): Promise<ActionResponse<VendorBillFormData>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("@runtime/request-context")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
      };
    }

    const roleName = await resolveRoleName(session.user.roleId);

    // Dapatkan proyek aktif menggunakan fungsi getActiveProjectsForExpense yang sudah ada
    const projectsRes = await getActiveProjectsForExpense();
    if (!projectsRes.success) {
      return {
        success: false,
        error: projectsRes.error,
      };
    }

    // Dapatkan data vendor
    const vendorsData = await db.query.vendor.findMany({
      columns: { id: true, name: true },
      orderBy: [asc(vendor.name)],
    });

    return {
      success: true,
      data: {
        projects: projectsRes.data,
        vendors: vendorsData,
        userRole: roleName || "UNKNOWN",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan server saat mengambil data form tagihan vendor.",
      },
    };
  }
}
