import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";

const repoRoot = resolve(import.meta.dir, "..");
const cssPath = resolve(repoRoot, "apps/web/app/globals.css");
const outputPath = resolve(repoRoot, "packages/tokens/src/tokens.ts");

function extractBlock(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Blok ${marker} tidak ditemukan.`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Blok ${marker} tidak ditutup.`);
}

function declarations(block: string): Map<string, string> {
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const result = new Map<string, string>();
  for (const match of clean.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    result.set(match[1], match[2].replace(/\s+/g, " ").trim());
  }
  return result;
}

function camelCase(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

function propertyName(value: string): string {
  const name = camelCase(value);
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function renderRecord(
  name: string,
  entries: readonly (readonly [string, string | number])[],
): string {
  const body = entries
    .map(([key, value]) => `  ${propertyName(key)}: ${JSON.stringify(value)},`)
    .join("\n");
  return `export const ${name} = {\n${body}\n} as const;`;
}

const css = await readFile(cssPath, "utf8");
const rootTokens = declarations(extractBlock(css, ":root"));
const themeTokens = declarations(extractBlock(css, "@theme"));
const allTokens = new Map([...rootTokens, ...themeTokens]);

function resolveValue(rawValue: string, trail: readonly string[] = []): string {
  return rawValue.replace(/var\(--([\w-]+)\)/g, (_, name: string) => {
    if (trail.includes(name)) throw new Error(`Siklus token: ${[...trail, name].join(" -> ")}`);
    const referenced = allTokens.get(name);
    if (!referenced) return `var(--${name})`;
    return resolveValue(referenced, [...trail, name]);
  });
}

function resolveColor(rawValue: string): string {
  const value = resolveValue(rawValue);
  const mix = value.match(/^color-mix\(in srgb, (#[0-9a-fA-F]{6}) ([\d.]+)%, transparent\)$/);
  if (mix) return hexToRgba(mix[1], Number(mix[2]) / 100);
  return value;
}

function pxValue(rawValue: string): number {
  const value = resolveValue(rawValue);
  const px = value.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  const rem = value.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  throw new Error(`Nilai dimensi tidak didukung: ${value}`);
}

const colorEntries = [...themeTokens]
  .filter(([name]) => name.startsWith("color-"))
  .map(([name, value]) => [name.slice("color-".length), resolveColor(value)] as const);
const spacingEntries = [...themeTokens]
  .filter(([name]) => name.startsWith("spacing-"))
  .map(([name, value]) => [name.slice("spacing-".length), pxValue(value)] as const);
const radiusEntries = [...themeTokens]
  .filter(([name]) => name.startsWith("radius-"))
  .map(([name, value]) => [name.slice("radius-".length), pxValue(value)] as const);
const maxWidthEntries = [...themeTokens]
  .filter(([name]) => name.startsWith("max-width-"))
  .map(([name, value]) => [name.slice("max-width-".length), pxValue(value)] as const);
const shadowEntries = [...themeTokens]
  .filter(([name]) => name.startsWith("shadow-"))
  .map(([name, value]) => [name.slice("shadow-".length), resolveValue(value)] as const);
const textNames = [...themeTokens.keys()]
  .filter((name) => name.startsWith("text-") && !name.endsWith("--line-height"))
  .map((name) => name.slice("text-".length));
const typographyEntries = textNames.map(
  (name) =>
    [
      name,
      {
        fontSize: pxValue(themeTokens.get(`text-${name}`) ?? "0px"),
        lineHeight: pxValue(themeTokens.get(`text-${name}--line-height`) ?? "0px"),
      },
    ] as const,
);

const output = `// File ini dibuat otomatis oleh scripts/generate-tokens.ts. Jangan edit manual.\n\n${renderRecord("colors", colorEntries)}\n\n${renderRecord("spacing", spacingEntries)}\n\n${renderRecord("radii", radiusEntries)}\n\n${renderRecord("maxWidths", maxWidthEntries)}\n\n${renderRecord("shadows", shadowEntries)}\n\nexport const typography = {\n${typographyEntries
  .map(([name, value]) => `  ${propertyName(name)}: ${JSON.stringify(value)},`)
  .join(
    "\n",
  )}\n} as const;\n\nexport const fontFamilies = {\n  sans: "Manrope",\n  mono: "JetBrains Mono",\n} as const;\n\nexport const opacityColors = {\n  white88: "rgba(255, 255, 255, 0.88)",\n  white10: "rgba(255, 255, 255, 0.1)",\n  outlineVariant20: ${JSON.stringify(hexToRgba(resolveColor(rootTokens.get("outline-variant") ?? "#c7c7cc"), 0.2))},\n  warning09: ${JSON.stringify(hexToRgba(resolveColor(rootTokens.get("warning") ?? "#b84b2c"), 0.09))},\n  error075: ${JSON.stringify(hexToRgba(resolveColor(rootTokens.get("error") ?? "#97371f"), 0.075))},\n} as const;\n`;

const formattedOutput = await format(output, { parser: "typescript", printWidth: 100 });

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== formattedOutput) {
    console.error("Token native tidak sinkron. Jalankan `bun run tokens:generate`.");
    process.exit(1);
  }
  console.log("Token native sinkron dengan apps/web/app/globals.css.");
} else {
  await writeFile(outputPath, formattedOutput);
  console.log("packages/tokens/src/tokens.ts diperbarui.");
}
