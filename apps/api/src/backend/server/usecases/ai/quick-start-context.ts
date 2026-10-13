import { createHash } from "node:crypto";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  appConfig,
  client,
  user,
  role,
  tenantMember,
  rolePermission,
  materialInventory,
  inventoryOpeningBatch,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  quickStartInputSchema,
  quickStartProposalSchema,
  quickStartLabels,
  type QuickStartInput,
  type QuickStartProposal,
} from "@atria/core/ai/quick-start";
import { OWNER_ONBOARDING_CONFIG_KEY } from "@atria/core/onboarding/owner-onboarding";
import { OWNER_ONBOARDING_V2_CONFIG_KEY } from "@atria/core/onboarding/organization-setup";
import {
  assertQuickStartActorTx,
  lockQuickStartState,
  lockedQuickStartDefaultsTx,
  validateQuickStartProjectTx,
  assertNoLegacyStockTx,
  QuickStartError,
  type QuickStartTx,
} from "../onboarding/quick-start-writer";

export async function prepareQuickStartTx(
  tx: QuickStartTx,
  actor: Actor,
  raw: QuickStartInput,
): Promise<QuickStartProposal> {
  const input = quickStartInputSchema.parse(raw);
  await assertQuickStartActorTx(tx, actor, input, true);
  const locked = await lockQuickStartState(tx),
    state = locked.state;
  const configs = await tx.query.appConfig.findMany({
    where: and(
      eq(appConfig.tenantId, INSTANCE_TENANT_ID),
      inArray(appConfig.key, [OWNER_ONBOARDING_V2_CONFIG_KEY, OWNER_ONBOARDING_CONFIG_KEY]),
    ),
    orderBy: asc(appConfig.key),
  });
  const comparisons: QuickStartProposal["comparisons"] = [],
    facts: QuickStartProposal["facts"] = [],
    categories: QuickStartProposal["categories"] = [];
  let title = "Setup awal",
    effect = "Hanya progres setup yang berubah. Budget, stok dan kas tetap.",
    changed = true;
  let source: unknown = null;
  if (
    input.action !== "STOCK_DECISION" &&
    (state.status === "COMPLETED" || ("stepId" in input && state.currentStep !== input.stepId))
  )
    throw new QuickStartError(
      "CONFLICT",
      state.status === "COMPLETED"
        ? "Quick Start sudah selesai. Buat proyek berikutnya melalui alur proyek biasa."
        : "Tahap setup berubah. Periksa posisi setup dan minta preview terbaru.",
    );
  const stepLabel = quickStartLabels.step[state.currentStep];
  if (input.action === "ADVANCE") {
    title = "Lanjutkan setup";
    if (input.stepId === "financial_defaults") {
      const defaults = await lockedQuickStartDefaultsTx(tx);
      source = defaults;
      facts.push(
        { label: "Default budget", value: defaults.settingName ?? "Default perusahaan" },
        {
          label: "Plafon internal",
          value: `${Number((defaults.budgetCapRatio * 100).toFixed(4))}% dari nilai proyek`,
        },
      );
      for (const c of defaults.categories)
        facts.push({
          label: c.name,
          value: `${Number((c.ratioPercentage * 100).toFixed(4))}% dari plafon internal`,
        });
    }
    comparisons.push({
      label: "Tahap setup",
      before: stepLabel,
      after:
        quickStartLabels.step[input.stepId === "welcome" ? "financial_defaults" : "first_project"],
    });
    if (state.status === "PAUSED")
      comparisons.push({ label: "Progres", before: "Ditunda", after: "Berjalan" });
    effect =
      input.stepId === "financial_defaults"
        ? "Mencatat bahwa Anda sudah meninjau default finansial. Nilai Settings tidak diubah."
        : effect;
  } else if (input.action === "PAUSE" || input.action === "RESUME") {
    title = input.action === "PAUSE" ? "Tunda setup" : "Lanjutkan setup yang ditunda";
    const next = input.action === "PAUSE" ? "PAUSED" : "IN_PROGRESS";
    changed = state.status !== next;
    comparisons.push({
      label: "Progres",
      before: quickStartLabels.status[state.status],
      after: quickStartLabels.status[next],
    });
    facts.push({ label: "Tahap tetap", value: stepLabel });
    effect = "Tahap dan isian setup dipertahankan. Tidak ada langkah yang dilewati.";
  } else if (input.action === "RETRY") {
    title = "Coba kembali tahap setup";
    facts.push({ label: "Tahap", value: stepLabel });
    effect =
      "Mencatat percobaan ulang tahap ini. Tidak membuat ulang proyek atau mengulangi transaksi bisnis.";
  } else if (input.action === "STOCK_DECISION") {
    title = "Kesiapan stok awal";
    if (input.decision === "NO_LEGACY_STOCK" && state.initialStockDecision !== input.decision)
      await assertNoLegacyStockTx(tx);
    changed = state.initialStockDecision !== input.decision;
    comparisons.push({
      label: "Keputusan stok awal",
      before: quickStartLabels.decision[state.initialStockDecision],
      after: quickStartLabels.decision[input.decision],
    });
    const stock = await tx.query.materialInventory.findMany({
      where: eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
      columns: { id: true, currentStock: true, reservedStock: true },
      orderBy: asc(materialInventory.id),
    });
    const opening = await tx.query.inventoryOpeningBatch.findMany({
      where: eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
      columns: { id: true, status: true, updatedAt: true },
      orderBy: asc(inventoryOpeningBatch.id),
    });
    source = { stock, opening };
    effect =
      input.decision === "HAS_LEGACY_STOCK"
        ? "Keputusan dicatat. Saldo awal tetap perlu diajukan dan disetujui melalui alur stok awal; jumlah stok dan kas belum berubah."
        : input.decision === "SKIPPED"
          ? "Kesiapan stok belum lengkap. Gerakan stok operasional tetap mengikuti pemeriksaan kesiapan yang berlaku."
          : "Mencatat pernyataan Anda bahwa tidak ada stok lama. Tidak menambah jumlah stok atau mengubah kas.";
  } else {
    title = input.project.name;
    if (state.currentStep !== "first_project")
      throw new QuickStartError(
        "CONFLICT",
        "Tinjau default finansial dahulu sebelum membuat proyek pertama.",
      );
    const defaults = await lockedQuickStartDefaultsTx(tx),
      refs = await validateQuickStartProjectTx(tx, input.project);
    const internal = Number(
      (input.project.totalContractValue * defaults.budgetCapRatio).toFixed(2),
    );
    const clientSource = input.project.clientId
      ? await tx.query.client.findFirst({ where: eq(client.id, input.project.clientId) })
      : null;
    const managerSource = input.project.projectManagerId
      ? await tx.query.user.findFirst({
          where: eq(user.id, input.project.projectManagerId),
          columns: { id: true, name: true, roleId: true, isActive: true, updatedAt: true },
        })
      : null;
    source = { defaults, clientSource, managerSource };
    facts.push(
      { label: "Klien", value: refs.clientName },
      { label: "Project Manager", value: refs.managerName },
      { label: "Nilai proyek", value: input.project.totalContractValue, money: true },
      { label: "RAB disetujui", value: input.project.approvedRabValue, money: true },
      { label: "Budget internal", value: internal, money: true },
      { label: "Default budget", value: defaults.settingName ?? "Default perusahaan" },
      {
        label: "Target margin",
        value: `${Number(((1 - defaults.budgetCapRatio) * 100).toFixed(4))}%`,
      },
    );
    for (const c of defaults.categories)
      categories.push({
        id: c.expenseCategoryId,
        name: c.name,
        ratio: c.ratioPercentage,
        amount: Number((internal * c.ratioPercentage).toFixed(2)),
      });
    const unallocated =
      (Math.round(internal * 100) -
        categories.reduce((sum, category) => sum + Math.round(category.amount * 100), 0)) /
      100;
    if (unallocated > 0)
      facts.push({ label: "Belum dialokasikan", value: unallocated, money: true });
    comparisons.push({ label: "Tahap setup", before: stepLabel, after: "Selesai" });
    effect =
      "Membuat satu proyek Draft beserta budget kategori dari Settings, lalu menyelesaikan Quick Start. Tidak membuat dokumen RAB, pengeluaran, pergerakan stok atau transaksi kas.";
  }
  const contextHash = createHash("sha256")
    .update(
      JSON.stringify({
        configs,
        state: {
          status: state.status,
          currentStep: state.currentStep,
          reviewedSteps: state.reviewedSteps,
          firstProjectId: state.firstProjectId,
          initialStockDecision: state.initialStockDecision,
        },
        source,
        input,
      }),
    )
    .digest("hex");
  return quickStartProposalSchema.parse({
    kind: "QUICK_START",
    input,
    title,
    changed,
    contextHash,
    comparisons,
    facts,
    categories,
    effect,
  });
}
export async function prepareQuickStart(
  actor: Actor,
  input: QuickStartInput,
): Promise<QuickStartProposal> {
  return db.transaction((tx) => prepareQuickStartTx(tx, actor, input));
}
export async function getQuickStartContext(
  actor: Actor,
  input: { resource: "setup" | "clients" | "managers"; query?: string; offset: number },
): Promise<unknown> {
  return db.transaction(async (tx) => {
    await assertQuickStartActorTx(tx, actor, null, true);
    if (input.resource !== "setup") {
      await assertQuickStartActorTx(
        tx,
        actor,
        {
          action: "CREATE_PROJECT",
          project: {
            name: "lookup",
            newClientName: "lookup",
            projectManagerId: null,
            totalContractValue: 1,
            approvedRabValue: 1,
          },
        },
        true,
      );
      const rows =
        input.resource === "clients"
          ? await tx.query.client.findMany({
              where: and(
                eq(client.tenantId, INSTANCE_TENANT_ID),
                input.query ? ilike(client.name, `%${input.query}%`) : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(client.name), asc(client.id)],
              limit: 21,
              offset: input.offset,
            })
          : await tx
              .select({ id: user.id, name: user.name })
              .from(user)
              .innerJoin(role, eq(role.id, user.roleId))
              .innerJoin(
                tenantMember,
                and(
                  eq(tenantMember.userId, user.id),
                  eq(tenantMember.tenantId, INSTANCE_TENANT_ID),
                  eq(tenantMember.roleId, user.roleId),
                ),
              )
              .where(
                and(
                  eq(user.isActive, true),
                  eq(tenantMember.isActive, true),
                  eq(role.dataScope, "ASSIGNED"),
                  input.query ? ilike(user.name, `%${input.query}%`) : undefined,
                ),
              )
              .orderBy(asc(user.name), asc(user.id))
              .limit(21)
              .offset(input.offset);
      return {
        items: rows.slice(0, 20),
        hasMore: rows.length > 20,
        nextOffset: rows.length > 20 ? input.offset + 20 : null,
      };
    }
    const locked = await lockQuickStartState(tx);
    let financial: unknown = { status: "restricted" };
    const settings = await tx.query.rolePermission.findFirst({
      where: and(
        eq(rolePermission.roleId, actor.roleId),
        eq(rolePermission.permissionKey, "view:settings"),
      ),
    });
    if (actorCan(actor, "view:settings") && settings) {
      try {
        financial = { status: "ready", ...(await lockedQuickStartDefaultsTx(tx)) };
      } catch (e: unknown) {
        financial = {
          status: "blocked",
          message: e instanceof QuickStartError ? e.message : "Default belum dapat diperiksa.",
        };
      }
    }
    const state = locked.state;
    return {
      status: quickStartLabels.status[state.status],
      step: quickStartLabels.step[state.currentStep],
      stepId: state.status === "COMPLETED" ? undefined : state.currentStep,
      initialStockDecision: quickStartLabels.decision[state.initialStockDecision],
      firstProjectId: actorCan(actor, "view:project") ? state.firstProjectId : null,
      financial,
      canManageProgress: actorCan(actor, "manage:onboarding") && state.status !== "COMPLETED",
      instruction:
        "Ikuti tahap tersimpan. Mintalah nama/klien/nilai kontrak/RAB disetujui untuk proyek pertama; PM opsional. Default finansial hanya ditinjau di sini, perubahan memakai tool Settings terpisah. Keputusan stok manusia; jumlah/saldo awal menggunakan alur gudang. ProposeQuickStart hanya preview, tombol manusia menyimpan. Setup selesai tidak diulang/reset.",
    };
  });
}
