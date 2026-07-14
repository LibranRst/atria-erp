export type ActionResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code:
          | "UNAUTHORIZED" // Tidak terautentikasi (sesi tidak valid)
          | "FORBIDDEN" // Tidak memiliki hak akses peran (RBAC check gagal)
          | "CONFLICT" // Versi data berubah sejak terakhir dibaca
          | "VALIDATION_ERROR" // Input form tidak sesuai schema Zod
          | "INSUFFICIENT_FUNDS" // Saldo bank kurang untuk transaksi kas keluar
          | "TRANSACTION_FAILED" // Kegagalan di level database transaction / rollback
          | "NOT_FOUND" // Entitas database tidak ditemukan
          | "INTERNAL_SERVER_ERROR"; // Kesalahan sistem lainnya
        message: string;
        details?: Record<string, string[]>; // Error spesifik field (biasanya dari Zod)
      };
    };
