import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@backend/db";
import { clientInvoice, INSTANCE_TENANT_ID, project } from "@backend/db/schema";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import { resolveActor } from "@backend/server/actor";
import { assertFinancePermission } from "@backend/server/usecases/finance/mutation-access";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  deriveInvoicePrefill,
  type InvoicePrefillResult,
} from "@atria/core/finance/invoice-prefill";

const getInvoicePrefillSchema = z.object({
  projectId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "ID proyek tidak valid.",
    ),
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
    const actor = await resolveActor();

    if (!actor) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    try {
      assertFinancePermission(actor, "view:client_invoice");
      await assertProjectAccess(projectId, actor.userId, actor.roleName);
    } catch {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Anda belum memiliki akses melihat invoice proyek ini.",
        },
      };
    }

    const proj = await db.query.project.findFirst({
      where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
      with: {
        clientInvoices: { where: eq(clientInvoice.tenantId, INSTANCE_TENANT_ID) },
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
  } catch {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Konteks invoice belum dapat dimuat. Coba lagi.",
      },
    };
  }
}
