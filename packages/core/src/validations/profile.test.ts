import { describe, expect, test } from "bun:test";

import { changeOwnPasswordSchema, updateOwnProfileSchema } from "./profile";

const VALID_IMAGE_URL = "https://ik.imagekit.io/dekoria/user-avatars/avatar-1.jpg";

describe("updateOwnProfileSchema", () => {
  test("nama dipangkas dan dibatasi 2–80 karakter", () => {
    const trimmed = updateOwnProfileSchema.safeParse({ name: "  Budi Santoso  " });
    expect(trimmed.success).toBe(true);
    expect(trimmed.success && trimmed.data.name).toBe("Budi Santoso");

    expect(updateOwnProfileSchema.safeParse({ name: "B" }).success).toBe(false);
    expect(updateOwnProfileSchema.safeParse({ name: "B".repeat(81) }).success).toBe(false);
    expect(updateOwnProfileSchema.safeParse({ name: "B".repeat(80) }).success).toBe(true);
  });

  test("nama yang hanya berisi spasi ditolak setelah dipangkas", () => {
    expect(updateOwnProfileSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  test("foto tanpa nilai, null, dan URL adalah tiga keadaan berbeda", () => {
    const untouched = updateOwnProfileSchema.safeParse({ name: "Budi" });
    expect(untouched.success && "imageUrl" in untouched.data).toBe(false);

    const removed = updateOwnProfileSchema.safeParse({ name: "Budi", imageUrl: null });
    expect(removed.success && removed.data.imageUrl).toBe(null);

    const replaced = updateOwnProfileSchema.safeParse({ name: "Budi", imageUrl: VALID_IMAGE_URL });
    expect(replaced.success && replaced.data.imageUrl).toBe(VALID_IMAGE_URL);
  });

  test("URL foto di luar host ImageKit ditolak", () => {
    // Klien mengirim URL hasil unggahnya sendiri; tanpa batasan ini kolom
    // `user.image` menjadi tempat menaruh URL sembarang yang dimuat peramban
    // setiap orang yang melihat avatar tersebut.
    for (const url of [
      "https://attacker.example.com/pixel.gif",
      "http://ik.imagekit.io/dekoria/avatar.jpg",
      "https://ik-imagekit-io.example.com/dekoria/avatar.jpg",
      "javascript:alert(1)",
    ]) {
      expect(updateOwnProfileSchema.safeParse({ name: "Budi", imageUrl: url }).success).toBe(false);
    }
  });
});

describe("changeOwnPasswordSchema", () => {
  test("kata sandi baru mengikuti kebijakan yang sama dengan jalur admin", () => {
    const weak = changeOwnPasswordSchema.safeParse({
      currentPassword: "LamaSekali123",
      newPassword: "pendek1",
    });
    expect(weak.success).toBe(false);

    const strong = changeOwnPasswordSchema.safeParse({
      currentPassword: "LamaSekali123",
      newPassword: "RahasiaBaru123",
    });
    expect(strong.success).toBe(true);
  });

  test("kata sandi baru tidak boleh sama dengan yang lama", () => {
    const result = changeOwnPasswordSchema.safeParse({
      currentPassword: "RahasiaBaru123",
      newPassword: "RahasiaBaru123",
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(["newPassword"]);
  });

  test("kata sandi saat ini wajib diisi", () => {
    expect(
      changeOwnPasswordSchema.safeParse({ currentPassword: "", newPassword: "RahasiaBaru123" })
        .success,
    ).toBe(false);
  });
});
