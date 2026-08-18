import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";

import {
  colors,
  maxWidths,
  opacityColors,
  radii,
  spacing,
  typography,
} from "../packages/tokens/src/tokens";

const repoRoot = resolve(import.meta.dir, "..");
const outputPath = resolve(repoRoot, "apps/mobile/tailwind.config.js");

/**
 * Nama family Expo Google Fonts ini hidup di apps/mobile/src/theme/index.ts
 * (bukan packages/tokens, yang cuma menyimpan nama family generik) karena
 * terikat ke paket @expo-google-fonts/* yang dipasang di apps/mobile.
 */
const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  mono: "JetBrainsMono_500Medium",
} as const;

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function px(value: number): string {
  return `${value}px`;
}

const colorEntries = Object.entries(colors).map(([key, value]) => [kebabCase(key), value] as const);
const opacityColorEntries = Object.entries(opacityColors).map(
  ([key, value]) => [kebabCase(key), value] as const,
);

const spacingEntries = Object.entries(spacing).map(
  ([key, value]) => [kebabCase(key), px(value)] as const,
);

const radiusEntries = [...Object.entries(radii), ["capsule", 999]].map(
  ([key, value]) => [kebabCase(key), px(value)] as const,
);

const maxWidthEntries = Object.entries(maxWidths).map(([key, value]) => [key, px(value)] as const);

const fontSizeEntries = Object.entries(typography).map(
  ([key, value]) => [key, [px(value.fontSize), { lineHeight: px(value.lineHeight) }]] as const,
);

const fontFamilyEntries = [
  ["sans", fonts.regular],
  ["sans-medium", fonts.medium],
  ["sans-semibold", fonts.semibold],
  ["sans-bold", fonts.bold],
  ["sans-extrabold", fonts.extrabold],
  ["mono", fonts.mono],
] as const;

function renderObject(entries: readonly (readonly [string, unknown])[]): string {
  const body = entries
    .map(([key, value]) => `      ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");
  return `{\n${body}\n    }`;
}

const source = `/**
 * File ini dibuat otomatis oleh scripts/generate-mobile-tailwind-config.ts dari
 * packages/tokens/src/tokens.ts (yang sendiri dibuat otomatis dari
 * apps/web/app/globals.css). Jangan edit manual — jalankan
 * \`bun run mobile-tailwind:generate\` setelah token berubah.
 *
 * Nama kelas warna/spacing/radius memakai kebab-case yang sama dengan token
 * CSS web (mis. \`bg-on-surface-variant\`, \`p-md\`, \`rounded-owner\`) supaya
 * kosakata Tailwind di native dan web tetap satu sumber.
 *
 * \`boxShadow\` web tidak dipetakan ke sini: model shadow React Native (single
 * layer, tanpa inset di Android) tidak bisa merepresentasikan token shadow
 * berlapis milik web. Permukaan yang butuh shadow tetap pakai StyleSheet.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: ${renderObject([...colorEntries, ...opacityColorEntries])},
      spacing: ${renderObject(spacingEntries)},
      borderRadius: ${renderObject(radiusEntries)},
      maxWidth: ${renderObject(maxWidthEntries)},
      fontSize: ${renderObject(fontSizeEntries)},
      fontFamily: ${renderObject(fontFamilyEntries)},
    },
  },
  plugins: [],
};
`;

await writeFile(outputPath, await format(source, { parser: "babel" }), "utf8");
