import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useState } from "react";
import { ChromeSurface } from "./chrome-surface";
import { AppIcon } from "./app-icon";
import { RowAction } from "./row-action";
import type { ChromeButtonProps } from "./chrome-button.types";
import { theme } from "@/theme";
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
  width = 48,
  height = 48,
}: ChromeButtonProps): React.JSX.Element {
  const ink = selected || Boolean(initials);
  const surfaceWidth = visualSize === undefined ? width : Math.min(width, visualSize);
  const surfaceHeight = visualSize === undefined ? height : Math.min(height, visualSize);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(imageUri) && failedUri !== imageUri;
  const content = (
    <View
      style={{
        width: surfaceWidth,
        height: surfaceHeight,
        alignItems: "center",
        justifyContent: "center",
        gap: showLabel ? theme.spacing.base / 2 : 0,
        borderRadius: theme.radii.capsule,
        backgroundColor: ink
          ? theme.colors.primary
          : surface && surfaceStyle === "tonal"
            ? theme.colors.surfaceContainer
            : "transparent",
      }}
    >
      {showImage && imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: 28, height: 28, borderRadius: 14 }}
          contentFit="cover"
          accessible={false}
          onError={() => setFailedUri(imageUri)}
        />
      ) : initials ? (
        <Text
          style={{
            color: theme.colors.onPrimary,
            fontFamily: theme.fonts.bold,
            ...theme.typography.support,
          }}
        >
          {initials}
        </Text>
      ) : (
        <AppIcon
          name={icon}
          size={20}
          color={ink ? theme.colors.onPrimary : theme.colors.primary}
        />
      )}
      {showLabel ? (
        <Text
          numberOfLines={1}
          style={{
            color: ink ? theme.colors.onPrimary : theme.colors.primary,
            fontFamily: selected ? theme.fonts.semibold : theme.fonts.medium,
            ...theme.typography.support,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
  return (
    <RowAction
      accessibilityLabel={label}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
      style={{ width, height, alignItems: "center", justifyContent: "center" }}
    >
      {surface && !ink && surfaceStyle === "glass" ? (
        <ChromeSurface>{content}</ChromeSurface>
      ) : (
        content
      )}
    </RowAction>
  );
}
