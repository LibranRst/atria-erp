"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, clientInvoice, project } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import type { ActionResponse } from "@/lib/types/action-response";
import { generateInvoiceScheduleSchema } from "@/lib/validations/workflow-governance";

type SessionUser = { readonly id: string; readonly roleId?: string };

export async function generateClientInvoiceSchedule(
  input: unknown,
): Promise<ActionResponse<readonly (typeof clientInvoice.$inferSelect)[]>> {
  const validation = generateInvoiceScheduleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Jadwal invoice tidak valid.",
      },
    };
  const session = await auth.api.getSession({ headers: { cookie: (await cookies()).toString() } });
  if (!session?.user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const user = session.user as SessionUser;
  try {
    await assertPermission(user, "create:client_invoice");
    const roleName = await resolveRoleName(user.roleId ?? "");
    await assertProjectAccess(validation.data.projectId, user.id, roleName);
    const proj = await db.query.project.findFirst({
      where: eq(project.id, validation.data.projectId),
      with: { clientInvoices: true },
    });
    if (!proj) throw new Error("PROJECT_NOT_FOUND");
    if (proj.clientInvoices.some((invoice) => invoice.status !== "VOID"))
      throw new Error("Jadwal invoice aktif sudah tersedia untuk proyek ini.");
    const contractValue = Number(proj.totalContractValue);
    const scheduleToken = Date.now().toString().slice(-6);
    const schedule = await db.transaction(async (tx) => {
      const created: (typeof clientInvoice.$inferSelect)[] = [];
      let allocated = 0;
      for (const [index, installment] of validation.data.installments.entries()) {
        const isLast = index === validation.data.installments.length - 1;
        const amount = isLast
          ? contractValue - allocated
          : Math.round(contractValue * installment.percentage * 100) / 100;
        allocated += amount;
        const dueDate = new Date(validation.data.firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + index);
        const stage = index === 0 ? "DP" : isLast ? "PELUNASAN" : `PROGRESS_${index}`;
        const [invoice] = await tx
          .insert(clientInvoice)
          .values({
            projectId: proj.id,
            invoiceNumber: `INV-${proj.id.slice(0, 8).toUpperCase()}-${scheduleToken}-${String(index + 1).padStart(2, "0")}`,
            amount: amount.toFixed(2),
            status: "UNPAID",
            stage,
            dueDate,
            notes: `${installment.label} (${(installment.percentage * 100).toFixed(0)}%)`,
          })
          .returning();
        created.push(invoice);
      }
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "GENERATE_CLIENT_INVOICE_SCHEDULE",
        targetTable: "project",
        targetId: proj.id,
        newState: JSON.stringify(created),
      });
      return created;
    });
    revalidatePath(`/projects/${proj.id}`);
    return { success: true, data: schedule };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat jadwal invoice.";
    return {
      success: false,
      error: { code: message.includes("FORBIDDEN") ? "FORBIDDEN" : "TRANSACTION_FAILED", message },
    };
  }
}
