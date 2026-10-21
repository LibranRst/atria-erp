import { createHash } from "node:crypto";
import { db } from "@backend/db";
import { materialMaster, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { and, eq } from "drizzle-orm";
import { addProjectRapItemSchema } from "@atria/core/validations/rap-rab";
import { calculateRapMaterialCost } from "@atria/core/project/rap-cost";
import { resolveRapTemplate } from "../material/rap-template-writer";
import { sumRapAmounts } from "@atria/core/project/rap-cost";
import { randomUUID } from "node:crypto";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  readSetupContext,
  buildSetupBudget,
  SetupError,
  type SetupContext,
} from "./rap-finalization-context";
import {
  lifecyclePermissions,
  lifecycleProposalSchema,
  type LifecycleInput,
  type LifecycleProposal,
} from "@atria/core/ai/rap-lifecycle";
type LifecycleContext = SetupContext & { additions: LifecycleProposal["materialRows"] };
export async function readLifecycleContext(
  actor: Pick<Actor, "permissions" | "dataScope" | "userId">,
  projectId: string,
  connection: Pick<typeof db, "query"> = db,
  input?: LifecycleInput,
): Promise<LifecycleContext> {
  const context = await readSetupContext(actor, projectId, connection);
  const additions: LifecycleProposal["materialRows"] = [];
  const references: unknown[] = [];
  if (input?.action === "ADD_MATERIAL") {
    if (lifecyclePermissions(input).some((p) => !actorCan(actor, p)))
      throw new SetupError("FORBIDDEN", "Izin input Material RAP diperlukan.");
    for (const row of input.rows) {
      if (row.sourceKind === "LIBRARY") {
        const resolved = await resolveRapTemplate(
          { ...row, projectRapId: context.records.rap.id },
          connection,
        );
        references.push(resolved.template, resolved.material);
        additions.push({
          rowId: context.records.rap.id,
          values: resolved.values,
          libraryId: resolved.libraryId,
          clientUnitPrice: resolved.clientUnitPrice,
        });
      } else {
        const values = addProjectRapItemSchema.parse({
          ...row,
          projectRapId: context.records.rap.id,
        });
        if (values.materialId) {
          const material = await connection.query.materialMaster.findFirst({
            where: and(
              eq(materialMaster.id, values.materialId),
              eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
            ),
          });
          if (!material?.isActive || material.unit !== values.unit)
            throw new SetupError(
              "VALIDATION_ERROR",
              "Material aktif dengan satuan yang sama diperlukan. Jangan mengonversi otomatis.",
            );
          references.push(material);
        }
        additions.push({
          rowId: context.records.rap.id,
          values,
          libraryId: null,
          clientUnitPrice: null,
        });
      }
    }
  }
  return {
    ...context,
    additions,
    fingerprint: additions.length
      ? createHash("sha256")
          .update(JSON.stringify({ base: context.fingerprint, references }))
          .digest("hex")
      : context.fingerprint,
  };
}

export function buildLifecycleProposal(
  actor: Pick<Actor, "permissions" | "dataScope" | "userId">,
  input: LifecycleInput,
  context: LifecycleContext,
  previous?: LifecycleProposal,
): LifecycleProposal {
  if (lifecyclePermissions(input).some((p) => !actorCan(actor, p)))
    throw new SetupError("FORBIDDEN", "Izin untuk tindakan RAP tidak tersedia.");
  const rap = context.records.rap;
  const rows: LifecycleProposal["rows"] = [];
  const nextId = (id: string): string =>
    previous?.rows.find((r) => r.id === id)?.nextId ?? randomUUID();
  if (input.action === "REVISION") {
    if (rap.status !== "LOCKED")
      throw new SetupError(
        "CONFLICT",
        "Revisi membutuhkan RAP terkunci terbaru. Gunakan draft revisi yang tersedia.",
      );
    rows.push({
      id: rap.id,
      action: "REVISION",
      category: "MATERIAL",
      name: `RAP revisi ${rap.revision + 1}`,
      detail: input.reviseMaterial
        ? `${context.records.items.length} item Material disalin ke draft untuk dikoreksi.`
        : "Baseline Material dipertahankan pada draft RAP agar paket terpilih dapat dikoreksi.",
      beforeStatus: "LOCKED",
      afterStatus: "DRAFT",
      estimate: sumRapAmounts(context.records.items.map((i) => i.estimatedTotalCost)),
      revision: rap.revision + 1,
      nextId: previous?.nextRapId ?? randomUUID(),
    });
    for (const id of input.packageIds) {
      const p = context.records.state.packages.find((r) => r.id === id);
      const source = context.records.packages.find((r) => r.id === id);
      if (!p || !source || !["ACTIVE", "LOCKED"].includes(p.status))
        throw new SetupError("CONFLICT", "Pilih paket Siap/terkunci terbaru untuk direvisi.");
      rows.push({
        id,
        action: "REVISION",
        category: p.category,
        name: p.snapshot.name,
        detail: `${p.snapshot.area || "Tanpa area"} · ${p.snapshot.quantity} ${p.snapshot.unit} · ${p.snapshot.scopeDescription || "Tanpa rincian lingkup"}`,
        beforeStatus: p.status === "ACTIVE" ? "ACTIVE" : "LOCKED",
        afterStatus: "DRAFT",
        estimate: p.snapshot.estimatedTotalCost,
        revision: source.revision + 1,
        nextId: nextId(id),
      });
    }
  } else if (input.action === "PACKAGE_CHANGES") {
    if (rap.status !== "DRAFT")
      throw new SetupError(
        "CONFLICT",
        "RAP terkunci memerlukan revisi sebelum paket dapat dikoreksi atau dihapus.",
      );
    for (const change of input.rows) {
      const p = context.records.state.packages.find((r) => r.id === change.itemId);
      const source = context.records.packages.find((r) => r.id === change.itemId);
      if (!p || !source || p.status !== (change.action === "REOPEN" ? "ACTIVE" : "DRAFT"))
        throw new SetupError(
          "CONFLICT",
          "Edit Lagi hanya untuk paket Siap; hapus hanya untuk paket Draft terbaru.",
        );
      rows.push({
        id: p.id,
        action: change.action,
        category: p.category,
        name: p.snapshot.name,
        detail: `${p.snapshot.area || "Tanpa area"} · ${p.snapshot.quantity} ${p.snapshot.unit} · ${p.snapshot.scopeDescription || "Tanpa rincian lingkup"}`,
        beforeStatus: change.action === "REOPEN" ? "ACTIVE" : "DRAFT",
        afterStatus: change.action === "DELETE" ? "DELETED" : "DRAFT",
        estimate: p.snapshot.estimatedTotalCost,
        revision: source.revision,
        nextId: null,
      });
    }
  }
  if (input.action === "ADD_MATERIAL") {
    if (rap.status !== "DRAFT")
      throw new SetupError("CONFLICT", "Material hanya ditambahkan pada RAP Draft terbaru.");
    for (const [index, addition] of context.additions.entries()) {
      const values = addition.values,
        cost = calculateRapMaterialCost(values),
        id = previous?.materialRows[index]?.rowId ?? randomUUID();
      addition.rowId = id;
      rows.push({
        id,
        nextId: id,
        action: "ADD",
        category: "MATERIAL",
        name: values.name,
        detail: `${values.area} · ${new Intl.NumberFormat("id-ID").format(Number(cost.totalQuantity))} ${values.unit} · ${addition.libraryId ? "Harga dari Item & Price Library" : "Estimasi dari pengguna"}${input.rows[index].sourceKind === "LIBRARY" && input.rows[index].overrideReason ? ` · Alasan override: ${input.rows[index].overrideReason}` : ""}`,
        beforeStatus: "NEW",
        afterStatus: "DRAFT",
        estimate: Number(cost.estimatedTotalCost),
        revision: rap.revision,
      });
    }
  }
  const budget = buildSetupBudget(context);
  if (input.action === "PACKAGE_CHANGES") {
    for (const category of budget.categories) {
      const removed = sumRapAmounts(
        rows
          .filter((r) => r.action === "DELETE" && r.category === category.code)
          .map((r) => r.estimate.toFixed(2)),
      );
      if (category.planned !== null) {
        category.planned = sumRapAmounts([category.planned.toFixed(2), (-removed).toFixed(2)]);
        category.overAllocation = Math.max(
          0,
          sumRapAmounts([category.planned.toFixed(2), (-category.allocated).toFixed(2)]),
        );
      }
    }
    budget.planTotal = sumRapAmounts([
      budget.planTotal.toFixed(2),
      ...rows.filter((r) => r.action === "DELETE").map((r) => (-r.estimate).toFixed(2)),
    ]);
  }
  if (input.action === "ADD_MATERIAL") {
    const addition = sumRapAmounts(rows.map((r) => r.estimate.toFixed(2)));
    budget.planTotal = sumRapAmounts([budget.planTotal.toFixed(2), addition.toFixed(2)]);
    const material = budget.categories.find((c) => c.code === "MATERIAL");
    if (!material) throw new SetupError("VALIDATION_ERROR", "Alokasi Material belum tersedia.");
    material.planned = sumRapAmounts([(material.planned ?? 0).toFixed(2), addition.toFixed(2)]);
    material.overAllocation = Math.max(
      0,
      sumRapAmounts([material.planned.toFixed(2), (-material.allocated).toFixed(2)]),
    );
  }
  return lifecycleProposalSchema.parse({
    kind: "RAP_LIFECYCLE",
    projectId: context.project.id,
    projectName: context.project.name,
    projectRapId: rap.id,
    expectedContext: context.fingerprint,
    request: input,
    nextRapId: input.action === "REVISION" ? rows[0].nextId : null,
    rows,
    materialRows: context.additions,
    budget,
  });
}
