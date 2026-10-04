import { Image, type ImageProps } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { theme } from "@/theme";
import { Button } from "./button";
import { AppIcon } from "./app-icon";
import { SkeletonBlock } from "./loading-skeletons";

export type LoadingImageProps = Omit<ImageProps, "style"> & {
  /** The reserved media plane keeps these dimensions in every state. */
  readonly style?: StyleProp<ViewStyle>;
  readonly loadingLabel?: string;
  readonly sourceKey?: string;
  readonly onRetry?: () => void;
  /** A thumbnail inside a row delegates retry/open to its owning action. */
  readonly retryable?: boolean;
};

function imageSourceKey(source: ImageProps["source"]): string {
  if (typeof source === "string" || typeof source === "number") return String(source);
  if (Array.isArray(source)) return source.map(imageSourceKey).join("|");
  if (source && "uri" in source && typeof source.uri === "string") return source.uri;
  return source ? "shared-image" : "empty-image";
}

/** Loading, error and retry stay inside the same final image footprint. */
export function LoadingImage(props: LoadingImageProps): React.JSX.Element {
  return <LoadingImagePlane key={props.sourceKey ?? imageSourceKey(props.source)} {...props} />;
}

function LoadingImagePlane({
  style,
  loadingLabel = "Memuat gambar",
  onRetry,
  retryable = true,
  sourceKey: _sourceKey,
  onLoadStart,
  onLoad,
  onDisplay,
  onError,
  accessibilityLabel,
  accessible = true,
  ...props
}: LoadingImageProps): React.JSX.Element {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={[styles.plane, style]}>
      <Image
        {...props}
        key={attempt}
        style={StyleSheet.absoluteFill}
        accessible={accessible && phase === "ready"}
        accessibilityLabel={accessibilityLabel}
        onLoadStart={() => {
          setPhase("loading");
          onLoadStart?.();
        }}
        onLoad={(event) => onLoad?.(event)}
        onDisplay={() => {
          setPhase("ready");
          onDisplay?.();
        }}
        onError={(event) => {
          setPhase("error");
          onError?.(event);
        }}
      />
      {phase === "loading" ? (
        <View
          pointerEvents="none"
          accessibilityLabel={loadingLabel}
          accessibilityState={{ busy: true }}
          accessible
          style={styles.loading}
        >
          <SkeletonBlock height={28} width="38%" />
          <SkeletonBlock height={12} width="52%" />
        </View>
      ) : phase === "error" ? (
        <View
          style={styles.failure}
          accessible={!retryable}
          accessibilityLabel={retryable ? undefined : "Gambar belum dapat dimuat"}
        >
          <AppIcon name="image" size={24} color={theme.colors.onSurfaceVariant} />
          {retryable ? (
            <>
              <Text style={styles.message}>Gambar belum dapat dimuat</Text>
              <Button
                variant="section"
                size="compact"
                accessibilityLabel="Muat ulang gambar"
                onPress={() => {
                  setPhase("loading");
                  setAttempt((current) => current + 1);
                  onRetry?.();
                }}
              >
                Muat ulang
              </Button>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plane: { overflow: "hidden", backgroundColor: theme.colors.surfaceContainer },
  loading: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceContainer,
  },
  failure: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceContainer,
  },
  message: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
    textAlign: "center",
  },
});
