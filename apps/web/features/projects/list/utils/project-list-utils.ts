/**
 * Shim kompatibilitas.
 *
 * Helper filter dan ringkasan portofolio kini berada di
 * `@atria/core/project/project-list` supaya web dan klien native memakai
 * perhitungan yang sama. File ini dipertahankan agar pemanggil lama tidak perlu
 * diubah; kode baru sebaiknya mengimpor langsung dari core.
 */
export * from "@atria/core/project/project-list";
