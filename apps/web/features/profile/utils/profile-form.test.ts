import { describe, expect, test } from "bun:test";

import {
  canSubmitPassword,
  canSubmitProfile,
  getConfirmPasswordError,
  getDisplayNameError,
  getNewPasswordError,
  toUpdateProfileInput,
} from "./profile-form";

const AVATAR_URL = "https://ik.imagekit.io/dekoria/user-avatars/avatar-1.jpg";

describe("keadaan formulir ubah profil", () => {
  test("kolom kosong belum dianggap salah, tetapi juga belum bisa disimpan", () => {
    expect(getDisplayNameError("")).toBeUndefined();
    expect(getDisplayNameError("   ")).toBeUndefined();
    expect(canSubmitProfile("")).toBe(false);
  });

  test("pesan galat nama datang dari skema yang sama dengan server", () => {
    expect(getDisplayNameError("R")).toBe("Nama minimal 2 karakter.");
    expect(getDisplayNameError("R".repeat(81))).toBe("Nama maksimal 80 karakter.");
    expect(getDisplayNameError("Ronald Wijaya")).toBeUndefined();
    expect(canSubmitProfile("  Ronald Wijaya  ")).toBe(true);
  });

  test("foto yang tidak disentuh tidak ikut dikirim", () => {
    const payload = toUpdateProfileInput("  Ronald  ", { kind: "untouched" });

    expect(payload).toEqual({ name: "Ronald" });
    expect("imageUrl" in payload).toBe(false);
  });

  test("hapus foto mengirim null, ganti foto mengirim URL", () => {
    expect(toUpdateProfileInput("Ronald", { kind: "removed" })).toEqual({
      name: "Ronald",
      imageUrl: null,
    });
    expect(toUpdateProfileInput("Ronald", { kind: "replaced", url: AVATAR_URL })).toEqual({
      name: "Ronald",
      imageUrl: AVATAR_URL,
    });
  });
});

describe("keadaan formulir ganti password", () => {
  test("kebijakan password tidak ditulis ulang di klien", () => {
    expect(getNewPasswordError("", "pendek")).toBe("Password minimal 12 karakter.");
    expect(getNewPasswordError("", "semuanyakecil123")).toBe(
      "Password wajib memiliki huruf besar.",
    );
    expect(getNewPasswordError("", "SEMUANYABESAR123")).toBe(
      "Password wajib memiliki huruf kecil.",
    );
    expect(getNewPasswordError("", "TanpaAngkaSamaSekali")).toBe("Password wajib memiliki angka.");
    expect(getNewPasswordError("", "RahasiaBaru123")).toBeUndefined();
  });

  test("password baru yang sama dengan yang lama ditolak", () => {
    expect(getNewPasswordError("RahasiaBaru123", "RahasiaBaru123")).toBe(
      "Password baru tidak boleh sama dengan password saat ini.",
    );
  });

  test("kolom password baru yang masih kosong tidak menyalakan galat", () => {
    expect(getNewPasswordError("RahasiaLama123", "")).toBeUndefined();
  });

  test("konfirmasi hanya dibandingkan setelah diketik", () => {
    expect(getConfirmPasswordError("RahasiaBaru123", "")).toBeUndefined();
    expect(getConfirmPasswordError("RahasiaBaru123", "RahasiaBaru124")).toBe(
      "Konfirmasi tidak sama dengan password baru.",
    );
    expect(getConfirmPasswordError("RahasiaBaru123", "RahasiaBaru123")).toBeUndefined();
  });

  test("submit menuntut ketiga kolom lengkap dan konsisten", () => {
    const valid = {
      currentPassword: "RahasiaLama123",
      newPassword: "RahasiaBaru123",
      confirmPassword: "RahasiaBaru123",
    };

    expect(canSubmitPassword(valid)).toBe(true);
    expect(canSubmitPassword({ ...valid, currentPassword: "" })).toBe(false);
    expect(canSubmitPassword({ ...valid, confirmPassword: "RahasiaBaru124" })).toBe(false);
    expect(canSubmitPassword({ ...valid, newPassword: "pendek", confirmPassword: "pendek" })).toBe(
      false,
    );
  });
});
