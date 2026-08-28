/**
 * Pengecilan gambar di sisi klien sebelum diunggah.
 *
 * Foto dari kamera ponsel biasanya 3–8 MB, sementara avatar tidak pernah
 * dirender lebih besar dari 64 CSS px. Mengecilkannya di peramban membuat
 * unggahan di jaringan lapangan selesai dalam hitungan ratusan milidetik alih-alih
 * belasan detik, dan CDN tidak perlu menyimpan berkas yang tidak akan pernah
 * dipakai pada ukuran aslinya.
 *
 * Hanya untuk peramban: `document` dan `createImageBitmap` tidak ada di server
 * maupun di Bun test, jadi modul ini tidak boleh diimpor dari kode server.
 */

export type SquareJpegOptions = {
  /** Sisi keluaran dalam piksel. */
  readonly size?: number;
  /** Kualitas JPEG 0–1. */
  readonly quality?: number;
};

/**
 * Memotong bagian tengah gambar menjadi bujur sangkar lalu mengecilkannya ke
 * JPEG berukuran tetap.
 *
 * `imageOrientation: "from-image"` penting: tanpa itu foto potret dari iPhone
 * mendarat dalam orientasi mentahnya dan tampil miring 90°, karena rotasinya
 * hanya tercatat di metadata EXIF.
 */
export async function cropImageToSquareJpeg(
  file: File,
  { size = 512, quality = 0.82 }: SquareJpegOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Berkas harus berupa gambar.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("Gambar tidak dapat dibaca. Coba pilih berkas lain.");
  });

  try {
    const edge = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - edge) / 2;
    const sourceY = (bitmap.height - edge) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Peramban tidak mendukung pemrosesan gambar.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, sourceX, sourceY, edge, edge, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) {
      throw new Error("Gagal memproses gambar.");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
