"use server";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { ActionResponse } from "@/lib/types/action-response";

export interface ImageKitSignature {
  token: string;
  expire: number;
  signature: string;
}

/**
 * Server Action untuk menandatangani otentikasi unggah berkas dari client langsung ke ImageKit CDN.
 * Mencegah eksposur IMAGEKIT_PRIVATE_KEY di client-side.
 */
export async function signImagekit(): Promise<ActionResponse<ImageKitSignature>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await (await import("next/headers")).cookies()).toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
      };
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Kunci privat ImageKit belum dikonfigurasi di server." },
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
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "Gagal menghasilkan tanda tangan otentikasi ImageKit.",
      },
    };
  }
}
