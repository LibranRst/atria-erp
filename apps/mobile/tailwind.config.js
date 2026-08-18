/**
 * File ini dibuat otomatis oleh scripts/generate-mobile-tailwind-config.ts dari
 * packages/tokens/src/tokens.ts (yang sendiri dibuat otomatis dari
 * apps/web/app/globals.css). Jangan edit manual — jalankan
 * `bun run mobile-tailwind:generate` setelah token berubah.
 *
 * Nama kelas warna/spacing/radius memakai kebab-case yang sama dengan token
 * CSS web (mis. `bg-on-surface-variant`, `p-md`, `rounded-owner`) supaya
 * kosakata Tailwind di native dan web tetap satu sumber.
 *
 * `boxShadow` web tidak dipetakan ke sini: model shadow React Native (single
 * layer, tanpa inset di Android) tidak bisa merepresentasikan token shadow
 * berlapis milik web. Permukaan yang butuh shadow tetap pakai StyleSheet.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#f5f5f7",
        foreground: "#181817",
        primary: "#181817",
        "on-primary": "#ffffff",
        "primary-container": "#30302e",
        "on-primary-container": "#efeff2",
        accent: "#b84b2c",
        "on-accent": "#ffffff",
        "accent-container": "#f6e8e3",
        secondary: "#636366",
        "on-secondary": "#ffffff",
        "secondary-container": "#e3e3e7",
        "on-secondary-container": "#48484a",
        tertiary: "#48484a",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#636366",
        "on-tertiary-container": "#efeff2",
        error: "#97371f",
        "on-error": "#ffffff",
        "error-container": "#f4e3dd",
        "on-error-container": "#742712",
        surface: "#f5f5f7",
        "on-surface": "#181817",
        "surface-variant": "#e3e3e7",
        "on-surface-variant": "#3a3a3c",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#efeff2",
        "surface-container": "#e8e8eb",
        "surface-container-high": "#d1d1d6",
        "surface-container-highest": "#c7c7cc",
        "surface-inverse": "#181817",
        "on-surface-inverse": "#ffffff",
        outline: "#8e8e93",
        "outline-variant": "#c7c7cc",
        border: "#d1d1d6",
        elevated: "#ffffff",
        muted: "#636366",
        "text-primary": "#181817",
        "primary-light": "#efeff2",
        success: "#30302e",
        "success-container": "#efeff2",
        "success-light": "#efeff2",
        warning: "#b84b2c",
        "warning-container": "#f6e8e3",
        "warning-light": "#f6e8e3",
        "warning-on-container": "#ae4528",
        critical: "#97371f",
        "on-critical": "#ffffff",
        "critical-container": "#f4e3dd",
        "critical-on-inverse": "#ef9b80",
        "warning-on-inverse": "#e9a28d",
        "critical-light": "#f4e3dd",
        "ring-subtle": "rgba(60, 60, 67, 0.02)",
        "ring-control": "rgba(60, 60, 67, 0.06)",
        "focus-ring": "rgba(184, 75, 44, 0.35)",
        "focus-ring-strong": "rgba(184, 75, 44, 0.55)",
        white88: "rgba(255, 255, 255, 0.88)",
        white10: "rgba(255, 255, 255, 0.1)",
        "outline-variant20": "rgba(199, 199, 204, 0.2)",
        warning09: "rgba(184, 75, 44, 0.09)",
        error075: "rgba(151, 55, 31, 0.075)",
      },
      spacing: {
        base: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        gutter: "16px",
        "margin-mobile": "20px",
        lg: "24px",
        xl: "32px",
      },
      borderRadius: {
        owner: "28px",
        inset: "20px",
        icon: "16px",
        capsule: "999px",
      },
      maxWidth: {
        xs: "320px",
        sm: "384px",
        md: "448px",
        lg: "512px",
        xl: "576px",
        "2xl": "672px",
      },
      fontSize: {
        eyebrow: ["9px", { lineHeight: "12px" }],
        meta: ["10px", { lineHeight: "15px" }],
        support: ["12px", { lineHeight: "17px" }],
        row: ["14px", { lineHeight: "19px" }],
        section: ["17px", { lineHeight: "22px" }],
        title: ["24px", { lineHeight: "29px" }],
        focal: ["30px", { lineHeight: "34px" }],
      },
      fontFamily: {
        sans: "Manrope_400Regular",
        "sans-medium": "Manrope_500Medium",
        "sans-semibold": "Manrope_600SemiBold",
        "sans-bold": "Manrope_700Bold",
        "sans-extrabold": "Manrope_800ExtraBold",
        mono: "JetBrainsMono_500Medium",
      },
    },
  },
  plugins: [],
};
