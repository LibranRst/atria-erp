export type DashboardDataStatus = {
  readonly kind: "PARTIAL" | "STALE";
  readonly label: string;
  readonly accessibleLabel: string;
  readonly icon: "data_alert" | "history";
};

type ResolveDashboardDataStatusInput = {
  readonly generatedAt: string | Date;
  readonly currentTime: Date;
  readonly partial: boolean;
  readonly unavailableSources: readonly string[];
  readonly refreshing: boolean;
};

const STALE_AFTER_MINUTES = 15;

export function resolveDashboardDataStatus({
  generatedAt,
  currentTime,
  partial,
  unavailableSources,
  refreshing,
}: ResolveDashboardDataStatusInput): DashboardDataStatus | null {
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const minutesOld = Math.max(
    0,
    Math.floor((currentTime.getTime() - generatedDate.getTime()) / 60_000),
  );
  const generatedTime = generatedDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  if (partial) {
    const sourceDetail =
      unavailableSources.length > 0
        ? ` Sumber belum tersedia: ${unavailableSources.join(", ")}.`
        : "";
    return {
      kind: "PARTIAL",
      label: refreshing ? "Memperbarui…" : "Data sebagian",
      accessibleLabel: refreshing
        ? "Memperbarui data Dashboard"
        : `Sebagian data Dashboard belum tersedia.${sourceDetail}`,
      icon: "data_alert",
    };
  }

  if (minutesOld < STALE_AFTER_MINUTES) return null;

  return {
    kind: "STALE",
    label: refreshing ? "Memperbarui…" : `Belum diperbarui · ${generatedTime}`,
    accessibleLabel: refreshing
      ? "Memperbarui data Dashboard"
      : `Data Dashboard belum diperbarui sejak pukul ${generatedTime}`,
    icon: "history",
  };
}
