import { expect, test } from "bun:test";
import sharp from "sharp";
import { profileAvatarJpeg } from "./profile-avatar-storage";
test("avatar decoding centre-crops to512 square and strips source metadata", async () => {
  const input = await sharp({
    create: { width: 160, height: 80, channels: 3, background: { r: 30, g: 40, b: 50 } },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: "PRIVATE_SOURCE_METADATA" } })
    .toBuffer();
  const result = await profileAvatarJpeg(input, "image/jpeg"),
    meta = await sharp(result).metadata();
  expect([meta.width, meta.height, meta.format]).toEqual([512, 512, "jpeg"]);
  expect(meta.exif).toBeUndefined();
  expect(meta.icc).toBeUndefined();
});
test("invalid, unsupported and oversized image data fail before public avatar storage", async () => {
  await expect(profileAvatarJpeg(new Uint8Array([1, 2, 3]), "image/png")).rejects.toThrow(
    "Foto tidak dapat dibaca",
  );
  await expect(profileAvatarJpeg(new Uint8Array([1, 2, 3]), "image/gif")).rejects.toThrow(
    "Gunakan JPG",
  );
  await expect(
    profileAvatarJpeg(new Uint8Array(8 * 1024 * 1024 + 1), "image/jpeg"),
  ).rejects.toThrow("Gunakan JPG");
});
