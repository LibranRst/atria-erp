import type { ZodIssue } from "zod";

import {
  changeOwnPasswordSchema,
  updateOwnProfileSchema,
  type UpdateOwnProfileInput,
} from "@atria/core/validations/profile";

/**
 * Keadaan formulir profil di klien, diturunkan dari skema yang sama dengan yang
 * ditegakkan server.
 *
 * Sheet tidak menuliskan aturannya sendiri. Menyalin "minimal 12 karakter, ada
 * huruf besar" ke dalam komponen berarti dua tempat harus berubah bersamaan
 * setiap kali kebijakannya bergeser — dan yang satu akan tertinggal.
 */

/** Foto punya tiga keadaan yang harus dibedakan sampai ke server. */
export type PhotoDecision =
  | { readonly kind: "untouched" }
  | { readonly kind: "removed" }
  | { readonly kind: "replaced"; readonly url: string };

type ParseFailure = {
  readonly success: false;
  readonly error: { readonly issues: readonly ZodIssue[] };
};
type ParseResult = { readonly success: true } | ParseFailure;

function firstIssueForPath(result: ParseResult, path: string): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === path)?.message;
}

/**
 * Kolom kosong belum salah — ia baru belum diisi. Galat hanya muncul setelah
 * ada yang diketik; tombol Simpan yang menahan submit selama kolomnya kosong.
 */
export function getDisplayNameError(name: string): string | undefined {
  if (name.trim().length === 0) return undefined;
  return firstIssueForPath(updateOwnProfileSchema.safeParse({ name }), "name");
}

export function canSubmitProfile(name: string): boolean {
  return updateOwnProfileSchema.safeParse({ name }).success;
}

export function getNewPasswordError(
  currentPassword: string,
  newPassword: string,
): string | undefined {
  if (newPassword.length === 0) return undefined;

  const result = changeOwnPasswordSchema.safeParse({
    // Kolom lama diisi penampung saat masih kosong supaya galatnya berbicara
    // tentang kolom yang sedang diketik, bukan tentang kolom yang belum disentuh.
    currentPassword: currentPassword.length > 0 ? currentPassword : "-",
    newPassword,
  });

  return firstIssueForPath(result, "newPassword");
}

export function getConfirmPasswordError(
  newPassword: string,
  confirmPassword: string,
): string | undefined {
  if (confirmPassword.length === 0) return undefined;
  return confirmPassword === newPassword
    ? undefined
    : "Konfirmasi tidak sama dengan password baru.";
}

export function canSubmitPassword({
  currentPassword,
  newPassword,
  confirmPassword,
}: {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}): boolean {
  if (confirmPassword !== newPassword) return false;
  return changeOwnPasswordSchema.safeParse({ currentPassword, newPassword }).success;
}

/**
 * `imageUrl` sengaja dihilangkan — bukan dikirim sebagai `undefined` eksplisit —
 * ketika foto tidak disentuh, supaya bentuk payload-nya sama dengan yang
 * divalidasi skema.
 */
export function toUpdateProfileInput(name: string, photo: PhotoDecision): UpdateOwnProfileInput {
  const trimmedName = name.trim();
  if (photo.kind === "untouched") return { name: trimmedName };
  return { name: trimmedName, imageUrl: photo.kind === "removed" ? null : photo.url };
}
