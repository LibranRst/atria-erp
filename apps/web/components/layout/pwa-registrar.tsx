"use client";

import * as React from "react";

import { captureInstallPrompt } from "@/lib/pwa/install";
import { registerServiceWorker } from "@/lib/pwa/service-worker";

/**
 * Penyalaan PWA seluruh aplikasi: mendaftarkan service worker dan memasang
 * penangkap prompt pemasangan, sekali saat mount.
 *
 * Registrasi dulu hanya terjadi ketika pengguna menekan **Aktifkan** di halaman
 * Notifikasi. Akibatnya halaman offline tidak pernah tersedia, dan
 * `beforeinstallprompt` — yang hanya dikirim sekali per kunjungan — sering
 * terlewat sebelum halaman Notifikasi sempat dibuka.
 *
 * Komponen ini tidak menampilkan apa pun dan tidak pernah meminta izin
 * notifikasi: izin hanya muncul dari klik eksplisit pengguna.
 */
export function PwaRegistrar(): null {
  React.useEffect(() => {
    void registerServiceWorker();
    captureInstallPrompt();
  }, []);

  return null;
}
