/**
 * Inisial nama untuk avatar.
 *
 * Tinggal di `@atria/core` karena dipakai dua lapis yang tidak boleh saling
 * mengimpor: loader halaman profil di `features/**` dan bilah atas di
 * `components/layout/**`. Menaruhnya di salah satu sisi akan membuat sisi lain
 * menyalin aturannya sendiri — dan dua akun yang sama akan tampil berbeda.
 */
export function getProfileInitials(name: string): string {
  const initials = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "A";
}
