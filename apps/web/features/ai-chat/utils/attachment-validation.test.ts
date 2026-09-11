import { describe, expect, test } from "bun:test";
import {
  isSupportedAttachment,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "./attachment-validation";

describe("isSupportedAttachment", () => {
  test("menerima gambar dengan format umum", () => {
    expect(isSupportedAttachment({ name: "struk.jpg", size: 1024, type: "image/jpeg" })).toEqual({
      valid: true,
    });
    expect(isSupportedAttachment({ name: "denah.png", size: 2048, type: "image/png" })).toEqual({
      valid: true,
    });
    expect(isSupportedAttachment({ name: "foto.webp", size: 500, type: "image/webp" })).toEqual({
      valid: true,
    });
  });

  test("menerima dokumen PDF", () => {
    expect(
      isSupportedAttachment({ name: "rab-final.pdf", size: 5000, type: "application/pdf" }),
    ).toEqual({ valid: true });
  });

  test("menerima spreadsheet Excel dan CSV", () => {
    expect(
      isSupportedAttachment({
        name: "material.xlsx",
        size: 8000,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).toEqual({ valid: true });

    expect(
      isSupportedAttachment({
        name: "daftar_harga.csv",
        size: 3000,
        type: "text/csv",
      }),
    ).toEqual({ valid: true });
  });

  test("menerima berkas teks dan markdown", () => {
    expect(isSupportedAttachment({ name: "catatan.txt", size: 100, type: "text/plain" })).toEqual({
      valid: true,
    });
    expect(isSupportedAttachment({ name: "brief.md", size: 200, type: "text/markdown" })).toEqual({
      valid: true,
    });
  });

  test("menerima berkas berdasarkan ekstensi valid meskipun tipe MIME kosong", () => {
    expect(isSupportedAttachment({ name: "invoice.pdf", size: 1000 })).toEqual({ valid: true });
    expect(isSupportedAttachment({ name: "data.xlsx", size: 1000 })).toEqual({ valid: true });
  });

  test("menolak berkas yang melebihi batas 10 MB", () => {
    const result = isSupportedAttachment({
      name: "video-proyek.mp4",
      size: MAX_ATTACHMENT_SIZE_BYTES + 1,
      type: "video/mp4",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("melebihi 10 MB");
    }
  });

  test("menolak ekstensi yang tidak didukung", () => {
    const result = isSupportedAttachment({
      name: "arsip.zip",
      size: 5000,
      type: "application/zip",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("tidak didukung");
    }
  });

  test("menolak file executable", () => {
    const result = isSupportedAttachment({
      name: "malware.exe",
      size: 1000,
      type: "application/x-msdownload",
    });
    expect(result.valid).toBe(false);
  });
});
