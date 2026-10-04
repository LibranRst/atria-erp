import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { screenLoadState, type ScreenQuerySnapshot } from "@/lib/screen-query-state";
import { useOnline } from "@/lib/use-screen-query";
import { ScreenMessage } from "./screen-state";
import { theme } from "@/theme";

export function ScreenQueryState({
  query,
  skeleton,
  onRetry,
}: {
  readonly query: ScreenQuerySnapshot;
  readonly skeleton: ReactNode;
  readonly onRetry: () => void;
}): React.JSX.Element {
  const state = screenLoadState(query, useOnline());
  if (state === "restricted")
    return (
      <ScreenMessage
        icon="lock"
        title="Akses dibatasi"
        description="Akses akun berubah atau sesi berakhir. Periksa akses lalu coba lagi."
        onAction={onRetry}
      />
    );
  if (state === "offline")
    return (
      <ScreenMessage
        title="Perangkat sedang offline"
        description="Belum ada data tersimpan untuk halaman ini. Hubungkan ke internet lalu coba lagi."
        onAction={onRetry}
      />
    );
  if (state === "error")
    return (
      <ScreenMessage
        title="Data belum tersedia"
        description="Periksa koneksi lalu coba lagi."
        onAction={onRetry}
      />
    );
  return <>{skeleton}</>;
}

export function ScreenRefreshNotice({
  query,
}: {
  readonly query: ScreenQuerySnapshot;
}): React.JSX.Element | null {
  const online = useOnline();
  const text = !online
    ? "Offline · Menampilkan data terakhir."
    : query.error
      ? "Pembaruan belum berhasil · Menampilkan data terakhir."
      : query.fetchStatus === "fetching"
        ? "Memperbarui data…"
        : query.dataUpdatedAt
          ? `Diperbarui ${new Date(query.dataUpdatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`
          : null;
  // Reserve one compact line so background refresh doesn't move content.
  return (
    <Text
      accessible={Boolean(text)}
      accessibilityLiveRegion="polite"
      numberOfLines={1}
      style={styles.notice}
    >
      {text ?? " "}
    </Text>
  );
}
const styles = StyleSheet.create({
  notice: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
});
