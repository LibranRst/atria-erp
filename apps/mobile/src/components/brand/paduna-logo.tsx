/** Approved outlined Paduna artwork; no product suffix or reconstructed lettering. */
import { Image } from "expo-image";
import padunaLogo from "../../../assets/brand/paduna.png";
import { MOBILE_BRAND_NAME } from "@/constants/brand";

export function PadunaLogo({
  accessible = true,
}: {
  readonly accessible?: boolean;
}): React.JSX.Element {
  return (
    <Image
      source={padunaLogo}
      accessible={accessible}
      accessibilityLabel={MOBILE_BRAND_NAME}
      contentFit="contain"
      style={{ width: 176, height: (176 * 376) / 1647 }}
    />
  );
}
