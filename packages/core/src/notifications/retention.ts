export const ACTION_REQUIRED_RESOLVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari
export const INFORMATIONAL_READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

export interface NotificationRetentionCandidate {
  readonly category: "ACTION_REQUIRED" | "INFORMATIONAL" | string;
  readonly read: boolean;
  readonly isResolved: boolean;
  readonly resolvedAt?: Date | string | null;
  readonly readAt?: Date | string | null;
  readonly createdAt: Date | string;
}

/**
 * Memeriksa apakah suatu notifikasi masih aktif dan layak ditampilkan
 * berdasarkan aturan retensi Atria ERP:
 * 1. ACTION_REQUIRED: Selalu aktif jika isResolved=false. Jika isResolved=true, hanya aktif selama 30 hari.
 * 2. INFORMATIONAL: Selalu aktif jika read=false. Jika read=true, hanya aktif selama 30 hari.
 */
export function isNotificationActive(
  item: NotificationRetentionCandidate,
  now: Date = new Date(),
): boolean {
  const nowMs = now.getTime();
  const createdMs =
    item.createdAt instanceof Date ? item.createdAt.getTime() : new Date(item.createdAt).getTime();

  if (item.category === "ACTION_REQUIRED") {
    // Jika aksi belum diselesaikan, selalu aktif tanpa memandang status sudah dibaca atau belum
    if (!item.isResolved) {
      return true;
    }

    // Jika sudah diselesaikan, hanya bertahan selama 30 hari sejak waktu penyelesaian
    const resolvedMs = item.resolvedAt
      ? item.resolvedAt instanceof Date
        ? item.resolvedAt.getTime()
        : new Date(item.resolvedAt).getTime()
      : createdMs;

    return nowMs - resolvedMs <= ACTION_REQUIRED_RESOLVED_RETENTION_MS;
  }

  // Kategori INFORMATIONAL atau default lainnya
  // Jika belum dibaca, selalu aktif
  if (!item.read) {
    return true;
  }

  // Jika sudah dibaca, hanya bertahan selama 30 hari sejak dibaca (baris lama memakai waktu dibuat)
  const readMs = item.readAt ? new Date(item.readAt).getTime() : createdMs;
  return nowMs - readMs <= INFORMATIONAL_READ_RETENTION_MS;
}
