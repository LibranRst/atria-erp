import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { AppIcon, type AppIconName } from "./app-icon";
import { theme } from "@/theme";

export type IconTileTone = "neutral" | "attention" | "critical" | "inverse";

const toneStyle: Record<IconTileTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: theme.colors.surfaceContainerLow, color: theme.colors.onSurface },
  attention: {
    backgroundColor: theme.colors.warningContainer,
    color: theme.colors.warningOnContainer,
  },
  critical: { backgroundColor: theme.colors.criticalContainer, color: theme.colors.critical },
  inverse: { backgroundColor: theme.opacityColors.white10, color: theme.colors.onSurfaceInverse },
};

/**
 * Tile identitas dengan ikon outline — dipakai untuk kartu keputusan, kategori,
 * dan baris berulang yang butuh penanda ikon. Selalu datar (Nested-Stays-Flat):
 * jangan tambahkan `boxShadow` di sini.
 */
export function DuotoneIconTile({
  iconSize = 20,
  name,
  style,
  tone = "neutral",
}: {
  readonly iconSize?: number;
  readonly name: AppIconName | string;
  readonly style?: StyleProp<ViewStyle>;
  readonly tone?: IconTileTone;
}): React.JSX.Element {
  const colors = toneStyle[tone];
  return (
    <View style={[styles.tile, { backgroundColor: colors.backgroundColor }, style]}>
      <AppIcon color={colors.color} name={name} size={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
  },
});
