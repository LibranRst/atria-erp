/**
 * Shim kompatibilitas.
 *
 * Kontrak daftar proyek kini berada di `@atria/core/types/projects` supaya web
 * dan klien native memakai bentuk data yang sama persis. File ini dipertahankan
 * agar pemanggil lama tidak perlu diubah; kode baru sebaiknya mengimpor
 * langsung dari core.
 */
export type * from "@atria/core/types/projects";
