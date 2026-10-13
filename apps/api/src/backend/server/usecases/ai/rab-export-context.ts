import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  client,
  project,
  rabEstimate,
  rabEstimateItem,
  rabEstimateBundle,
  tenant,
  user,
  role,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { RabReviewError } from "./rab-context";
import {
  rabExportInputSchema,
  rabExportProposalSchema,
  rabPrintableSchema,
  rabExportTotal,
  type RabExportInput,
  type RabExportProposal,
  type RabExportView,
  type RabPrintableEstimate,
} from "@atria/core/ai/rab-export";

export function assertRabExportRights(
  actor: Pick<Actor, "permissions" | "dataScope" | "isActive">,
): void {
  if (
    !actor.isActive ||
    actor.dataScope === "NONE" ||
    !(["use:ai_chat", "view:project", "view:rab"] as const).every((p) =>
      actor.permissions.includes(p),
    )
  )
    throw new RabReviewError("FORBIDDEN", "Akses chat, proyek dan RAB diperlukan untuk ekspor.");
}
export async function readRabExport(
  actor: Actor,
  raw: RabExportInput,
  issuedAt: string,
): Promise<{ proposal: RabExportProposal; document: NonNullable<RabExportView["document"]> }> {
  assertRabExportRights(actor);
  const input = rabExportInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    const liveUser = await tx.query.user.findFirst({ where: eq(user.id, actor.userId) });
    const access = liveUser?.roleId
      ? await tx.query.role.findFirst({
          where: eq(role.id, liveUser.roleId),
          with: { permissions: true },
        })
      : null;
    if (!liveUser?.isActive || !access)
      throw new RabReviewError("FORBIDDEN", "Akun atau akses Anda berubah.");
    const scope = access.dataScope;
    const keys = access.permissions.map((p) => p.permissionKey);
    if (
      (scope !== "GLOBAL" && scope !== "ASSIGNED") ||
      !["use:ai_chat", "view:project", "view:rab"].every((p) => keys.includes(p))
    )
      throw new RabReviewError("FORBIDDEN", "Izin ekspor RAB tidak tersedia atau telah berubah.");
    const [p] = await tx
      .select()
      .from(project)
      .where(and(eq(project.id, input.projectId), eq(project.tenantId, INSTANCE_TENANT_ID)))
      .for("share");
    if (!p || (scope !== "GLOBAL" && p.projectManagerId !== actor.userId))
      throw new RabReviewError("FORBIDDEN", "Proyek di luar akses Anda.");
    const [r] = await tx
      .select()
      .from(rabEstimate)
      .where(
        and(
          eq(rabEstimate.id, input.rabEstimateId),
          eq(rabEstimate.projectId, p.id),
          eq(rabEstimate.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .for("share");
    if (!r) throw new RabReviewError("NOT_FOUND", "Revisi RAB pada proyek ini tidak ditemukan.");
    if (r.status !== "DRAFT" && r.status !== "APPROVED")
      throw new RabReviewError(
        "CONFLICT",
        "RAB dibatalkan atau belum dapat diekspor. Pilih revisi Draft atau Disetujui.",
      );
    const items = await tx
      .select()
      .from(rabEstimateItem)
      .where(
        and(
          eq(rabEstimateItem.rabEstimateId, r.id),
          eq(rabEstimateItem.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .orderBy(asc(rabEstimateItem.displayOrder), asc(rabEstimateItem.id))
      .for("share");
    const bundles = await tx
      .select()
      .from(rabEstimateBundle)
      .where(
        and(
          eq(rabEstimateBundle.rabEstimateId, r.id),
          eq(rabEstimateBundle.tenantId, INSTANCE_TENANT_ID),
        ),
      )
      .orderBy(asc(rabEstimateBundle.displayOrder), asc(rabEstimateBundle.id))
      .for("share");
    if (items.length > 1000 || bundles.length > 1000)
      throw new RabReviewError(
        "CONFLICT",
        "Dokumen melebihi 1.000 baris. Pecah lingkup RAB sebelum ekspor.",
      );
    const [c] = await tx
      .select()
      .from(client)
      .where(and(eq(client.id, p.clientId), eq(client.tenantId, INSTANCE_TENANT_ID)))
      .for("share");
    const [company] = await tx
      .select()
      .from(tenant)
      .where(eq(tenant.id, INSTANCE_TENANT_ID))
      .for("share");
    if (!c || !company)
      throw new RabReviewError("NOT_FOUND", "Data klien atau perusahaan tidak tersedia.");
    const visibleBundles = bundles.filter((b) => !b.isHidden);
    const visibleIds = new Set(visibleBundles.map((b) => b.id));
    const line = (
      i: (typeof items)[number] | (typeof bundles)[number],
    ): RabPrintableEstimate["bundles"][number] => ({
      id: i.id,
      clientLabel: i.clientLabel,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      isHidden: false,
      displayOrder: i.displayOrder,
    });
    const estimate = rabPrintableSchema.parse({
      id: r.id,
      status: r.status,
      revision: r.revision,
      title: r.title,
      clientNotes: r.clientNotes,
      approvedValue: r.approvedValue,
      bundles: visibleBundles.map(line),
      items: items
        .filter((i) => !i.isHidden && (!i.bundleId || visibleIds.has(i.bundleId)))
        .map((i) => {
          if (i.itemNature !== "PRODUCTION" && i.itemNature !== "SERVICE_FEE")
            throw new RabReviewError(
              "CONFLICT",
              "Jenis baris RAB tidak dikenali. Periksa RAB proyek.",
            );
          return {
            ...line(i),
            itemNature: i.itemNature,
            bundleId: i.bundleId,
            ...(i.bundleId ? { unitPrice: "0.00", lineTotal: "0.00" } : {}),
          };
        }),
    });
    const rowCount = estimate.bundles.length + estimate.items.filter((i) => !i.bundleId).length;
    if (!rowCount)
      throw new RabReviewError(
        "CONFLICT",
        "Belum ada baris yang tampil untuk klien. Lengkapi RAB sebelum ekspor.",
      );
    const total = rabExportTotal(estimate);
    if (r.status === "APPROVED" && Number(r.approvedValue) !== Number(total))
      throw new RabReviewError(
        "CONFLICT",
        "Total revisi disetujui tidak konsisten. Periksa RAB sebelum ekspor.",
      );
    const meta = {
      projectName: p.name,
      projectAddress: p.location ?? "",
      clientName: c.name,
      clientPhone: c.phone ?? "",
      clientAddress: c.address ?? "",
      companyName: company.name,
      date: new Date(issuedAt).toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
    const document = { estimate, meta };
    const expectedContext = createHash("sha256")
      .update(
        JSON.stringify({
          document,
          source: {
            project: p.updatedAt,
            rab: r.updatedAt,
            client: c.updatedAt,
            items: items.map((i) => [i.id, i.updatedAt, i.isHidden, i.bundleId]),
            bundles: bundles.map((b) => [b.id, b.updatedAt, b.isHidden]),
          },
        }),
      )
      .digest("hex");
    const proposal = rabExportProposalSchema.parse({
      kind: "RAB_EXPORT",
      input,
      expectedContext,
      projectName: p.name,
      clientName: c.name,
      title: r.title,
      revision: r.revision,
      status: r.status,
      total,
      rowCount,
      issuedAt,
    });
    return { proposal, document };
  });
}
export async function prepareRabExport(
  actor: Actor,
  input: RabExportInput,
): Promise<RabExportProposal> {
  return (await readRabExport(actor, input, new Date().toISOString())).proposal;
}
