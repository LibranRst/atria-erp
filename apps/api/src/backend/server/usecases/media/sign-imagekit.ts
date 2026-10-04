import crypto from "crypto";

import type { ActionResponse } from "@atria/core/types/action-response";
import { getErrorMessage } from "@atria/core/utils/error-message";

export interface ImageKitSignature {
  token: string;
  expire: number;
  signature: string;
}

/**
 * Menandatangani unggahan langsung client ke ImageKit CDN, supaya
 * `IMAGEKIT_PRIVATE_KEY` tidak pernah keluar dari server.
 *
 * Cukup sesi valid — tidak ada izin khusus, jadi use-case ini tidak menerima
 * `Actor`. Kedua pemanggilnya (Server Action dan prosedur tRPC) sudah menolak
 * request tanpa sesi sebelum sampai ke sini. Dipakai jalur web maupun kamera
 * di klien native.
 */
export async function signImagekitUseCase(): Promise<ActionResponse<ImageKitSignature>> {
  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Kunci privat ImageKit belum dikonfigurasi di server.",
        },
      };
    }

    // Generate parameter otentikasi sekali pakai untuk ImageKit
    const token = crypto.randomBytes(16).toString("hex");
    const expire = Math.floor(Date.now() / 1000) + 2400; // 40 menit masa berlaku token

    // Buat tanda tangan HMAC-SHA1 dari token + expire
    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return {
      success: true,
      data: {
        token,
        expire,
        signature,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: getErrorMessage(error, "Gagal menghasilkan tanda tangan otentikasi ImageKit."),
      },
    };
  }
}
