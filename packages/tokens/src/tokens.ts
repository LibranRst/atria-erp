// File ini dibuat otomatis oleh scripts/generate-tokens.ts. Jangan edit manual.

export const colors = {
  background: "#f5f5f7",
  foreground: "#181817",
  primary: "#181817",
  onPrimary: "#ffffff",
  primaryContainer: "#30302e",
  onPrimaryContainer: "#efeff2",
  accent: "#b84b2c",
  onAccent: "#ffffff",
  accentContainer: "#f6e8e3",
  secondary: "#636366",
  onSecondary: "#ffffff",
  secondaryContainer: "#e3e3e7",
  onSecondaryContainer: "#48484a",
  tertiary: "#48484a",
  onTertiary: "#ffffff",
  tertiaryContainer: "#636366",
  onTertiaryContainer: "#efeff2",
  error: "#97371f",
  onError: "#ffffff",
  errorContainer: "#f4e3dd",
  onErrorContainer: "#742712",
  surface: "#f5f5f7",
  onSurface: "#181817",
  surfaceVariant: "#e3e3e7",
  onSurfaceVariant: "#3a3a3c",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#efeff2",
  surfaceContainer: "#e8e8eb",
  surfaceContainerHigh: "#d1d1d6",
  surfaceContainerHighest: "#c7c7cc",
  surfaceInverse: "#181817",
  onSurfaceInverse: "#ffffff",
  outline: "#8e8e93",
  outlineVariant: "#c7c7cc",
  border: "#d1d1d6",
  elevated: "#ffffff",
  muted: "#636366",
  textPrimary: "#181817",
  primaryLight: "#efeff2",
  success: "#30302e",
  successContainer: "#efeff2",
  successLight: "#efeff2",
  warning: "#b84b2c",
  warningContainer: "#f6e8e3",
  warningLight: "#f6e8e3",
  warningOnContainer: "#ae4528",
  critical: "#97371f",
  onCritical: "#ffffff",
  criticalContainer: "#f4e3dd",
  criticalOnInverse: "#ef9b80",
  warningOnInverse: "#e9a28d",
  criticalLight: "#f4e3dd",
  ringSubtle: "rgba(60, 60, 67, 0.02)",
  ringControl: "rgba(60, 60, 67, 0.06)",
  focusRing: "rgba(184, 75, 44, 0.35)",
  focusRingStrong: "rgba(184, 75, 44, 0.55)",
} as const;

export const spacing = {
  base: 4,
  xs: 8,
  sm: 12,
  md: 16,
  gutter: 16,
  marginMobile: 20,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  owner: 28,
  inset: 20,
  icon: 16,
} as const;

export const maxWidths = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  "2xl": 672,
} as const;

export const shadows = {
  surface:
    "inset 0 1px 0 0 rgb(255 255 255 / 0.65), 0 1px 1px rgb(24 24 23 / 0.03), 0 3px 8px rgb(24 24 23 / 0.05)",
  control:
    "inset 0 1px 0 0 rgb(255 255 255 / 0.65), 0 1px 1px rgb(24 24 23 / 0.03), 0 3px 8px rgb(24 24 23 / 0.05)",
  primary:
    "inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 1px 1px rgb(24 24 23 / 0.1), 0 3px 8px rgb(24 24 23 / 0.14)",
  inverse:
    "inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 1px 1px rgb(24 24 23 / 0.1), 0 3px 8px rgb(24 24 23 / 0.14)",
  raised: "inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 10px 28px rgb(24 24 23 / 0.09)",
  floating: "inset 0 1px 0 0 rgb(255 255 255 / 0.12), 0 14px 34px rgb(24 24 23 / 0.18)",
  sheet: "0 -24px 80px rgb(0 0 0 / 0.28)",
  overlay: "0 28px 90px rgb(0 0 0 / 0.32)",
} as const;

export const typography = {
  eyebrow: { fontSize: 9, lineHeight: 12 },
  meta: { fontSize: 10, lineHeight: 15 },
  support: { fontSize: 12, lineHeight: 17 },
  row: { fontSize: 14, lineHeight: 19 },
  section: { fontSize: 17, lineHeight: 22 },
  title: { fontSize: 24, lineHeight: 29 },
  focal: { fontSize: 30, lineHeight: 34 },
} as const;

export const fontFamilies = {
  sans: "Manrope",
  mono: "JetBrains Mono",
} as const;

export const opacityColors = {
  white88: "rgba(255, 255, 255, 0.88)",
  white10: "rgba(255, 255, 255, 0.1)",
  outlineVariant20: "rgba(199, 199, 204, 0.2)",
  warning09: "rgba(184, 75, 44, 0.09)",
  error075: "rgba(151, 55, 31, 0.075)",
} as const;
