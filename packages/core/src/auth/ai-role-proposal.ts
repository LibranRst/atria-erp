import { CRITICAL_PERMISSIONS, PERMISSION_LABELS } from "./permission-catalog";
import type { PermissionKey } from "./permissions";

/**
 * Pagar khusus untuk perubahan izin yang datang lewat kartu asisten.
 *
 * Jalur layar "Peran & akses" tetap boleh mengubah izin apa pun — di sana Owner
 * duduk di depan daftar lengkap, membaca setiap sakelar, dan memutuskan. Jalur
 * ini berbeda sifatnya: gesekannya rendah, konteksnya percakapan, dan yang
 * menekan konfirmasi jarang membaca ulang seluruh peran.
 *
 * Karena itu sebagian izin dilarang total dari jalur ini. Bukan karena Owner
 * tidak berhak mengubahnya, melainkan karena satu ketukan bukan bentuk keputusan
 * yang pantas untuknya. Layarnya tetap terbuka; yang ditutup hanya jalan
 * pintasnya.
 */
export const AI_PROPOSAL_FORBIDDEN_PERMISSIONS: Partial<Record<PermissionKey, string>> = {
  // Jalur yang bisa memperluas dirinya sendiri: sekali diberikan, penerimanya
  // bisa memakai kartu berikutnya untuk memberikan apa pun.
  "manage:roles": "mengubah peran dan izin",
  "manage:users": "membuat dan mengubah akun tim",
  // Memindahkan uang keluar perusahaan.
  "pay:cost": "mencairkan pengeluaran lapangan",
  "pay:vendor_bill": "membayar tagihan vendor",
  // Melewati pemisahan tugas: pemegangnya bisa menyetujui pengajuannya sendiri.
  "override:self_approval": "menyetujui pengajuan sendiri",
};

export function findForbiddenProposalPermissions(
  keys: readonly PermissionKey[],
): readonly { readonly key: PermissionKey; readonly capability: string }[] {
  return keys
    .filter((key) => AI_PROPOSAL_FORBIDDEN_PERMISSIONS[key] !== undefined)
    .map((key) => ({ key, capability: AI_PROPOSAL_FORBIDDEN_PERMISSIONS[key] as string }));
}

export function describeForbiddenProposal(
  forbidden: readonly { readonly key: PermissionKey; readonly capability: string }[],
): string {
  const list = forbidden.map((entry) => entry.capability).join(", ");
  return `Izin untuk ${list} tidak dapat diubah lewat asisten. Ubah di Pengaturan › Tim, Vendor & Peran.`;
}

/**
 * Kalimat konsekuensi per izin, dipakai kartu konfirmasi.
 *
 * Kartu yang hanya memuat daftar kunci tidak bisa dinilai dalam satu ketukan —
 * itu keberatan utama terhadap jalur ini, dan ini jawabannya. Untuk izin yang
 * kehilangannya menghentikan alur kerja, kalimatnya menyebut apa yang berhenti.
 */
export function describePermissionEffect(
  key: PermissionKey,
  direction: "grant" | "revoke",
): string {
  const label = PERMISSION_LABELS[key];
  if (direction === "grant") return `Bisa ${label.toLowerCase()}`;

  const critical = CRITICAL_PERMISSIONS[key];
  return critical ? `Berhenti bisa ${label.toLowerCase()}` : `Tidak lagi ${label.toLowerCase()}`;
}
