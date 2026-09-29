"use server";
import { getRoleDataScopeByName } from "@/lib/auth/role-access";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { project } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  deriveInvoicePrefill,
  type InvoicePrefillResult,
} from "@atria/core/finance/invoice-prefill";

const getInvoicePrefillSchema = z.object({
  projectId: z.string().uuid("ID proyek tidak valid."),
});

/**
 * Mengambil konteks finansial proyek dan menghasilkan saran isian otomatis (prefill)
 * untuk pembuatan invoice klien baru (Opsi 1: Smart Auto-Fill).
 */
export async function getInvoicePrefillContext(input: {
  projectId: string;
}): Promise<ActionResponse<InvoicePrefillResult>> {
  const validation = getInvoicePrefillSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter proyek tidak valid." },
    };
  }

  const { projectId } = validation.data;

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    try {
      // Izinkan pembuat atau pelihat invoice memeriksa konteks
      await assertPermission(session.user, "view:client_invoice");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    const userRoleName = await resolveRoleName(session.user.roleId);
    if ((await getRoleDataScopeByName(userRoleName)) === "ASSIGNED") {
      await assertProjectAccess(projectId, session.user.id, userRoleName);
    }

    const proj = await db.query.project.findFirst({
      where: eq(project.id, projectId),
      with: {
        clientInvoices: true,
      },
    });

    if (!proj) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Proyek tidak ditemukan." },
      };
    }

    const existingInvoices = (proj.clientInvoices || []).map((inv) => ({
      amount: Number(inv.amount || 0),
      stage: inv.stage,
      status: inv.status,
    }));

    const prefill = deriveInvoicePrefill({
      projectName: proj.name,
      totalContractValue: Number(proj.totalContractValue || 0),
      existingInvoices,
    });

    return {
      success: true,
      data: prefill,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Gagal mengambil data konteks invoice proyek.",
      },
    };
  }
}
