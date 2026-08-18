import {
  colors,
  maxWidths,
  opacityColors,
  radii,
  shadows,
  spacing,
  typography,
} from "@atria/tokens";

export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  mono: "JetBrainsMono_500Medium",
} as const;

export const theme = {
  colors,
  fonts,
  maxWidths,
  motion: {
    reducedDuration: 0,
  },
  opacityColors,
  radii: {
    ...radii,
    capsule: 999,
  },
  shadows,
  spacing,
  typography,
} as const;

export type AtriaTheme = typeof theme;
