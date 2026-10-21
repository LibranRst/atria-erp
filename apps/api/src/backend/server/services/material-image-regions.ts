import sharp, { type Metadata } from "sharp";
import type { MaterialSource } from "@atria/core/ai/material-import";

type Region = NonNullable<MaterialSource["imageRegion"]>;
const MAX_REGION_HEIGHT = 1024;
const MAX_PIXELS = 64_000_000;

/** Complete contiguous document regions; unsafe boundaries retain the original image. */
export async function materialImageRegions(bytes: Buffer): Promise<Region[] | null> {
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    return null;
  }
  const { width, height } = metadata;
  if (
    !width ||
    !height ||
    height > 60000 ||
    (metadata.pages ?? 1) > 1 ||
    !["png", "jpeg", "webp"].includes(metadata.format ?? "")
  )
    return null;
  if (height <= MAX_REGION_HEIGHT || height < width * 1.8)
    return [{ index: 0, top: 0, height, width, originalHeight: height }];
  const scanWidth = Math.min(width, 256);
  const pixels = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
    .flatten({ background: "white" })
    .resize({ width: scanWidth, height, fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const histogram = new Uint32Array(256);
  for (const pixel of pixels) histogram[pixel]++;
  let background = 0;
  for (let i = 1; i < 256; i++) if (histogram[i] > histogram[background]) background = i;
  const rules: number[] = [];
  const gaps: { start: number; end: number }[] = [];
  let ruleStart = -1,
    gapStart = -1;
  for (let y = 0; y <= height; y++) {
    let ink = 0;
    if (y < height)
      for (let x = 0; x < scanWidth; x++)
        if (Math.abs(pixels[y * scanWidth + x] - background) >= 10) ink++;
    const rule = y < height && ink / scanWidth >= 0.7;
    const blank = y < height && ink / scanWidth <= 0.01;
    if (rule && ruleStart < 0) ruleStart = y;
    if (!rule && ruleStart >= 0) {
      if (y - ruleStart <= 4) rules.push(y);
      ruleStart = -1;
    }
    if (blank && gapStart < 0) gapStart = y;
    if (!blank && gapStart >= 0) {
      if (y - gapStart >= 20) gaps.push({ start: gapStart, end: y });
      gapStart = -1;
    }
  }
  const regions: Region[] = [];
  let top = 0;
  while (top < height) {
    let end = Math.min(top + MAX_REGION_HEIGHT, height);
    if (end < height) {
      const boundaries = rules.filter((y) => y > top + 32 && y <= end);
      if (boundaries.length) end = boundaries[Math.min(boundaries.length, 20) - 1];
      else {
        const gap = gaps
          .filter((g) => g.start > top + MAX_REGION_HEIGHT * 0.6 && g.start < end)
          .sort((a, b) => b.end - b.start - (a.end - a.start))[0];
        if (!gap) return [{ index: 0, top: 0, height, width, originalHeight: height }];
        end = Math.min(end, Math.floor((gap.start + gap.end) / 2));
      }
    }
    regions.push({ index: regions.length, top, height: end - top, width, originalHeight: height });
    top = end;
  }
  return regions;
}

export async function materialImageRegionBytes(bytes: Buffer, region: Region): Promise<Buffer> {
  return sharp(bytes, { limitInputPixels: MAX_PIXELS })
    .extract({ left: 0, top: region.top, width: region.width, height: region.height })
    .png()
    .toBuffer();
}
