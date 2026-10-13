import { expect, test, spyOn } from "bun:test";
import sharp from "sharp";
import * as privateFiles from "@backend/server/usecases/media/private-attachments";
import {
  documentModel,
  DocumentContentError,
  type DocumentContentRequest,
  type DocumentContentResponse,
} from "@backend/lib/ai/document-model";
import { extractMaterialSources, mapMaterialSources } from "./material-analysis-source";
import type { Actor } from "@backend/server/actor";
import type { MaterialSource } from "@atria/core/ai/material-import";

test("long image extraction checkpoints bounded regions and maps all 20 rows without another AI pass", async () => {
  const id = crypto.randomUUID();
  const actor: Actor = {
    userId: id,
    roleId: crypto.randomUUID(),
    roleName: "Fixture",
    dataScope: "GLOBAL",
    permissions: ["use:ai_chat", "manage:material_settings"],
    name: "Fixture",
    email: "fixture@example.invalid",
    image: null,
    isActive: true,
    mustChangePassword: false,
    sessionId: "fixture",
    developerActorUserId: null,
  };
  const svg = `<svg width="120" height="2400">${Array.from({ length: 20 }, (_, i) => `<rect x="0" y="${(i + 1) * 120 - 1}" width="120" height="1" fill="black"/><rect x="10" y="${i * 120 + 20}" width="10" height="10" fill="rgb(${i + 1},0,0)"/>`).join("")}</svg>`;
  const bytes = await sharp({
    create: { width: 120, height: 2400, channels: 3, background: "white" },
  })
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
  const reader = spyOn(privateFiles, "readPrivateAttachment").mockResolvedValue({
    row: {
      id,
      tenantId: id,
      fileName: "catalog.png",
      fileUrl: "https://fixture.invalid/catalog.png",
      storageFileId: "fixture",
      fileSize: bytes.length,
      mimeType: "image/png",
      uploadedById: id,
      referenceType: "private_ai_chat",
      referenceId: id,
      createdAt: new Date(),
    },
    bytes,
  });
  const heights: number[] = [];
  const provider = spyOn(documentModel.models, "generateContent").mockImplementation(
    async (input: DocumentContentRequest): Promise<DocumentContentResponse> => {
      const pictures = input.contents.filter((part) => typeof part !== "string");
      const picture = pictures.at(-1);
      if (!picture) throw new Error("Image rows must not need a second model mapping");
      const raster = await sharp(Buffer.from(picture.inlineData.data, "base64"))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      heights.push(raster.info.height);
      if (raster.info.height > 1024) throw new DocumentContentError("TIMEOUT");
      const codes = new Set<number>();
      for (let offset = 0; offset < raster.data.length; offset += raster.info.channels) {
        const value = raster.data[offset];
        if (
          value > 0 &&
          value <= 20 &&
          raster.data[offset + 1] === 0 &&
          raster.data[offset + 2] === 0
        )
          codes.add(value);
      }
      return {
        text: JSON.stringify({
          rows: [...codes]
            .sort((a, b) => a - b)
            .map((value) => ({
              values: [
                `Material ${value}`,
                "Kayu",
                "lembar",
                "Gudang",
                "",
                "Ya",
                "18 mm",
                "Contoh",
                `MAT-${value}`,
                "Putih",
                "5",
                "Rp 245.000",
              ],
              uncertain: value === 7,
            })),
        }),
      };
    },
  );
  try {
    const sources: MaterialSource[] = [];
    let pages = 1;
    for (let index = 0; index < pages; index++) {
      const result = await extractMaterialSources(
        actor,
        "http://fixture.invalid/catalog",
        AbortSignal.timeout(2000),
        index,
      );
      pages = result.totalPages;
      sources.push(...result.sources);
    }
    expect(sources).toHaveLength(20);
    expect(sources[6].raw).toContain("[?]");
    const mapped = await mapMaterialSources(sources, {}, AbortSignal.timeout(2000));
    expect(mapped).toHaveLength(20);
    expect(mapped.map((row) => row.fields.code)).toEqual(
      Array.from({ length: 20 }, (_, i) => `MAT-${i + 1}`),
    );
    expect(
      mapped.every((row) => row.fields.lastPurchasePrice === 245000 && row.fields.withoutVendor),
    ).toBe(true);
    expect(Math.max(...heights)).toBeLessThanOrEqual(1024);
  } finally {
    reader.mockRestore();
    provider.mockRestore();
  }
});

import { materialImageRegions } from "./material-image-regions";

test("safe regions preserve every pixel and leave a tall unseparated image intact", async () => {
  const bytes = await sharp({
    create: { width: 100, height: 2500, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const regions = await materialImageRegions(bytes);
  expect(regions?.[0].top).toBe(0);
  expect(regions?.reduce((sum, region) => sum + region.height, 0)).toBe(2500);
  for (const [index, region] of (regions ?? []).entries())
    if (index)
      expect(region.top).toBe((regions ?? [])[index - 1].top + (regions ?? [])[index - 1].height);
  const dark = await sharp({
    create: { width: 100, height: 2500, channels: 3, background: "black" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="100" height="2500"><rect x="50" y="0" width="1" height="2500" fill="white"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
  const intact = await materialImageRegions(dark);
  expect(intact).toHaveLength(1);
  expect(intact?.[0].height).toBe(2500);
});
