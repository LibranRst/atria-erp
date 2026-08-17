export type DashboardDataStatus = {
  readonly kind: "OFFLINE" | "PARTIAL" | "REFRESH_FAILED";
  readonly title: string;
  readonly description: string;
  readonly accessibleLabel: string;
  readonly icon: "cloud_off" | "data_alert" | "sync_problem";
  readonly retryable: boolean;
};

type ResolveDashboardDataStatusInput = {
  readonly generatedAt: string | Date;
  readonly partial: boolean;
  readonly unavailableSources: readonly string[];
  readonly online: boolean;
  readonly refreshFailed: boolean;
  readonly refreshing: boolean;
};

export function resolveDashboardDataStatus({
  generatedAt,
  partial,
  unavailableSources,
  online,
  refreshFailed,
  refreshing,
}: ResolveDashboardDataStatusInput): DashboardDataStatus | null {
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const generatedTime = generatedDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  if (!online) {
    return {
      kind: "OFFLINE",
      title: "Koneksi terputus",
      description: `Menampilkan data terakhir dari pukul ${generatedTime}. Akan diperbarui saat online.`,
      accessibleLabel: `Koneksi terputus. Menampilkan data Dashboard terakhir dari pukul ${generatedTime}.`,
      icon: "cloud_off",
      retryable: false,
    };
  }

  if (partial) {
    const sourceDetail =
      unavailableSources.length > 0
        ? `Belum termuat: ${unavailableSources.join(", ")}.`
        : "Beberapa sumber pendukung belum termuat.";
    return {
      kind: "PARTIAL",
      title: refreshing ? "Memperbarui data…" : "Sebagian data belum termuat",
      description: refreshing ? "Mencoba memuat kembali sumber pendukung." : sourceDetail,
      accessibleLabel: refreshing
        ? "Memperbarui data Dashboard yang belum lengkap"
        : `Sebagian data Dashboard belum tersedia. ${sourceDetail}`,
      icon: "data_alert",
      retryable: true,
    };
  }

  if (refreshFailed) {
    return {
      kind: "REFRESH_FAILED",
      title: refreshing ? "Memperbarui data…" : "Data belum berhasil diperbarui",
      description: refreshing
        ? "Mengambil posisi finansial terbaru."
        : `Masih menampilkan data dari pukul ${generatedTime}.`,
      accessibleLabel: refreshing
        ? "Memperbarui data Dashboard"
        : `Data Dashboard belum berhasil diperbarui. Masih menampilkan data dari pukul ${generatedTime}.`,
      icon: "sync_problem",
      retryable: true,
    };
  }

  return null;
}
