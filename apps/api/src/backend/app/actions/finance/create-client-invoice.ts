import { getRoleDataScopeByName } from "@backend/lib/auth/role-access";

import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { db } from "@backend/db";
import { clientInvoice, auditLog, project } from "@backend/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@backend/lib/auth";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess, assertProjectIsOperational } from "@backend/lib/auth/scoping";
import { ActionResponse } from "@atria/core/types/action-response";
import {
  createClientInvoiceSchema,
  CreateClientInvoiceInput,
} from "@atria/core/validations/finance";

/**
 * Mencatat/membuat Invoice Klien baru secara manual.
 * Terbatas untuk peran OWNER, FINANCE_ADMIN, dan SALES dengan validasi akses proyek (scoping check).
 */
export async function createClientInvoice(
  input: CreateClientInvoiceInput,
): Promise<ActionResponse<typeof clientInvoice.$inferSelect>> {
  const validation = createClientInvoiceSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter input tidak valid." },
    };
  }

  const { projectId, invoiceNumber, amount, stage, dueDate, notes } = validation.data;

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("@runtime/request-context")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    try {
      await assertPermission(session.user, "create:client_invoice");
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // Scoping check for PM / Designer / other scoped roles
    try {
      const userRoleName = await resolveRoleName(session.user.roleId);
      // Peran bercakupan tertugas dibatasi pada proyek yang dipegangnya;
      // cakupan global tidak perlu diperiksa lagi di sini.
      if ((await getRoleDataScopeByName(userRoleName)) === "ASSIGNED") {
        await assertProjectAccess(projectId, session.user.id, userRoleName);
      }
      await assertProjectIsOperational(projectId);
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }

    // Check duplicate invoice number
    const existingInvoice = await db.query.clientInvoice.findFirst({
      where: eq(clientInvoice.invoiceNumber, invoiceNumber),
    });

    if (existingInvoice) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: `Nomor invoice "${invoiceNumber}" sudah terdaftar.` },
      };
    }

    const newInvoice = await db.transaction(async (tx) => {
      const [lockedProject] = await tx
        .select()
        .from(project)
        .where(eq(project.id, projectId))
        .for("update");
      if (!lockedProject) throw new Error("PROJECT_NOT_FOUND");
      const activeInvoices = await tx.query.clientInvoice.findMany({
        where: (table, { and, eq: equals, ne: notEqual }) =>
          and(equals(table.projectId, projectId), notEqual(table.status, "VOID")),
      });
      const invoicedAmount = activeInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.amount),
        0,
      );
      if (invoicedAmount + amount > Number(lockedProject.totalContractValue) + 0.001) {
        throw new Error("INVOICE_EXCEEDS_CONTRACT_VALUE");
      }
      const [inserted] = await tx
        .insert(clientInvoice)
        .values({
          projectId,
          invoiceNumber,
          amount: amount.toFixed(2),
          status: "UNPAID",
          stage,
          dueDate,
          notes: notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Write audit log
      await tx.insert(auditLog).values({
        userId: session.user.id,
        action: "CREATE_CLIENT_INVOICE",
        targetTable: "client_invoice",
        targetId: inserted.id,
        originalState: null,
        newState: JSON.stringify({
          projectId,
          invoiceNumber,
          amount: amount.toFixed(2),
          stage,
          dueDate,
        }),
        createdAt: new Date(),
      });

      await recordNotificationEvent(tx, {
        referenceType: "client_invoice",
        referenceId: inserted.id,
        projectId: inserted.projectId,
        stage: "CREATED",
        title: "Invoice klien dibuat",
        message: inserted.invoiceNumber,
        permission: "view:client_invoice",
        actionUrl: `/projects/${inserted.projectId}?tab=payments`,
        actorId: session.user.id,
      });

      return inserted;
    });

    // Tanpa ini tab Pembayaran tetap menampilkan daftar lama sesudah invoice
    // dibuat: sheet sukses tertutup, tetapi termin yang baru tidak muncul dan
    // "Sisa tagihan klien" tetap Rp0 sampai halaman dimuat ulang manual —
    // mengundang pengguna membuat invoice yang sama dua kali.
    // `generate-invoice-schedule.ts` sudah melakukan hal yang sama.
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/ledger");

    return {
      success: true,
      data: newInvoice,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_EXCEEDS_CONTRACT_VALUE") {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Total invoice aktif akan melebihi nilai kontrak proyek. Gunakan Change Order sebelum menambah tagihan.",
        },
      };
    }
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
      },
    };
  }
}
