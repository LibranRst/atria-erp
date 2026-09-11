"use client";

import Image from "next/image";
import React from "react";

/**
 * Satu aturan tampil untuk foto profil di seluruh aplikasi.
 *
 * Sebelum primitif ini ada, avatar dirender dua kali dengan aturan berbeda:
 * permukaan identitas memakai foto sesi dengan cadangan inisial, sementara bilah
 * atas memasang satu foto stok yang sama untuk setiap pengguna. Perbedaan itu
 * bisa hidup berbulan-bulan justru karena tidak ada tempat tunggal yang
 * menyatakan seperti apa avatar seharusnya.
 *
 * Pembagian tanggung jawabnya sengaja tajam: **geometri milik pemanggil**
 * (lewat `className`), sedangkan primitif ini memiliki pengguntingan lingkaran,
 * cadangan inisial, penanganan gambar gagal muat, dan transformasi CDN.
 */

export type UserAvatarProps = {
  readonly imageUrl?: string | null;
  /** Cadangan saat foto kosong atau gagal dimuat. */
  readonly initials: string;
  /** Dipakai untuk teks alternatif; kosongkan bila avatar murni dekoratif. */
  readonly displayName?: string;
  /**
   * Ukuran render dalam CSS px. Bukan pengatur kotak — itu tugas `className` —
   * melainkan dasar permintaan ukuran berkas ke CDN.
   */
  readonly renderPx: number;
  /** Kelas kotak dan tipografi inisial. */
  readonly className?: string;
};

const IMAGEKIT_ORIGIN = "https://ik.imagekit.io/";

/**
 * Meminta CDN mengirim berkas seukuran render, bukan 512 px penuh.
 *
 * Transformasi dilakukan ImageKit di edge, bukan oleh optimizer Next: gambarnya
 * sudah dikecilkan di peramban sebelum diunggah, jadi melewatkannya sekali lagi
 * ke jalur serverless hanya menambah lompatan tanpa menghemat byte.
 */
function withImageKitTransform(url: string, renderPx: number): string {
  if (!url.startsWith(IMAGEKIT_ORIGIN)) return url;

  // 2× untuk layar retina; avatar terbesar di aplikasi ini 64 px.
  const requested = Math.min(Math.round(renderPx * 2), 512);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tr=w-${requested},h-${requested}`;
}

export function UserAvatar({
  imageUrl,
  initials,
  displayName,
  renderPx,
  className = "",
}: UserAvatarProps): React.JSX.Element {
  /*
   * Menyimpan URL yang gagal, bukan bendera boolean. Bendera akan menahan
   * cadangan inisial selamanya setelah satu kegagalan — termasuk untuk foto
   * baru yang barusan diunggah untuk menggantikannya.
   */
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <span
      className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary leading-none font-bold text-on-primary ${className}`}
    >
      <span aria-hidden={showImage} suppressHydrationWarning>
        {initials}
      </span>
      {showImage && imageUrl ? (
        <Image
          src={withImageKitTransform(imageUrl, renderPx)}
          alt={displayName ? `Foto profil ${displayName}` : ""}
          aria-hidden={displayName ? undefined : true}
          fill
          sizes={`${renderPx}px`}
          unoptimized
          className="object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : null}
    </span>
  );
}
