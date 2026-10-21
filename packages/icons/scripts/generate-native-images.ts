import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  APP_ICON_STROKE_WIDTH,
  appIconByName,
  resolveAppIcon,
  type AppIconData,
} from "../src/index";

function escapeAttribute(value: string | number): string {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function svgMarkup(data: AppIconData): string {
  const children = data
    .map(([tag, attributes]) => {
      const attrs = { ...attributes, stroke: "currentColor", strokeWidth: APP_ICON_STROKE_WIDTH };
      const serialized = Object.entries(attrs)
        .map(([name, value]) => {
          const key = name.replace(
            /[A-Z]/g,
            (letter: string): string => `-${letter.toLowerCase()}`,
          );
          return `${key}="${escapeAttribute(value)}"`;
        })
        .join(" ");
      return `<${tag} ${serialized}/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" color="black" fill="none">${children}</svg>`;
}

// UIKit/SwiftUI image slots require raster templates: exact free glyphs at 20pt @3x.
const pngByGlyph = new Map<AppIconData, string>();
const generated: Record<string, string> = {};
const glyphs: readonly (readonly [string, AppIconData])[] = [
  ...Object.entries(appIconByName),
  ["fallback", resolveAppIcon("unknown")],
];
for (const [name, data] of glyphs) {
  let png = pngByGlyph.get(data);
  if (!png) {
    png = (
      await sharp(Buffer.from(svgMarkup(data)))
        .png()
        .toBuffer()
    ).toString("base64");
    pngByGlyph.set(data, png);
  }
  generated[name] = png;
}
await writeFile(
  new URL("../src/native-images.generated.json", import.meta.url),
  `${JSON.stringify(generated, null, 2)}\n`,
);
console.log(
  `Generated ${pngByGlyph.size} native templates for ${Object.keys(generated).length - 1} icon names.`,
);
