import { Host } from "@expo/ui";
import {
  Button as NativeButton,
  HStack,
  Image,
  ProgressView,
  RNHostView,
  Text,
} from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHint as nativeHint,
  accessibilityLabel as nativeLabel,
  accessibilityValue,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  contentShape,
  disabled as nativeDisabled,
  font,
  frame,
  lineLimit,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Platform, StyleSheet, View } from "react-native";
import type { ButtonProps } from "./button.types";
import { useButtonSize } from "./button-size-context";
import { theme } from "@/theme";

export type { ButtonProps, ButtonSize, ButtonVariant } from "./button.types";

export function Button({
  children,
  leading,
  trailing,
  trailingSystemImage,
  loading = false,
  disabled = false,
  variant = "primary",
  size,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
}: ButtonProps): React.JSX.Element {
  const unavailable = disabled || loading;
  const resolvedSize = useButtonSize(size);
  const compact = resolvedSize === "compact";
  const sheet = resolvedSize === "sheet";
  const leadingSize = sheet ? 24 : 20;
  const modern = Number.parseInt(String(Platform.Version), 10) >= 26;
  const nativeStyle =
    variant === "ghost" || variant === "section"
      ? "plain"
      : variant === "secondary"
        ? modern
          ? "glass"
          : "bordered"
        : modern
          ? "glassProminent"
          : "borderedProminent";
  return (
    <View style={[compact && styles.compactPlacement, style]}>
      <Host
        matchContents={{ vertical: true, horizontal: compact }}
        ignoreSafeArea="all"
        colorScheme="light"
        seedColor={theme.colors.accent}
        style={compact ? styles.compactHost : styles.host}
      >
        <NativeButton
          onPress={unavailable ? undefined : onPress}
          role={variant === "danger" ? "destructive" : "default"}
          testID={testID}
          modifiers={[
            buttonStyle(nativeStyle),
            buttonBorderShape("capsule"),
            controlSize(sheet ? "large" : "regular"),
            tint(
              variant === "danger"
                ? theme.colors.critical
                : variant === "section"
                  ? theme.colors.onSurfaceVariant
                  : theme.colors.accent,
            ),
            nativeDisabled(unavailable),
            frame({ minWidth: 48, minHeight: 48 }),
            contentShape(shapes.rectangle()),
            accessibilityElement("ignore"),
            nativeLabel(accessibilityLabel ?? children),
            ...(accessibilityHint ? [nativeHint(accessibilityHint)] : []),
            ...(loading ? [accessibilityValue("Sedang memproses")] : []),
            ...(accessibilityState?.selected ? [accessibilityAddTraits(["isSelected"])] : []),
          ]}
        >
          <HStack
            spacing={variant === "section" ? 4 : 6}
            modifiers={
              compact
                ? [
                    padding({ horizontal: variant === "section" ? 0 : 8 }),
                    frame({ minWidth: 32, minHeight: 26 }),
                    contentShape(shapes.rectangle()),
                  ]
                : [frame({ maxWidth: Infinity, minHeight: sheet ? 22 : 30 })]
            }
          >
            {loading ? (
              <ProgressView />
            ) : leading ? (
              <HStack modifiers={[frame({ width: leadingSize, height: leadingSize })]}>
                <RNHostView matchContents>
                  <View
                    pointerEvents="none"
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.leading, { width: leadingSize, height: leadingSize }]}
                  >
                    {leading}
                  </View>
                </RNHostView>
              </HStack>
            ) : null}
            <Text
              modifiers={[
                font({
                  textStyle: sheet ? "body" : compact ? "footnote" : "subheadline",
                  weight: "semibold",
                }),
                lineLimit(1),
              ]}
            >
              {children}
            </Text>
            {trailingSystemImage ? (
              <Image
                systemName={trailingSystemImage}
                size={variant === "section" ? 11 : 13}
                color={theme.colors.onSurfaceVariant}
                modifiers={[frame({ width: variant === "section" ? 10 : 16, height: leadingSize })]}
              />
            ) : trailing ? (
              <HStack modifiers={[frame({ width: leadingSize, height: leadingSize })]}>
                <RNHostView matchContents>
                  <View
                    pointerEvents="none"
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.leading, { width: leadingSize, height: leadingSize }]}
                  >
                    {trailing}
                  </View>
                </RNHostView>
              </HStack>
            ) : null}
          </HStack>
        </NativeButton>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { minHeight: 48, minWidth: 48, width: "100%" },
  compactHost: { minHeight: 48, minWidth: 48 },
  compactPlacement: { flexGrow: 0, flexShrink: 0, alignSelf: "flex-start" },
  leading: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
});
