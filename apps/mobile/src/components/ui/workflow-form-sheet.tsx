import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent, ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/theme";

/**
 * `react-native-screens` di iOS memaksa ulang frame ScrollView setiap sheet
 * berganti detent, tapi HANYA jika ScrollView itu anak langsung dari native
 * content wrapper milik screen (lihat `RNSScreenContentWrapper.mm`,
 * `childRCTScrollViewComponentAndContentContainer`). Kalau ScrollView
 * dibungkus `View` lain, koreksi itu tidak pernah ditemukan — ScrollView tetap
 * memakai frame lama dari detent awal, dan isinya terlihat hilang saat sheet
 * digeser ke full-height.
 *
 * Karena itu tidak ada `View` pembungkus di sini: `ScrollView` dan footer
 * SENGAJA jadi elemen bersaudara langsung (lewat Fragment), dengan ScrollView
 * sebagai anak pertama — itu satu-satunya susunan yang dikenali library ini
 * (`ScrollView` di indeks 0 mendapat ukuran penuh kontainer). Footer memakai
 * `position: "absolute"` supaya tetap melayang di bawah tanpa jadi anak
 * ketiga yang merusak deteksi itu; tingginya diukur lewat `onLayout` untuk
 * menyisakan padding bawah yang tepat di ScrollView. Jangan bungkus ulang
 * tanpa membuktikan transisi detent di simulator.
 */
export function WorkflowFormSheet({
  children,
  description,
  footer,
  scrollProps,
  title,
}: {
  readonly children: React.ReactNode;
  readonly description: string;
  readonly footer: React.ReactNode;
  readonly scrollProps?: Omit<ScrollViewProps, "children">;
  readonly title: string;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);

  const onFooterLayout = (event: LayoutChangeEvent): void => {
    setFooterHeight(event.nativeEvent.layout.height);
  };

  return (
    <>
      <ScrollView
        {...scrollProps}
        style={[styles.canvas, scrollProps?.style]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, theme.spacing.md),
            paddingBottom: footerHeight + theme.spacing.md,
          },
          scrollProps?.contentContainerStyle,
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        {children}
      </ScrollView>
      <View
        onLayout={onFooterLayout}
        style={[
          styles.footer,
          styles.footerFloating,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
        ]}
      >
        {footer}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: theme.colors.surfaceContainerLow },
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  header: { gap: theme.spacing.base, paddingHorizontal: theme.spacing.base },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    letterSpacing: -0.45,
    ...theme.typography.title,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
  footer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceContainerLow,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  footerFloating: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
