"use client";

import React from "react";

/**
 * Waktu maksimum sebuah kontainer boleh dipertahankan lebih tinggi daripada
 * konten aslinya sebelum dilepas paksa, meski pengguna belum scroll sama
 * sekali. Cukup singkat agar tidak terasa "nyangkut", cukup lama untuk
 * melewati commit + paint saat konten tab/filter berganti.
 */
const RELEASE_GRACE_MS = 600;

export interface PreservedScrollHeightResult {
  /** Pasang ke elemen pembungkus konten yang tingginya berubah antar tab/filter. */
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  /** Sebar ke `style` elemen yang sama dengan `containerRef`. */
  readonly containerStyle: React.CSSProperties | undefined;
  /**
   * Panggil tepat sebelum mengganti state/URL yang menukar konten, ketika
   * posisi scroll saat ini ingin dipertahankan (mis. ganti tab/filter biasa).
   * Tinggi lama dikunci sesaat lalu dilepas otomatis begitu pengguna scroll
   * atau setelah jeda singkat, sehingga kontainer selalu kembali mengikuti
   * tinggi konten yang sebenarnya alih-alih tersangkut di tab tertinggi yang
   * pernah dikunjungi.
   */
  readonly preserveScrollPosition: () => void;
  /**
   * Panggil ketika pergantian konten sengaja melompat ke posisi tertentu
   * (mis. aksi "buka RAP" yang menuju ke atas seksi lain), bukan
   * mempertahankan posisi saat ini.
   */
  readonly jumpToOnNextContent: (targetY: number) => void;
}

/**
 * Mencegah lompatan scroll saat konten tab/filter diganti dengan konten yang
 * tingginya berbeda, tanpa meninggalkan ruang kosong permanen ketika konten
 * baru lebih pendek. Pasang `contentKey` dengan nilai yang berubah setiap kali
 * konten berganti (mis. tab aktif atau filter aktif) — hook menggunakannya
 * untuk tahu kapan harus memulihkan posisi scroll.
 */
export function usePreservedScrollHeight(contentKey: unknown): PreservedScrollHeightResult {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const pendingScrollYRef = React.useRef<number | null>(null);
  const [minHeight, setMinHeight] = React.useState<number | null>(null);

  const preserveScrollPosition = React.useCallback((): void => {
    const currentScrollY = window.scrollY;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || currentScrollY <= 0) {
      pendingScrollYRef.current = null;
      return;
    }
    const contentTop = rect.top + currentScrollY;
    const viewportRequiredHeight = Math.max(0, currentScrollY + window.innerHeight - contentTop);
    setMinHeight(Math.max(rect.height, viewportRequiredHeight));
    pendingScrollYRef.current = currentScrollY;
  }, []);

  const jumpToOnNextContent = React.useCallback((targetY: number): void => {
    setMinHeight(null);
    pendingScrollYRef.current = Math.max(0, Math.round(targetY));
  }, []);

  React.useLayoutEffect(() => {
    const pendingScrollY = pendingScrollYRef.current;
    if (pendingScrollY === null) return;
    pendingScrollYRef.current = null;
    window.scrollTo({ top: pendingScrollY, behavior: "auto" });
  }, [contentKey]);

  React.useEffect(() => {
    if (minHeight === null) return;
    const release = (): void => setMinHeight(null);
    const timeoutId = window.setTimeout(release, RELEASE_GRACE_MS);
    window.addEventListener("scroll", release, { passive: true, once: true });
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", release);
    };
  }, [minHeight]);

  return {
    containerRef,
    containerStyle: minHeight === null ? undefined : { minHeight: `${minHeight}px` },
    preserveScrollPosition,
    jumpToOnNextContent,
  };
}
