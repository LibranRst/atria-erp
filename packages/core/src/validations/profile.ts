import { z } from "zod";

import { passwordPolicySchema } from "./administration";

/**
 * Skema untuk perubahan yang dilakukan pengguna atas akunnya sendiri.
 *
 * Tidak ada `userId` di sini, dan itu disengaja: identitas selalu diselesaikan
 * server dari sesi. Modul `"use server"` adalah endpoint HTTP, jadi setiap
 * identitas yang datang sebagai argumen bisa dipalsukan klien.
 */

/**
 * 80 karakter, bukan 255 seperti kolomnya. Nama sepanjang itu memecah identity
 * surface di 320 px, dan tidak ada nama nyata yang membutuhkannya.
 */
const displayName = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(80, "Nama maksimal 80 karakter.");

/**
 * URL foto dibatasi ke host ImageKit.
 *
 * Klien mengirimkan URL hasil unggahnya sendiri, jadi tanpa batasan ini kolom
 * `user.image` menjadi tempat menaruh URL sembarang yang kemudian dimuat
 * peramban setiap pengguna lain yang melihat avatar tersebut.
 */
const IMAGEKIT_URL_PATTERN = /^https:\/\/ik\.imagekit\.io\/[A-Za-z0-9_-]+\/\S+$/;

const avatarUrl = z
  .string()
  .trim()
  .max(2048, "URL foto terlalu panjang.")
  .regex(IMAGEKIT_URL_PATTERN, "URL foto tidak dikenali.");

/**
 * `imageUrl` punya tiga arti yang harus bisa dibedakan di kabel:
 * `undefined` — foto tidak disentuh, `null` — foto dihapus, string — foto baru.
 * Sheet mengirim nama dan foto dalam satu submit, jadi "tidak mengubah foto"
 * tidak boleh terlihat sama dengan "hapus foto".
 */
export const updateOwnProfileSchema = z.object({
  name: displayName,
  imageUrl: avatarUrl.nullable().optional(),
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: passwordPolicySchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Password baru tidak boleh sama dengan password saat ini.",
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
