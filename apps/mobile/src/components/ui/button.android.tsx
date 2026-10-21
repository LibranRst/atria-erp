import { Host } from "@expo/ui";
import {
  Button as FilledButton,
  OutlinedButton,
  TextButton,
  Row,
  RNHostView,
  CircularProgressIndicator,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  defaultMinSize,
  fillMaxWidth,
  size as nativeSize,
  testID as nativeTestID,
  wrapContentWidth,
} from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet, View } from "react-native";
import type { ButtonProps } from "./button.types";
import { useButtonSize } from "./button-size-context";
import { theme } from "@/theme";

export type { ButtonProps, ButtonSize, ButtonVariant } from "./button.types";

export function Button({
  children,
  leading,
  trailing,
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
  const NativeButton =
    variant === "ghost" || variant === "section"
      ? TextButton
      : variant === "secondary"
        ? OutlinedButton
        : FilledButton;
  const color =
    variant === "danger"
      ? theme.colors.critical
      : variant === "section"
        ? theme.colors.onSurfaceVariant
        : theme.colors.accent;
  const prominent = variant === "primary" || variant === "danger";
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: unavailable, busy: loading }}
      accessibilityActions={unavailable ? [] : [{ name: "activate" }]}
      onAccessibilityAction={
        unavailable
          ? undefined
          : (event) => {
              if (event.nativeEvent.actionName === "activate") onPress?.();
            }
      }
      style={[compact && styles.compactPlacement, style]}
      testID={testID}
    >
      <View importantForAccessibility="no-hide-descendants">
        <Host
          matchContents={{ vertical: true, horizontal: compact }}
          colorScheme="light"
          seedColor={theme.colors.accent}
          style={compact ? styles.compactHost : styles.host}
        >
          <NativeButton
            enabled={!unavailable}
            onClick={unavailable ? undefined : onPress}
            contentPadding={{
              start: variant === "section" ? 0 : compact ? 12 : sheet ? 20 : 16,
              end: variant === "section" ? 0 : compact ? 12 : sheet ? 20 : 16,
              top: 0,
              bottom: 0,
            }}
            colors={{
              containerColor: prominent ? color : "transparent",
              contentColor: prominent ? theme.colors.onPrimary : color,
            }}
            modifiers={[
              compact ? wrapContentWidth() : fillMaxWidth(),
              defaultMinSize({ minHeight: sheet ? 52 : compact ? 40 : 44, minWidth: 48 }),
              ...(testID ? [nativeTestID(testID)] : []),
            ]}
          >
            <Row
              horizontalArrangement={{ spacedBy: variant === "section" ? 4 : 6 }}
              verticalAlignment="center"
            >
              {loading ? (
                <CircularProgressIndicator
                  color={prominent ? theme.colors.onPrimary : color}
                  modifiers={[nativeSize(20, 20)]}
                />
              ) : leading ? (
                <RNHostView matchContents modifiers={[nativeSize(leadingSize, leadingSize)]}>
                  <View
                    pointerEvents="none"
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.leading, { width: leadingSize, height: leadingSize }]}
                  >
                    {leading}
                  </View>
                </RNHostView>
              ) : null}
              <Text
                maxLines={1}
                overflow="ellipsis"
                style={{
                  typography: sheet
                    ? "titleMedium"
                    : variant === "section"
                      ? "labelMedium"
                      : "labelLarge",
                }}
              >
                {children}
              </Text>
              {trailing ? (
                <RNHostView matchContents modifiers={[nativeSize(leadingSize, leadingSize)]}>
                  <View
                    pointerEvents="none"
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.leading, { width: leadingSize, height: leadingSize }]}
                  >
                    {trailing}
                  </View>
                </RNHostView>
              ) : null}
            </Row>
          </NativeButton>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { minHeight: 48, minWidth: 48, width: "100%" },
  compactHost: { minHeight: 48, minWidth: 48 },
  compactPlacement: { flexGrow: 0, flexShrink: 0, alignSelf: "flex-start" },
  leading: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
});
