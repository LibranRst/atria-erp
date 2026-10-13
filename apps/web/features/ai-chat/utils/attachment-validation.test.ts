import { describe, expect, test } from "bun:test";
import {
  isSupportedAttachment,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAttachmentBatch,
  CHAT_ATTACHMENT_OPTIONS,
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
  test("pilihan menu mencakup seluruh ekstensi yang didukung server", () => {
    for (const option of CHAT_ATTACHMENT_OPTIONS)
      for (const extension of option.accept.split(","))
        expect(isSupportedAttachment({ name: `material${extension}`, size: 100 })).toEqual({
          valid: true,
        });
  });
  test("menolak tipe MIME palsu dan berkas kosong sebelum upload", () => {
    expect(isSupportedAttachment({ name: "program.exe", type: "image/png", size: 100 }).valid).toBe(
      false,
    );
    expect(isSupportedAttachment({ name: "material.txt", size: 0 }).valid).toBe(false);
    expect(isSupportedAttachment({ name: "material.constructor", size: 100 }).valid).toBe(false);
  });
  test("menjaga empat lampiran tanpa memotong pilihan diam-diam", () => {
    const files = Array.from({ length: 4 }, (_, i) => ({ name: `material-${i}.xlsx`, size: 100 }));
    expect(validateAttachmentBatch(files, 0).valid).toBe(true);
    expect(validateAttachmentBatch(files, 1).valid).toBe(false);
    expect(validateAttachmentBatch([files[0]], 4).valid).toBe(false);
  });
});
