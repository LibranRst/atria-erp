import { View } from "react-native";
import { ChromeButton } from "./chrome-button";
import type { HeaderLeadingControlsProps } from "./header-leading-controls.types";

export function HeaderLeadingControls({
  hasBack,
  canUseAI,
  onBack,
  onAI,
}: HeaderLeadingControlsProps): React.JSX.Element {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {hasBack ? <ChromeButton icon="chevron_left" label="Kembali" onPress={onBack} /> : null}
      {canUseAI ? <ChromeButton icon="sparkle" label="Buka asisten AI" onPress={onAI} /> : null}
    </View>
  );
}
