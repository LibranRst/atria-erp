import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";

/**
 * Kanvas isi untuk route Expo Router dengan `presentation: "formSheet"`.
 * Presentasi dan gesture penutupan tetap dimiliki native stack.
 *
 * `react-native-screens` di iOS memaksa ulang frame ScrollView setiap sheet
 * berganti detent, tapi HANYA jika ScrollView itu anak langsung dari native
 * content wrapper milik screen (lihat `RNSScreenContentWrapper.mm`,
 * `childRCTScrollViewComponentAndContentContainer`). Kalau ScrollView
 * dibungkus `View` lain, koreksi itu tidak pernah ditemukan — ScrollView tetap
 * memakai frame lama dari detent awal, dan isinya terlihat hilang saat sheet
 * digeser ke full-height. Karena itu `ScrollView` di sini SENGAJA jadi elemen
 * root, bukan dibungkus `View`. Jangan bungkus lagi tanpa membuktikan
 * transisi detent di simulator.
 */
export function BottomSheet({
  children,
  description,
  scrollProps,
  style,
  title,
}: {
  readonly children: React.ReactNode;
  readonly description?: string;
  readonly scrollProps?: Omit<ScrollViewProps, "children">;
  readonly style?: StyleProp<ViewStyle>;
  readonly title?: string;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      {...scrollProps}
      style={[styles.canvas, style, scrollProps?.style]}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          paddingTop: Math.max(insets.top, theme.spacing.sm),
        },
        scrollProps?.contentContainerStyle,
      ]}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={false}
    >
      {title || description ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: theme.colors.surfaceContainerLow },
  header: { gap: theme.spacing.base, paddingHorizontal: theme.spacing.base },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
  content: { gap: theme.spacing.md, paddingHorizontal: theme.spacing.md },
});
