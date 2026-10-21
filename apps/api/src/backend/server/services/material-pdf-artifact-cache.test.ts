import { expect, spyOn, test } from "bun:test";
import sharp from "sharp";
import * as privateFiles from "@backend/server/usecases/media/private-attachments";
import * as artifacts from "@backend/lib/ai/pdf-page-artifact-cache";
import { documentModel } from "@backend/lib/ai/document-model";
import type { RenderedPdfPages } from "@backend/lib/ai/pdf-pages";
import type { Actor } from "@backend/server/actor";
import { extractMaterialSources } from "./material-analysis-source";

test("cached PDF raster pages still require a fresh private-source read on every material step", async (): Promise<void> => {
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
  const url = "https://fixture.invalid/private-catalog.pdf";
  const sourceBytes = Buffer.from("%PDF-synthetic-owned");
  const imageBytes = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  let reads = 0;
  let renders = 0;
  const reader = spyOn(privateFiles, "readPrivateAttachment").mockImplementation(
    async (
      current: Actor,
      currentUrl: string,
    ): Promise<Awaited<ReturnType<typeof privateFiles.readPrivateAttachment>>> => {
      reads++;
      expect(current.userId).toBe(id);
      expect(currentUrl).toBe(url);
      if (reads === 3) throw new Error("Private source access no longer available");
      return {
        row: {
          id,
          tenantId: id,
          fileName: "catalog.pdf",
          fileUrl: url,
          storageFileId: "fixture",
          fileSize: sourceBytes.byteLength,
          mimeType: "application/pdf",
          uploadedById: id,
          referenceType: "private_ai_chat",
          referenceId: id,
          createdAt: new Date(),
        },
        bytes: sourceBytes,
      };
    },
  );
  const cachedRenderer = artifacts.createImmutablePdfRenderer(
    async (_bytes: Uint8Array, _signal: AbortSignal): Promise<RenderedPdfPages> => {
      renders++;
      return {
        total: 2,
        byteLength: imageBytes.byteLength * 2,
        pages: [1, 2].map((pageNumber) => ({
          pageNumber,
          bytes: new Uint8Array(imageBytes),
          mediaType: "image/png",
          width: 100,
          height: 100,
        })),
      };
    },
  );
  const renderer = spyOn(artifacts, "renderImmutablePdfPages").mockImplementation(cachedRenderer);
  const provider = spyOn(documentModel.models, "generateContent").mockResolvedValue({
    text: JSON.stringify({
      rows: [
        {
          values: ["MDF", "Papan", "lembar", "Gudang", "", "Ya", "", "", "", "", "0", "125000"],
          uncertain: true,
        },
      ],
    }),
  });
  try {
    const first = await extractMaterialSources(actor, url, AbortSignal.timeout(1000), 0);
    const second = await extractMaterialSources(actor, url, AbortSignal.timeout(1000), 1);
    expect(first.totalPages).toBe(2);
    expect(second.totalPages).toBe(2);
    expect(first.sources[0]?.page).toBe(1);
    expect(second.sources[0]?.page).toBe(2);
    expect(second.sources[0]?.raw).toContain("[?]");
    expect(reads).toBe(2);
    expect(renders).toBe(1);
    await expect(extractMaterialSources(actor, url, AbortSignal.timeout(1000), 0)).rejects.toThrow(
      "Private source access no longer available",
    );
    expect(reads).toBe(3);
    expect(renderer).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledTimes(2);
  } finally {
    reader.mockRestore();
    renderer.mockRestore();
    provider.mockRestore();
  }
});
