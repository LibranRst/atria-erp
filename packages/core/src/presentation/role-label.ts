/**
 * Nama peran untuk dibaca manusia: `FINANCE_ADMIN` → "Finance Admin".
 *
 * Sengaja tanpa tabel pencarian. Peran buatan Owner tidak akan pernah ada di
 * tabel mana pun, dan title-case memberi keempat peran bawaan hasil yang persis
 * sama seperti daftar hardcoded yang dulu dipakai.
 *
 * Tinggal di core karena dipakai dua sisi yang tidak boleh saling mengimpor:
 * layar administrasi dan kartu usulan di chat AI. Ketika hanya satu sisi yang
 * memformat, kartu menampilkan `PROJECT_MANAGER` sementara layarnya menampilkan
 * "Project Manager" — dua ejaan untuk satu peran, di layar yang sama.
 */
export function formatRoleLabel(name: string): string {
  const words = name
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");
  if (!words) return "—";

  return words
    .split(" ")
    .map((word) => word.charAt(0).toLocaleUpperCase("id-ID") + word.slice(1))
    .join(" ");
}
