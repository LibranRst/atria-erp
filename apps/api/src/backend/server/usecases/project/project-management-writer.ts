import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  client,
  user,
  role,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectRap,
  projectCategoryPlanItem,
  rabEstimate,
  auditLog,
  projectProfitabilitySnapshot,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import {
  readBudgetCategoryUsageTx,
  syncProjectBudgetCategory,
} from "@backend/lib/budget/budget-sync";
import { readProjectClosingTx } from "./project-closing-context";
import {
  projectManagementInputSchema,
  projectManagementPermissions,
  projectManagementProposalSchema,
  resolveProjectAllocations,
  type ProjectManagementInput,
  type ProjectManagementProposal,
} from "@atria/core/ai/project-management";
import { getProjectActivationReadiness } from "@atria/core/project/activation-readiness";
import { calculateUsedPercentage, getBudgetCategoryStatus } from "@atria/core/budget/excel-budget";
import { fromCents, parseNumericToCents } from "@atria/core/finance/money-minor";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
export type ProjectManagementTx = FinanceTransaction;
export class ProjectManagementError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertProjectManagementRights(actor: Actor, input: ProjectManagementInput): void {
  if (
    !actor.isActive ||
    actor.dataScope === "NONE" ||
    projectManagementPermissions(input.action).some((p) => !actorCan(actor, p))
  )
    throw new ProjectManagementError(
      "FORBIDDEN",
      "Izin tindakan proyek atau budget tidak tersedia.",
    );
}
export async function lockManagedProjectTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
): Promise<typeof project.$inferSelect> {
  const [p] = await tx
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!p) throw new ProjectManagementError("NOT_FOUND", "Proyek tidak ditemukan.");
  if (
    actor.dataScope === "NONE" ||
    (actor.dataScope === "ASSIGNED" && p.projectManagerId !== actor.userId)
  )
    throw new ProjectManagementError("FORBIDDEN", "Proyek di luar akses Anda.");
  return p;
}
type Fact = ProjectManagementProposal["summary"][number];
type Row = ProjectManagementProposal["rows"][number];
const fact = (label: string, value: string | number, money = false): Fact => ({
  label,
  value,
  money,
});
const label = (value: string): string => formatBusinessLabel(value);
const dateText = (value: Date | null): string => value?.toISOString().slice(0, 10) ?? "Belum diisi";
export async function prepareProjectManagementTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: unknown,
): Promise<ProjectManagementProposal> {
  const parsed = projectManagementInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new ProjectManagementError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Isian tidak valid.",
    );
  const input = parsed.data;
  assertProjectManagementRights(actor, input);
  const p = await lockManagedProjectTx(tx, actor, input.projectId);
  const snapshot: unknown[] = [p];
  const blockers: string[] = [],
    warnings: string[] = [];
  let title = "Perubahan proyek",
    effect = "Memperbarui informasi proyek. Budget, stok dan kas tetap.",
    rows: Row[] = [],
    summary: Fact[] = [],
    budgetFacts: Fact[] | null = null;
  const currentBudget = (
    await tx
      .select()
      .from(projectBudgets)
      .where(
        and(eq(projectBudgets.projectId, p.id), eq(projectBudgets.tenantId, INSTANCE_TENANT_ID)),
      )
      .for("update")
  )[0];
  if (p.status === "COMPLETED" || p.status === "CANCELLED")
    blockers.push("Proyek yang selesai atau dibatalkan tidak dapat diubah langsung.");
  if (input.action === "EDIT_PROJECT") {
    const patch = input.patch;
    const beforeClient = await tx.query.client.findFirst({
      where: and(eq(client.id, p.clientId), eq(client.tenantId, INSTANCE_TENANT_ID)),
    });
    const afterClient = patch.clientId
      ? (
          await tx
            .select()
            .from(client)
            .where(and(eq(client.id, patch.clientId), eq(client.tenantId, INSTANCE_TENANT_ID)))
            .for("share")
        )[0]
      : beforeClient;
    if (!afterClient) throw new ProjectManagementError("NOT_FOUND", "Klien tidak ditemukan.");
    snapshot.push(beforeClient, afterClient);
    const start =
      patch.startDate === undefined ? dateText(p.startDate) : (patch.startDate ?? "Belum diisi");
    const end =
      patch.endDate === undefined ? dateText(p.endDate) : (patch.endDate ?? "Belum diisi");
    if (start !== "Belum diisi" && end !== "Belum diisi" && end < start)
      throw new ProjectManagementError(
        "VALIDATION_ERROR",
        "Tanggal selesai harus sama atau setelah tanggal mulai.",
      );
    const names: Record<keyof typeof patch, string> = {
      name: "Nama",
      clientId: "Klien",
      startDate: "Mulai",
      endDate: "Selesai",
      location: "Lokasi",
      roomArea: "Area",
      projectType: "Jenis proyek",
      notes: "Catatan",
    };
    const before: Record<keyof typeof patch, string> = {
      name: p.name,
      clientId: beforeClient?.name ?? "Klien",
      startDate: dateText(p.startDate),
      endDate: dateText(p.endDate),
      location: p.location ?? "Belum diisi",
      roomArea: p.roomArea ?? "Belum diisi",
      projectType: p.projectType ?? "Belum diisi",
      notes: p.notes ?? "Belum diisi",
    };
    const details: Fact[] = [];
    const fields: readonly (keyof typeof patch)[] = [
      "name",
      "clientId",
      "startDate",
      "endDate",
      "location",
      "roomArea",
      "projectType",
      "notes",
    ];
    for (const key of fields) {
      if (!Object.hasOwn(patch, key)) continue;
      const after = key === "clientId" ? afterClient.name : (patch[key] ?? "Belum diisi");
      details.push(
        fact(`${names[key]} · sebelumnya`, before[key]),
        fact(`${names[key]} · sesudah`, after),
      );
    }
    rows = [
      {
        id: p.id,
        title: patch.name ?? p.name,
        meta: "Koreksi informasi",
        amount: null,
        comparisons: [],
        details,
      },
    ];
  } else if (input.action === "ASSIGN_PM") {
    title = "Penugasan Project Manager";
    const [target] = await tx
      .select({ person: user, dataScope: role.dataScope })
      .from(user)
      .innerJoin(role, eq(role.id, user.roleId))
      .where(eq(user.id, input.projectManagerId))
      .for("share");
    if (!target?.person.isActive || target.dataScope !== "ASSIGNED")
      throw new ProjectManagementError(
        "VALIDATION_ERROR",
        "Pilih pengguna aktif dengan scope proyek ditugaskan.",
      );
    const previous = p.projectManagerId
      ? await tx.query.user.findFirst({ where: eq(user.id, p.projectManagerId) })
      : null;
    snapshot.push(target, previous);
    rows = [
      {
        id: p.id,
        title: p.name,
        meta: "Penanggung jawab proyek",
        amount: null,
        comparisons: [],
        details: [
          fact("Project Manager · sebelumnya", previous?.name ?? "Belum ditugaskan"),
          fact("Project Manager · sesudah", target.person.name),
        ],
      },
    ];
    effect =
      "Akses proyek berpindah ke PM yang dipilih sesuai permission perannya. Budget, stok dan kas tetap.";
  } else if (input.action === "ACTIVATE_PROJECT") {
    title = "Aktivasi proyek";
    const pm = p.projectManagerId
      ? await tx.query.user.findFirst({
          where: eq(user.id, p.projectManagerId),
          with: { role: true },
        })
      : null;
    const raps = await tx
      .select()
      .from(projectRap)
      .where(eq(projectRap.projectId, p.id))
      .orderBy(asc(projectRap.id))
      .for("update");
    const rabs = await tx
      .select()
      .from(rabEstimate)
      .where(eq(rabEstimate.projectId, p.id))
      .orderBy(asc(rabEstimate.id))
      .for("update");
    const readiness = getProjectActivationReadiness({
      projectStatus: p.status,
      projectManagerReady: Boolean(pm?.isActive && pm.role.dataScope === "ASSIGNED"),
      budgetStatus: currentBudget?.status,
      raps,
      rabEstimates: rabs,
    });
    snapshot.push(pm, currentBudget, raps, rabs);
    if (p.status !== "DRAFT") blockers.push("Hanya proyek Draft yang dapat diaktifkan.");
    const checks = [
      ["Project Manager aktif", readiness.projectManagerReady],
      ["Budget disetujui", readiness.budgetApproved],
      ["RAB klien disetujui", readiness.rabApproved],
      ["RAP terkait terkunci", readiness.rapLocked],
    ] as const;
    rows = checks.map(([name, ready]) => ({
      id: name,
      title: name,
      meta: ready ? "Siap" : "Belum siap",
      amount: null,
      comparisons: [],
      details: [],
    }));
    for (const [name, ready] of checks) if (!ready) blockers.push(`${name} belum terpenuhi.`);
    summary = [fact("Status · sebelumnya", label(p.status)), fact("Status · sesudah", "Aktif")];
    effect = "Mengaktifkan proyek setelah seluruh syarat terpenuhi. Stok dan kas tetap.";
  } else if (input.action === "COMPLETE_PROJECT") {
    title = "Penutupan proyek";
    const closing = await readProjectClosingTx(tx, p.id);
    snapshot.push(closing.fingerprint);
    blockers.push(...closing.checklist.blockers);
    const c = closing.checklist;
    summary = [fact("Status · sebelumnya", label(p.status)), fact("Status · sesudah", "Selesai")];
    rows = [
      {
        id: p.id,
        title: "Catatan penutupan",
        meta: input.closingNote,
        amount: null,
        comparisons: [],
        details: [],
      },
    ];
    budgetFacts = [
      fact("Nilai kontrak", c.contractValue, true),
      fact("Realisasi", c.actualCost, true),
      fact("Kas keluar", c.cashOutflow, true),
      fact("Penerimaan klien", c.clientReceipts, true),
      fact("Margin realisasi", c.realizedMargin, true),
      fact("Margin realisasi (%)", `${c.realizedMarginPercentage.toFixed(2)}%`),
      fact("Posisi kas proyek", c.cashPosition, true),
      fact("Pengecualian rekonsiliasi tercatat", c.documentedReconciliationExceptionCount),
    ];
    effect =
      "Menetapkan proyek selesai dan mencatat snapshot profitabilitas final. Tidak melakukan pembayaran atau pergerakan stok.";
  } else {
    if (!currentBudget || currentBudget.id !== input.projectBudgetId)
      throw new ProjectManagementError("NOT_FOUND", "Budget tidak termasuk proyek ini.");
    snapshot.push(currentBudget);
    const categories = await tx
      .select({
        category: projectBudgetCategory,
        name: expenseCategory.name,
        code: expenseCategory.code,
      })
      .from(projectBudgetCategory)
      .innerJoin(expenseCategory, eq(expenseCategory.id, projectBudgetCategory.expenseCategoryId))
      .where(
        and(
          eq(projectBudgetCategory.projectBudgetId, currentBudget.id),
          eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .orderBy(asc(projectBudgetCategory.sortOrder), asc(projectBudgetCategory.id))
      .for("update");
    const usage: Awaited<ReturnType<typeof readBudgetCategoryUsageTx>>[] = [];
    for (const { category } of categories)
      usage.push(await readBudgetCategoryUsageTx(tx, category.id));
    snapshot.push(categories, usage);
    if (
      input.action === "REALLOCATE_BUDGET" &&
      currentBudget.status === "APPROVED" &&
      !actorCan(actor, "approve:budget")
    )
      throw new ProjectManagementError(
        "FORBIDDEN",
        "Realokasi budget yang disetujui memerlukan izin persetujuan budget.",
      );
    if (input.action === "REALLOCATE_BUDGET" && currentBudget.status === "PENDING_APPROVAL")
      blockers.push(
        "Budget sedang menunggu keputusan. Selesaikan keputusan sebelum mengubah alokasi.",
      );
    let next: ReturnType<typeof resolveProjectAllocations>;
    try {
      next = resolveProjectAllocations(
        currentBudget.internalBudget,
        categories.map(({ category }) => category),
        input.action === "REALLOCATE_BUDGET" ? input.categories : [],
      );
    } catch (error: unknown) {
      throw new ProjectManagementError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Alokasi tidak valid.",
      );
    }
    const raps = await tx.query.projectRap.findMany({
      where: eq(projectRap.projectId, p.id),
      orderBy: [asc(projectRap.revision), asc(projectRap.id)],
      with: { items: true },
    });
    const packages = await tx.query.projectCategoryPlanItem.findMany({
      where: eq(projectCategoryPlanItem.projectId, p.id),
      orderBy: asc(projectCategoryPlanItem.id),
    });
    snapshot.push(raps, packages);
    const latestRap = raps.filter((r) => r.status !== "SUPERSEDED").at(-1);
    rows = categories.map(({ category, name, code }, index) => {
      const after = next[index],
        u = usage[index];
      const planned =
        code === "MATERIAL"
          ? (latestRap?.items ?? []).reduce((sum, r) => sum + Number(r.estimatedTotalCost), 0)
          : packages
              .filter(
                (r) =>
                  r.projectBudgetCategoryId === category.id &&
                  !["CANCELLED", "SUPERSEDED"].includes(r.status),
              )
              .reduce((sum, r) => sum + Number(r.estimatedTotalCost), 0);
      if (Number(after.allocatedAmount) < u.actualAmount)
        warnings.push(
          `${name}: alokasi di bawah realisasi sebesar Rp${(u.actualAmount - Number(after.allocatedAmount)).toLocaleString("id-ID")}.`,
        );
      if (Number(after.allocatedAmount) < planned)
        warnings.push(
          `${name}: rencana RAP/paket melebihi alokasi sebesar Rp${(planned - Number(after.allocatedAmount)).toLocaleString("id-ID")}.`,
        );
      return {
        id: category.id,
        title: name,
        meta: "Alokasi kategori",
        amount: Number(after.allocatedAmount),
        comparisons: [
          {
            label: "Alokasi",
            before: Number(category.allocatedAmount),
            after: Number(after.allocatedAmount),
            money: true,
          },
          {
            label: "Sisa budget",
            before: Number(category.allocatedAmount) - u.actualAmount,
            after: Number(after.allocatedAmount) - u.actualAmount,
            money: true,
          },
        ],
        details: [
          fact("Realisasi", u.actualAmount, true),
          fact("Menunggu tinjauan", u.pendingAmount, true),
          fact("Sudah dibayar", u.paidAmount, true),
          fact("Rencana RAP/paket", planned, true),
        ],
      };
    });
    const total = next.reduce((sum, r) => sum + parseNumericToCents(r.allocatedAmount), 0n);
    const actual = usage.reduce(
      (sum, r) => sum + parseNumericToCents(r.actualAmount.toFixed(2)),
      0n,
    );
    budgetFacts = [
      fact("Nilai kontrak", Number(currentBudget.contractValue), true),
      fact("Plafon internal", Number(currentBudget.internalBudget), true),
      fact("Total alokasi setelah tindakan", Number(fromCents(total)), true),
      fact(
        "Buffer belum dialokasikan",
        Number(fromCents(parseNumericToCents(currentBudget.internalBudget) - total)),
        true,
      ),
      fact("Realisasi", Number(fromCents(actual)), true),
      fact(
        "Sisa plafon",
        Number(fromCents(parseNumericToCents(currentBudget.internalBudget) - actual)),
        true,
      ),
      fact("Margin target", Number(currentBudget.targetGrossAmount), true),
      fact(
        "Margin dari realisasi",
        Number(fromCents(parseNumericToCents(currentBudget.contractValue) - actual)),
        true,
      ),
    ];
    title = {
      REALLOCATE_BUDGET: "Realokasi budget proyek",
      SUBMIT_BUDGET: "Pengajuan budget",
      APPROVE_BUDGET: "Persetujuan budget",
      REJECT_BUDGET: "Revisi budget",
    }[input.action];
    const required = input.action === "SUBMIT_BUDGET" ? "DRAFT" : "PENDING_APPROVAL";
    if (input.action !== "REALLOCATE_BUDGET" && currentBudget.status !== required)
      blockers.push(
        input.action === "SUBMIT_BUDGET"
          ? "Hanya budget Draft yang dapat diajukan."
          : "Budget tidak sedang menunggu persetujuan.",
      );
    summary =
      input.action === "REALLOCATE_BUDGET"
        ? [fact("Alasan", input.reason)]
        : [
            fact("Status · sebelumnya", label(currentBudget.status)),
            fact(
              "Status · sesudah",
              label(
                input.action === "SUBMIT_BUDGET"
                  ? "PENDING_APPROVAL"
                  : input.action === "APPROVE_BUDGET"
                    ? "APPROVED"
                    : "DRAFT",
              ),
            ),
            ...(input.action === "REJECT_BUDGET" ? [fact("Alasan revisi", input.reason)] : []),
          ];
    effect =
      "Memperbarui keputusan atau alokasi budget proyek. Realisasi, pembayaran, RAP, stok dan kas tetap.";
  }
  return projectManagementProposalSchema.parse({
    kind: "PROJECT_MANAGEMENT",
    action: input.action,
    input,
    projectId: p.id,
    title,
    entityName: p.name,
    meta: "Proyek dan budget",
    effect,
    rows,
    summary,
    budget: budgetFacts,
    blockers: [...new Set(blockers)],
    warnings,
    contextHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
  });
}
export async function prepareProjectManagementProposal(
  actor: Actor,
  raw: unknown,
): Promise<ProjectManagementProposal> {
  return db.transaction((tx) => prepareProjectManagementTx(tx, actor, raw));
}
export async function writeProjectManagementTx(
  tx: FinanceTransaction,
  actor: Actor,
  proposal: ProjectManagementProposal,
): Promise<string> {
  const fresh = await prepareProjectManagementTx(tx, actor, proposal.input);
  if (JSON.stringify(fresh) !== JSON.stringify(proposal))
    throw new ProjectManagementError(
      "CONFLICT",
      "Data proyek atau budget berubah. Minta preview terbaru.",
    );
  if (fresh.blockers.length)
    throw new ProjectManagementError("FORBIDDEN", fresh.blockers.join(" "));
  const input = fresh.input;
  const p = await lockManagedProjectTx(tx, actor, input.projectId);
  const currentBudget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, p.id),
  });
  let targetId = p.id;
  let action: string = input.action;
  if (input.action === "REALLOCATE_BUDGET") action = "REALLOCATE_PROJECT_BUDGET";
  if (input.action === "SUBMIT_BUDGET") action = "SUBMIT_CANONICAL_PROJECT_BUDGET";
  if (input.action === "APPROVE_BUDGET") action = "APPROVE_CANONICAL_PROJECT_BUDGET";
  if (input.action === "REJECT_BUDGET") action = "REJECT_CANONICAL_PROJECT_BUDGET";
  if (input.action === "EDIT_PROJECT") {
    const patch = input.patch;
    await tx
      .update(project)
      .set({
        ...patch,
        startDate:
          patch.startDate === undefined
            ? p.startDate
            : patch.startDate
              ? new Date(patch.startDate)
              : null,
        endDate:
          patch.endDate === undefined ? p.endDate : patch.endDate ? new Date(patch.endDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(project.id, p.id));
    action = "UPDATE_PROJECT";
  } else if (input.action === "ASSIGN_PM") {
    await tx
      .update(project)
      .set({ projectManagerId: input.projectManagerId, updatedAt: new Date() })
      .where(eq(project.id, p.id));
    action = "ASSIGN_PROJECT_MANAGER";
  } else if (input.action === "ACTIVATE_PROJECT") {
    await tx
      .update(project)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(project.id, p.id));
  } else if (input.action === "COMPLETE_PROJECT") {
    if (!currentBudget)
      throw new ProjectManagementError("NOT_FOUND", "Budget proyek tidak ditemukan.");
    const categories = await tx.query.projectBudgetCategory.findMany({
      where: eq(projectBudgetCategory.projectBudgetId, currentBudget.id),
      with: { expenseCategory: true },
    });
    for (const category of categories)
      await syncProjectBudgetCategory({ tx, projectBudgetCategoryId: category.id });
    const c = (await readProjectClosingTx(tx, p.id)).checklist;
    const material = categories.find((r) => r.expenseCategory.code === "MATERIAL");
    const materialUsage = material ? await readBudgetCategoryUsageTx(tx, material.id) : null;
    const used = calculateUsedPercentage(c.actualCost, Number(currentBudget.internalBudget));
    await tx.insert(projectProfitabilitySnapshot).values({
      projectId: p.id,
      projectBudgetId: currentBudget.id,
      contractValue: c.contractValue.toFixed(2),
      approvedRabValue: currentBudget.approvedRabValue,
      internalBudget: currentBudget.internalBudget,
      actualCost: c.actualCost.toFixed(2),
      remainingBudget: (Number(currentBudget.internalBudget) - c.actualCost).toFixed(2),
      budgetUsedPercentage: used.toFixed(4),
      targetGrossAmount: currentBudget.targetGrossAmount,
      targetGrossPercentage: currentBudget.targetGrossPercentage,
      projectedFinalCost: c.actualCost.toFixed(2),
      projectedMarginAmount: c.realizedMargin.toFixed(2),
      projectedMarginPercentage: c.realizedMarginPercentage.toFixed(4),
      realizedMarginAmount: c.realizedMargin.toFixed(2),
      realizedMarginPercentage: c.realizedMarginPercentage.toFixed(4),
      cashPosition: c.cashPosition.toFixed(2),
      snapshotType: "FINAL",
      materialBudget: material?.allocatedAmount ?? "0.00",
      materialActual: materialUsage?.actualAmount.toFixed(2) ?? "0.00",
      materialRemaining: (
        Number(material?.allocatedAmount ?? 0) - (materialUsage?.actualAmount ?? 0)
      ).toFixed(2),
      materialUsedPercentage: calculateUsedPercentage(
        materialUsage?.actualAmount ?? 0,
        Number(material?.allocatedAmount ?? 0),
      ).toFixed(4),
      riskStatus: c.realizedMargin >= 0 ? "SAFE" : "CRITICAL",
    });
    await tx
      .update(project)
      .set({ status: "COMPLETED", endDate: new Date(), updatedAt: new Date() })
      .where(eq(project.id, p.id));
  } else {
    if (!currentBudget) throw new ProjectManagementError("NOT_FOUND", "Budget tidak ditemukan.");
    targetId = currentBudget.id;
    if (input.action === "REALLOCATE_BUDGET") {
      const categories = await tx.query.projectBudgetCategory.findMany({
        where: eq(projectBudgetCategory.projectBudgetId, currentBudget.id),
      });
      const next = resolveProjectAllocations(
        currentBudget.internalBudget,
        categories,
        input.categories,
      );
      for (const change of input.categories) {
        const row = next.find((r) => r.id === change.projectBudgetCategoryId);
        if (!row) throw new ProjectManagementError("CONFLICT", "Kategori tidak ditemukan.");
        const usage = await readBudgetCategoryUsageTx(tx, row.id);
        const used = calculateUsedPercentage(usage.actualAmount, Number(row.allocatedAmount));
        await tx
          .update(projectBudgetCategory)
          .set({
            allocatedAmount: row.allocatedAmount,
            ratioPercentage: row.ratioPercentage,
            remainingAmount: (Number(row.allocatedAmount) - usage.actualAmount).toFixed(2),
            actualAmount: usage.actualAmount.toFixed(2),
            pendingAmount: usage.pendingAmount.toFixed(2),
            paidAmount: usage.paidAmount.toFixed(2),
            usedPercentage: used.toFixed(4),
            status: getBudgetCategoryStatus(used),
            isManualOverride: true,
            updatedAt: new Date(),
          })
          .where(eq(projectBudgetCategory.id, row.id));
      }
      await tx
        .update(projectBudgets)
        .set({ updatedAt: new Date() })
        .where(eq(projectBudgets.id, currentBudget.id));
    } else {
      const status =
        input.action === "SUBMIT_BUDGET"
          ? "PENDING_APPROVAL"
          : input.action === "APPROVE_BUDGET"
            ? "APPROVED"
            : "DRAFT";
      await tx
        .update(projectBudgets)
        .set({
          status,
          approvedById: status === "APPROVED" ? actor.userId : null,
          approvedAt: status === "APPROVED" ? new Date() : null,
          notes:
            input.action === "REJECT_BUDGET"
              ? `${currentBudget.notes ?? ""}\nRevisi diminta: ${input.reason}`.trim()
              : currentBudget.notes,
          updatedAt: new Date(),
        })
        .where(eq(projectBudgets.id, currentBudget.id));
    }
  }
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action,
    targetTable: targetId === p.id ? "project" : "project_budgets",
    targetId,
    originalState: JSON.stringify({ project: p, budget: currentBudget }),
    newState: JSON.stringify({ input, reviewed: fresh }),
  });
  if (input.action !== "EDIT_PROJECT" && input.action !== "REALLOCATE_BUDGET")
    await recordNotificationEvent(tx, {
      referenceType: targetId === p.id ? "project" : "project_budget",
      referenceId: targetId,
      projectId: p.id,
      stage: `${input.action}:${crypto.randomUUID()}`,
      title: fresh.title,
      message: p.name,
      permission:
        input.action === "SUBMIT_BUDGET"
          ? "approve:budget"
          : input.action === "REJECT_BUDGET"
            ? "update:budget"
            : "view:project",
      actionUrl: `/projects/${p.id}`,
      actorId: actor.userId,
      ...(input.action === "ASSIGN_PM" ? { recipients: [input.projectManagerId] } : {}),
      ...(input.action === "SUBMIT_BUDGET" ? { actionRequired: true } : {}),
    });
  return targetId;
}
