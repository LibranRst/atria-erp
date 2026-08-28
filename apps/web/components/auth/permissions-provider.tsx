"use client";

import React from "react";

import type { PermissionKey } from "@atria/core/auth/permissions";

/**
 * Izin pengguna berjalan, diselesaikan server dan diturunkan ke klien.
 *
 * Sebelum ini, komponen klien memanggil `actorHasPermission` yang membaca
 * matriks **kode**. Sejak izin bisa disunting Owner, matriks itu hanya nilai
 * seed — artinya mencabut izin akan menghentikan aksinya di server sementara
 * tombolnya tetap terpampang. Menurunkan daftar yang sama dengan yang ditegakkan
 * server menutup selisih itu.
 *
 * Daftar ini ikut siklus render halaman: ia disegarkan pada navigasi dan
 * `router.refresh()`, dan tidak pernah ditanam ke sesi atau token — izin yang
 * ditanam basi persis ketika ketepatannya paling penting.
 */
const PermissionsContext = React.createContext<readonly PermissionKey[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  readonly permissions: readonly PermissionKey[];
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

/** `false` di luar provider — gagal ke arah tertutup, bukan terbuka. */
export function usePermission(permission: PermissionKey): boolean {
  return React.useContext(PermissionsContext).includes(permission);
}

export function usePermissions(): readonly PermissionKey[] {
  return React.useContext(PermissionsContext);
}

/**
 * Bentuk yang dipakai komponen: satu panggilan hook di puncak, lalu pertanyaan
 * sebanyak yang dibutuhkan di mana pun — termasuk di dalam JSX bersyarat, di
 * mana memanggil hook langsung akan melanggar aturan urutan hook.
 */
export function useCan(): (permission: PermissionKey) => boolean {
  const permissions = usePermissions();
  return React.useCallback(
    (permission: PermissionKey) => permissions.includes(permission),
    [permissions],
  );
}
