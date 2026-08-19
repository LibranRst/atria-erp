import type * as React from "react";

/**
 * Kontrak bersama antara registry renderer dan tiap renderer.
 *
 * Diletakkan di modul tersendiri, bukan di `index.tsx`, karena registry mengimpor
 * setiap renderer dan setiap renderer membutuhkan tipe ini — menaruhnya di
 * registry akan membuat lingkaran impor.
 */

/**
 * Konteks yang dikumpulkan dari seluruh part di satu balasan.
 *
 * Beberapa tool hanya menerima `projectId` dan tidak ikut mengembalikan nama
 * proyeknya, sehingga kartunya tampil tanpa identitas — dan ketika satu
 * pertanyaan memicu empat kartu budget sekaligus, keempatnya jadi tidak bisa
 * dibedakan. Nama diambil dari keluaran `listProjects` di balasan yang sama,
 * jadi identitas tetap pulih termasuk untuk pesan lama yang sudah tersimpan.
 */
export type ToolResultContext = {
  /** Peta id proyek → nama, dikumpulkan dari keluaran listProjects. */
  readonly projectNames: Readonly<Record<string, string>>;
  /** Id proyek dari argumen tool ini, bila ada. */
  readonly projectId?: string;
  /**
   * Dipanggil saat kartu menavigasi ke rute lain di aplikasi.
   *
   * Efek yang menutup sheet berdasarkan perubahan pathname tidak pernah
   * terpicu kalau tujuannya adalah rute yang sedang dibuka pengguna — Next.js
   * tidak menganggap itu navigasi. Menutup langsung di sini tidak bergantung
   * pada perbandingan rute sama sekali, jadi kasus itu ikut tertangani.
   */
  readonly onNavigate?: () => void;
};

/**
 * Konteks bersifat opsional: sebuah kartu tetap harus bisa dirender tanpanya,
 * hanya kehilangan kemampuan memulihkan nama proyek.
 */
export const EMPTY_TOOL_RESULT_CONTEXT: ToolResultContext = { projectNames: {} };

export type ToolResultProps = {
  readonly output: unknown;
  readonly context?: ToolResultContext;
};

export type ToolResultRenderer = (props: ToolResultProps) => React.JSX.Element | null;

/**
 * Menentukan nama proyek yang paling tepercaya untuk sebuah kartu:
 * dari keluaran tool itu sendiri, lalu dari daftar proyek di balasan yang sama.
 */
export function resolveProjectName(
  context: ToolResultContext,
  fromOutput: string | undefined,
  projectId: string | undefined,
): string | null {
  if (fromOutput) return fromOutput;
  const id = projectId ?? context.projectId;
  return id ? (context.projectNames[id] ?? null) : null;
}
