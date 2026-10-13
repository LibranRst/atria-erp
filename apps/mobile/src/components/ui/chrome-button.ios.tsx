import { Host } from "@expo/ui";
import { Button, RNHostView, Text, VStack } from "@expo/ui/swift-ui";
import { Image as ProfileImage } from "expo-image";
import { useState } from "react";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  buttonStyle,
  contentShape,
  cornerRadius,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  glassEffect,
  lineLimit,
  minimumScaleFactor,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import type { ChromeButtonProps } from "./chrome-button.types";
import { theme } from "@/theme";
import { AppIcon } from "./app-icon";

export function ChromeButton({
  label,
  icon,
  initials,
  imageUri,
  onPress,
  selected = false,
  showLabel = false,
  surface = true,
  surfaceStyle = "glass",
  visualSize,
  disabled = false,
  embedded = false,
  width = 48,
  height = 48,
}: ChromeButtonProps): React.JSX.Element {
  const ink = selected || Boolean(initials);
  const surfaceWidth = visualSize === undefined ? width : Math.min(width, visualSize);
  const surfaceHeight = visualSize === undefined ? height : Math.min(height, visualSize);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(imageUri) && failedUri !== imageUri;
  const glyph = (
    <RNHostView matchContents>
      <AppIcon
        name={icon}
        size={20}
        accessible={false}
        pointerEvents="none"
        color={
          ink
            ? theme.colors.onPrimary
            : surfaceStyle === "tonal"
              ? theme.colors.onSurface
              : theme.colors.primary
        }
      />
    </RNHostView>
  );
  const button = (
    <Button
      onPress={disabled ? undefined : onPress}
      modifiers={[
        buttonStyle("plain"),
        frame({ width: surfaceWidth, height: surfaceHeight }),
        accessibilityLabel(label),
        disabledModifier(disabled),
        ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
        foregroundColor(
          ink
            ? theme.colors.onPrimary
            : surfaceStyle === "tonal"
              ? theme.colors.onSurface
              : theme.colors.primary,
        ),
        ...(ink
          ? [background(theme.colors.primary), cornerRadius(theme.radii.capsule)]
          : surface
            ? surfaceStyle === "tonal"
              ? [background(theme.colors.surfaceContainer, shapes.capsule())]
              : [
                  glassEffect({
                    glass: {
                      variant: "regular",
                      interactive: true,
                      tint: theme.chrome.lightGlassTint,
                    },
                    shape: "capsule",
                  }),
                ]
            : []),
        ...(visualSize === undefined ? [] : [frame({ width, height })]),
        contentShape(shapes.rectangle()),
      ]}
    >
      {showImage && imageUri ? (
        <RNHostView matchContents>
          <ProfileImage
            source={{ uri: imageUri }}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            contentFit="cover"
            accessible={false}
            pointerEvents="none"
            onError={() => setFailedUri(imageUri)}
          />
        </RNHostView>
      ) : initials ? (
        <Text modifiers={[font({ textStyle: "caption", weight: "bold" })]}>{initials}</Text>
      ) : showLabel ? (
        <VStack spacing={theme.spacing.base / 2}>
          {glyph}
          <Text
            modifiers={[
              font({ textStyle: "caption2", weight: selected ? "semibold" : "medium" }),
              lineLimit(1),
              minimumScaleFactor(0.85),
            ]}
          >
            {label}
          </Text>
        </VStack>
      ) : (
        glyph
      )}
    </Button>
  );
  if (embedded) return button;
  return (
    <Host
      ignoreSafeArea="all"
      colorScheme="light"
      seedColor={theme.colors.primary}
      style={{ width, height }}
    >
      {button}
    </Host>
  );
}
