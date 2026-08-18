import { formatBusinessLabel } from "./business-labels";

export type StatusBadgeTone =
  "healthy" | "warning" | "critical" | "pending" | "completed" | "neutral" | "inactive";

export type StatusPresentation = {
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

export type BadgeStatus =
  | "ACTIVE"
  | "APPROVED"
  | "AVAILABLE"
  | "CANCELLED"
  | "COMPLETED"
  | "CONSUMED"
  | "CRITICAL"
  | "DISCARDED"
  | "DRAFT"
  | "FAILED"
  | "HEALTHY"
  | "INACTIVE"
  | "INCOMPLETE"
  | "IN_PROGRESS"
  | "LOCKED"
  | "LOW_STOCK"
  | "NOT_APPLICABLE"
  | "OUT_OF_STOCK"
  | "OVER_BUDGET"
  | "OVERDUE"
  | "PAID"
  | "PARTIALLY_PAID"
  | "PAUSED"
  | "PENDING"
  | "PENDING_APPROVAL"
  | "POSTED"
  | "PRIMARY"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "RESERVED"
  | "REVERSED"
  | "REVERSAL_REQUESTED"
  | "SAFE"
  | "SHORTAGE"
  | "SKIPPED"
  | "SUBMITTED"
  | "SUBMITTING"
  | "SUPERSEDED"
  | "UNPAID"
  | "VERIFIED"
  | "VOID"
  | "WAITING_PURCHASE"
  | "WARNING"
  | "WATCH";

export type BadgeVariant = StatusBadgeTone;

const statusPresentation: Record<BadgeStatus, StatusPresentation> = {
  ACTIVE: { label: "Aktif", tone: "healthy" },
  APPROVED: { label: "Disetujui", tone: "completed" },
  AVAILABLE: { label: "Tersedia", tone: "healthy" },
  CANCELLED: { label: "Dibatalkan", tone: "inactive" },
  COMPLETED: { label: "Selesai", tone: "completed" },
  CONSUMED: { label: "Digunakan", tone: "completed" },
  CRITICAL: { label: "Kritis", tone: "critical" },
  DISCARDED: { label: "Dibuang", tone: "inactive" },
  DRAFT: { label: "Draf", tone: "inactive" },
  FAILED: { label: "Gagal", tone: "critical" },
  HEALTHY: { label: "Sehat", tone: "healthy" },
  INACTIVE: { label: "Tidak aktif", tone: "inactive" },
  INCOMPLETE: { label: "Belum lengkap", tone: "warning" },
  IN_PROGRESS: { label: "Berlangsung", tone: "pending" },
  LOCKED: { label: "Terkunci", tone: "neutral" },
  LOW_STOCK: { label: "Stok menipis", tone: "warning" },
  NOT_APPLICABLE: { label: "Tidak berlaku", tone: "inactive" },
  OUT_OF_STOCK: { label: "Stok habis", tone: "critical" },
  OVER_BUDGET: { label: "Melebihi budget", tone: "critical" },
  OVERDUE: { label: "Jatuh tempo", tone: "critical" },
  PAID: { label: "Lunas", tone: "completed" },
  PARTIALLY_PAID: { label: "Dibayar sebagian", tone: "pending" },
  PAUSED: { label: "Dijeda", tone: "inactive" },
  PENDING: { label: "Menunggu", tone: "pending" },
  PENDING_APPROVAL: { label: "Menunggu persetujuan", tone: "pending" },
  POSTED: { label: "Tercatat", tone: "completed" },
  PRIMARY: { label: "Utama", tone: "neutral" },
  PROCESSING: { label: "Diproses", tone: "pending" },
  READY: { label: "Siap", tone: "healthy" },
  REJECTED: { label: "Ditolak", tone: "critical" },
  RESERVED: { label: "Direservasi", tone: "neutral" },
  REVERSED: { label: "Dibalik", tone: "inactive" },
  REVERSAL_REQUESTED: { label: "Pembalikan diminta", tone: "pending" },
  SAFE: { label: "Aman", tone: "healthy" },
  SHORTAGE: { label: "Kekurangan", tone: "warning" },
  SKIPPED: { label: "Dilewati", tone: "inactive" },
  SUBMITTED: { label: "Diajukan", tone: "pending" },
  SUBMITTING: { label: "Mengajukan", tone: "pending" },
  SUPERSEDED: { label: "Digantikan", tone: "inactive" },
  UNPAID: { label: "Belum lunas", tone: "warning" },
  VERIFIED: { label: "Terverifikasi", tone: "completed" },
  VOID: { label: "Dibatalkan", tone: "inactive" },
  WAITING_PURCHASE: { label: "Menunggu pembelian", tone: "warning" },
  WARNING: { label: "Perlu perhatian", tone: "warning" },
  WATCH: { label: "Perlu dipantau", tone: "warning" },
};

export function getStatusPresentation(status: BadgeStatus): StatusPresentation {
  return statusPresentation[status];
}

function isBadgeStatus(status: string): status is BadgeStatus {
  return Object.hasOwn(statusPresentation, status);
}

export function resolveStatusPresentation(status: string): StatusPresentation {
  if (isBadgeStatus(status)) return getStatusPresentation(status);
  return { label: formatBusinessLabel(status), tone: "neutral" };
}
