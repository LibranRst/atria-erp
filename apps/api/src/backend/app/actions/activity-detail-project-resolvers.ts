import { eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  moneyValue,
  quantityValue,
  textValue,
  type ActivityDetailView,
} from "@atria/core/activity-detail/types";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  fact,
  latestAudit,
  requireProject,
  statusTone,
  type ActivityUser,
} from "./activity-detail-resolver-utils";
export async function resolveRabRevision(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.rabEstimate.findFirst({
    where: (table) => eq(table.id, id),
    with: { project: true, supersedes: true, voidedBy: true, items: true, bundles: true },
  });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  const audit = await latestAudit("rab_estimate", row.id);
  const currentValue = Number(row.approvedValue);
  const previousValue = row.supersedes ? Number(row.supersedes.approvedValue) : null;
  return {
    kind: "RAB_REVISION",
    id: row.id,
    title: `${row.title} · R${row.revision}`,
    subtitle: row.project.name,
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: (row.approvedAt ?? row.voidedAt ?? row.createdAt).toISOString(),
    actorName: row.voidedBy?.name ?? audit?.actorName ?? "Sistem",
    facts: [
      fact("Revisi", quantityValue(row.revision)),
      fact("Nilai RAB", moneyValue(currentValue)),
      fact(
        "Baris client",
        quantityValue(
          row.items.filter((item) => !item.isHidden).length +
            row.bundles.filter((bundle) => !bundle.isHidden).length,
          "baris",
        ),
      ),
    ],
    comparisons:
      previousValue === null
        ? []
        : [
            {
              label: "Nilai kontrak",
              before: moneyValue(previousValue),
              after: moneyValue(currentValue),
            },
          ],
    impacts: [
      fact(
        "Perubahan nilai",
        moneyValue(previousValue === null ? 0 : currentValue - previousValue),
      ),
      fact("Client", textValue("Hanya data client-safe yang ditampilkan")),
    ],
    notes: [
      fact("Catatan client", textValue(row.clientNotes?.trim() || "Tidak ada catatan")),
      ...(row.voidReason ? [fact("Alasan dibatalkan", textValue(row.voidReason))] : []),
    ],
    source: { label: "Buka RAB proyek", href: `/projects/${row.projectId}?tab=rab` },
    evidenceIncomplete: audit === null,
  };
}

export async function resolveChangeOrder(
  id: string,
  user: ActivityUser,
  roleName: string,
): Promise<ActivityDetailView | null> {
  const row = await db.query.projectChangeOrder.findFirst({
    where: (table) => eq(table.id, id),
    with: { project: true, baseRab: true, revisedRab: true, createdBy: true, approvedBy: true },
  });
  if (!row) return null;
  await requireProject(row.projectId, user, roleName);
  return {
    kind: "CHANGE_ORDER",
    id: row.id,
    title: `Change Order R${row.baseRab.revision} → R${row.revisedRab.revision}`,
    subtitle: row.project.name,
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: (row.approvedAt ?? row.createdAt).toISOString(),
    actorName: row.approvedBy?.name ?? row.createdBy.name,
    facts: [
      fact("Pengaju", textValue(row.createdBy.name)),
      ...(row.approvedBy ? [fact("Approver", textValue(row.approvedBy.name))] : []),
      ...(row.clientConfirmationReference
        ? [fact("Konfirmasi client", textValue(row.clientConfirmationReference))]
        : []),
    ],
    comparisons: [
      {
        label: "Nilai kontrak",
        before: moneyValue(Number(row.previousContractValue)),
        after: moneyValue(Number(row.revisedContractValue)),
      },
    ],
    impacts: [
      fact("Perubahan kontrak", moneyValue(Number(row.valueDelta))),
      fact(
        "Status konfirmasi client",
        textValue(row.clientConfirmedAt ? "Sudah dikonfirmasi" : "Belum dikonfirmasi"),
      ),
    ],
    notes: [
      fact("Alasan", textValue(row.reason)),
      fact("Ringkasan scope", textValue(row.scopeSummary)),
    ],
    source: { label: "Buka RAB proyek", href: `/projects/${row.projectId}?tab=rab` },
    evidenceIncomplete: false,
  };
}

export async function resolveApproval(id: string): Promise<ActivityDetailView | null> {
  const row = await db.query.approval.findFirst({
    where: (table) => eq(table.id, id),
    with: { approver: true },
  });
  if (!row) return null;
  return {
    kind: "APPROVAL_DECISION",
    id: row.id,
    title: "Keputusan persetujuan",
    subtitle: formatBusinessLabel(row.referenceType),
    status: row.status,
    statusTone: statusTone(row.status),
    occurredAt: row.createdAt.toISOString(),
    actorName: row.approver.name,
    facts: [fact("Jenis sumber", textValue(formatBusinessLabel(row.referenceType)))],
    comparisons: [],
    impacts: [
      fact(
        "Keputusan",
        textValue(
          row.status === "APPROVED"
            ? "Transaksi dapat dilanjutkan ke tahap berikutnya"
            : "Transaksi dihentikan atau dikembalikan untuk perbaikan",
        ),
      ),
    ],
    notes: [
      fact(
        "Alasan keputusan",
        textValue(row.notes?.trim() || "Alasan keputusan belum tercatat pada data lama"),
      ),
    ],
    source: null,
    evidenceIncomplete: !row.notes,
  };
}
