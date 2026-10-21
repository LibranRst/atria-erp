import { StyleSheet, Text, View } from "react-native";
import {
  BottomSheet,
  Button,
  DetailSkeleton,
  GroupedSurface,
  type DetailSkeletonKind,
} from "@/components/ui";
import { screenLoadState, type ScreenQuerySnapshot } from "@/lib/screen-query-state";
import { useOnline } from "@/lib/use-screen-query";
import { theme } from "@/theme";

export function DetailQueryState({
  query,
  title,
  onRetry,
  onClose,
  kind,
}: {
  readonly query: ScreenQuerySnapshot;
  readonly title: string;
  readonly onRetry: () => void;
  readonly onClose: () => void;
  readonly kind: DetailSkeletonKind;
}): React.JSX.Element {
  const state = screenLoadState(query, useOnline());
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      contentPhase={state === "loading" ? "loading" : "ready"}
    >
      {state === "loading" ? (
        <DetailSkeleton kind={kind} />
      ) : (
        <GroupedSurface>
          <View style={styles.message}>
            <Text style={styles.title}>
              {state === "restricted"
                ? "Akses dibatasi"
                : state === "offline"
                  ? "Perangkat sedang offline"
                  : "Detail belum dapat dimuat"}
            </Text>
            <Text style={styles.description}>
              {state === "restricted"
                ? "Akses akun berubah atau sesi berakhir. Periksa akses untuk melanjutkan."
                : "Periksa koneksi, lalu coba lagi. Data detail belum tersedia pada perangkat ini."}
            </Text>
            <Button variant="secondary" onPress={onRetry}>
              Coba lagi
            </Button>
          </View>
        </GroupedSurface>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: { padding: theme.spacing.md, gap: theme.spacing.sm },
  title: { color: theme.colors.onSurface, fontFamily: theme.fonts.bold, ...theme.typography.row },
  description: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
  },
});
