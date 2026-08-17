import { db } from "@/db";
import { auditLog, clientInvoice, project } from "@/db/schema";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { resolveRoleName } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import { getServerSession } from "@/lib/server/session";
import { eq, sql } from "drizzle-orm";

type ProjectBudgetTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BudgetActionUser = {
  readonly id: string;
  readonly roleId: string;
};

export async function getBudgetActionSession(
  unauthorizedMessage: string,
): Promise<ActionResponse<{ user: BudgetActionUser; roleName: string }>> {
  const session = await getServerSession();

  if (!session?.user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: unauthorizedMessage },
    };
  }

  const roleName = await resolveRoleName(session.user.roleId);
  return {
    success: true,
    data: {
      user: {
        id: session.user.id,
        roleId: session.user.roleId,
      },
      roleName,
    },
  };
}

export async function assertScopedProjectBudgetAccess(
  projectId: string,
  user: BudgetActionUser,
  roleName: string,
): Promise<void> {
  await assertProjectAccess(projectId, user.id, roleName);
}

export function forbiddenResponse(message: string): ActionResponse<never> {
  return {
    success: false,
    error: { code: "FORBIDDEN", message },
  };
}

export function internalServerErrorResponse<T>(error: unknown): ActionResponse<T> {
  return {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
    },
  };
}

export async function createApprovalInvoicesIfNeededTx(
  tx: ProjectBudgetTx,
  args: {
    readonly projectId: string;
    readonly userId: string;
  },
): Promise<void> {
  const projectData = await tx.query.project.findFirst({
    where: eq(project.id, args.projectId),
  });

  if (!projectData) return;

  const contractValue = Number(projectData.totalContractValue);
  const existingInvoicesCount = await tx
    .select({ count: sql<number>`count(*)` })
    .from(clientInvoice)
    .where(eq(clientInvoice.projectId, args.projectId));
  const hasInvoices = Number(existingInvoicesCount[0]?.count ?? 0) > 0;

  if (hasInvoices || contractValue <= 0) return;

  const globalCountResult = await tx.select({ count: sql<number>`count(*)` }).from(clientInvoice);
  const nextIndex = Number(globalCountResult[0]?.count ?? 0) + 1;
  const seqStr = nextIndex.toString().padStart(3, "0");
  const year = new Date().getFullYear();

  const stages = [
    {
      stage: "DP",
      pct: 0.3,
      days: 7,
      desc: "Down Payment (DP) 30% otomatis terbit setelah RAB disetujui",
    },
    {
      stage: "PROGRESS_1",
      pct: 0.5,
      days: 30,
      desc: "Termin Progress 50% otomatis terbit setelah RAB disetujui",
    },
    {
      stage: "PELUNASAN",
      pct: 0.2,
      days: 60,
      desc: "Termin Pelunasan 20% otomatis terbit setelah RAB disetujui",
    },
  ] as const;

  for (const stage of stages) {
    const invoiceAmt = contractValue * stage.pct;
    const due = new Date();
    due.setDate(due.getDate() + stage.days);

    const [newInvoice] = await tx
      .insert(clientInvoice)
      .values({
        projectId: args.projectId,
        invoiceNumber: `INV/${year}/${seqStr}-${stage.stage}`,
        amount: invoiceAmt.toFixed(2),
        status: "UNPAID",
        stage: stage.stage,
        dueDate: due,
        notes: stage.desc,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await tx.insert(auditLog).values({
      userId: args.userId,
      action: "AUTO_CREATE_CLIENT_INVOICE",
      targetTable: "client_invoice",
      targetId: newInvoice.id,
      originalState: null,
      newState: JSON.stringify({
        projectId: args.projectId,
        invoiceNumber: newInvoice.invoiceNumber,
        amount: invoiceAmt.toFixed(2),
        stage: stage.stage,
        dueDate: due,
      }),
      createdAt: new Date(),
    });
  }
}
