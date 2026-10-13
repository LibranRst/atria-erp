import { expect, test } from "bun:test";
import { boundedAttachmentPreview } from "./attachment-preview";
test("complete source stays intact while line/character limits disclose incompleteness", () => {
  const text = Array.from({ length: 100 }, (_, i) => `Material ${i}`).join("\n");
  expect(boundedAttachmentPreview(text)).toBe(text);
  expect(boundedAttachmentPreview(`${text}\nMaterial 101`)).toContain("PREVIEW TIDAK LENGKAP");
  expect(boundedAttachmentPreview("a".repeat(8001))).toContain("PREVIEW TIDAK LENGKAP");
  expect(boundedAttachmentPreview("a".repeat(8000))).toHaveLength(8000);
});
