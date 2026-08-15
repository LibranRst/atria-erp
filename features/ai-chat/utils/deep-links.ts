/**
 * Tujuan tautan dari kartu chat ke data aslinya di aplikasi.
 *
 * Disatukan di sini supaya rute tidak tersebar sebagai string di banyak renderer.
 * Setiap fungsi mengembalikan `null` ketika id yang dibutuhkan tidak tersedia —
 * pesan lama tersimpan sebelum id ikut dikembalikan tool, dan kartu tanpa tautan
 * jauh lebih baik daripada tautan yang menuju halaman yang salah.
 */

export function projectOverviewHref(projectId: string | undefined): string | null {
  return projectId ? `/projects/${projectId}?tab=overview` : null;
}

export function projectBudgetHref(projectId: string | undefined): string | null {
  return projectId ? `/projects/${projectId}?tab=budget` : null;
}

export function bankAccountsHref(): string {
  return "/ledger?tab=cash";
}

export function approvalsHref(): string {
  return "/approvals";
}

export function expensesHref(): string {
  return "/expenses";
}

export function materialsHref(): string {
  return "/materials";
}
