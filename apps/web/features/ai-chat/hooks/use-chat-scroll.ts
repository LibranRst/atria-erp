"use client";

import { TOP_BAR_INSET_PX } from "@/components/layout/app-top-bar";
import * as React from "react";

/**
 * Penanda gelembung pertanyaan pengguna. Dipakai untuk menemukan pertanyaan
 * terakhir tanpa mengalirkan ref melewati beberapa lapis komponen pesan.
 */
export const USER_MESSAGE_ATTRIBUTE = "data-chat-user-message";

/**
 * Jarak dari tepi atas viewport tempat gelembung pertanyaan terakhir berhenti.
 *
 * Diambil dari geometri bilah, bukan dinyatakan ulang. Sebelumnya ini angka
 * lepas bernilai 72 yang kebetulan sama dengan `TOP_INSET_PX` di bilah AI —
 * dua konstanta terpisah untuk satu maksud, dan komentarnya sudah menyebut
 * geometri yang tidak berlaku lagi ("top-3 + h-11", padahal bilahnya 40px).
 */
export const STREAM_TOP_INSET_PX = TOP_BAR_INSET_PX;

/** Toleransi untuk menganggap viewport sudah sampai di posisi yang dituju. */
export const FOLLOW_THRESHOLD_PX = 48;

/** Gerakan di bawah nilai ini dianggap getaran jari, bukan niat menggulir. */
const GESTURE_DEADZONE_PX = 2;

/**
 * Kartu usulan dan markdown selesai dilayout beberapa frame setelah commit,
 * jadi dasar percakapan dijaga sebentar setelah lompatan awal — tanpa itu
 * halaman terbuka pada posisi yang meleset seukuran kartu terakhir.
 */
const SETTLE_WINDOW_MS = 400;

export type FollowGeometry = {
  readonly scrollHeight: number;
  readonly clientHeight: number;
  /** Posisi gelembung pertanyaan terakhir dari awal isi, atau null jika belum ada. */
  readonly anchorOffset: number | null;
  readonly topInset: number;
};

/**
 * Batas gulir selama jawaban mengalir.
 *
 * Tampilan mengikuti teks yang bertambah, tetapi berhenti begitu gelembung
 * pertanyaan terakhir menyentuh bilah atas: pertanyaan yang memicu jawaban
 * harus tetap terbaca. Menggulungnya keluar layar membuat pengguna kehilangan
 * konteks jawaban yang sedang dibacanya. Jika isi belum cukup panjang untuk
 * mencapai batas itu, dasar percakapan yang menjadi batasnya.
 */
export function computeFollowTarget(geometry: FollowGeometry): number {
  const bottom = Math.max(0, geometry.scrollHeight - geometry.clientHeight);
  if (geometry.anchorOffset === null) return bottom;
  return Math.min(bottom, Math.max(0, geometry.anchorOffset - geometry.topInset));
}

/**
 * `delta` dinyatakan dalam satuan posisi gulir: negatif berarti tampilan
 * bergerak ke arah awal percakapan. Hanya gerakan itu — pengguna membaca ke
 * atas — yang menghentikan pengikutan aliran.
 */
export function isUpwardGesture(delta: number, deadzone: number = GESTURE_DEADZONE_PX): boolean {
  return delta < -deadzone;
}

/** Tombol yang menggulir percakapan ke arah awal. */
const UPWARD_KEYS: ReadonlySet<string> = new Set(["ArrowUp", "PageUp", "Home"]);

/** Bentuk minimal elemen yang dibutuhkan untuk menilai asal penekanan tombol. */
export type KeyEventOrigin = {
  readonly tagName: string;
  readonly isContentEditable: boolean;
};

/**
 * Panah atas di dalam composer memindahkan kursor teks, bukan menggulir isi
 * percakapan — jadi tombol itu tidak boleh menghentikan pengikutan.
 */
export function isUpwardScrollKey(key: string, origin: KeyEventOrigin | null): boolean {
  if (!UPWARD_KEYS.has(key)) return false;
  if (origin === null) return true;
  if (origin.isContentEditable) return false;
  return origin.tagName !== "INPUT" && origin.tagName !== "TEXTAREA" && origin.tagName !== "SELECT";
}

export type ChatScroll = {
  /** Elemen yang menggulir. */
  readonly viewportRef: React.RefObject<HTMLDivElement | null>;
  /** Pembungkus seluruh isi; tinggi dinamisnya dipantau selama jawaban mengalir. */
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
  /** Lompat ke dasar percakapan — hanya untuk saat halaman baru dibuka. */
  readonly jumpToBottom: () => void;
  /** Satu dorongan mengikuti aliran jawaban, terhenti pada batas gelembung pertanyaan. */
  readonly followStream: (behavior?: ScrollBehavior) => void;
  /** Memasang kembali pengikutan, dipakai saat pengguna mengirim pertanyaan baru. */
  readonly resumeFollowing: () => void;
};

/**
 * Pengaturan gulir percakapan AI.
 *
 * Percakapan sengaja **tidak** ditambatkan ke dasar sepanjang waktu. Tampilan
 * hanya bergerak sendiri pada dua kesempatan: saat halaman dibuka, dan selama
 * jawaban mengalir. Di luar itu posisi baca sepenuhnya milik pengguna.
 */
export function useChatScroll(isStreaming: boolean): ChatScroll {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const followingRef = React.useRef(true);
  const frameRef = React.useRef<number | null>(null);
  const stopSettlingRef = React.useRef<(() => void) | null>(null);

  const cancelPendingFrame = React.useCallback((): void => {
    if (frameRef.current === null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const stopSettling = React.useCallback((): void => {
    stopSettlingRef.current?.();
    stopSettlingRef.current = null;
  }, []);

  React.useEffect(
    () => () => {
      cancelPendingFrame();
      stopSettling();
    },
    [cancelPendingFrame, stopSettling],
  );

  const readFollowTarget = React.useCallback((viewport: HTMLDivElement): number => {
    const anchors = viewport.querySelectorAll<HTMLElement>(`[${USER_MESSAGE_ATTRIBUTE}]`);
    const last = anchors[anchors.length - 1];
    const anchorOffset =
      last === undefined
        ? null
        : last.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top +
          viewport.scrollTop;

    return computeFollowTarget({
      scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight,
      anchorOffset,
      topInset: STREAM_TOP_INSET_PX,
    });
  }, []);

  const resumeFollowing = React.useCallback((): void => {
    followingRef.current = true;
  }, []);

  const jumpToBottom = React.useCallback((): void => {
    followingRef.current = true;
    cancelPendingFrame();
    stopSettling();

    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport) return;

    function snapToBottom(): void {
      if (!viewport) return;
      viewport.scrollTop = viewport.scrollHeight;
    }

    snapToBottom();
    if (!content) return;

    const observer = new ResizeObserver(snapToBottom);
    observer.observe(content);
    const timer = setTimeout(() => {
      observer.disconnect();
      stopSettlingRef.current = null;
    }, SETTLE_WINDOW_MS);

    stopSettlingRef.current = () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [cancelPendingFrame, stopSettling]);

  const followStream = React.useCallback(
    (behavior: ScrollBehavior = "auto"): void => {
      if (!followingRef.current) return;
      cancelPendingFrame();
      stopSettling();
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const viewport = viewportRef.current;
        if (!viewport) return;
        viewport.scrollTo({ top: readFollowTarget(viewport), behavior });
      });
    },
    [cancelPendingFrame, readFollowTarget, stopSettling],
  );

  /**
   * Gerakan pengguna hanya diamati selama jawaban mengalir — di luar itu tidak
   * ada yang perlu dihentikan, karena tampilan memang tidak bergerak sendiri.
   */
  React.useEffect(() => {
    if (!isStreaming || !viewportRef.current) return undefined;
    const viewport: HTMLDivElement = viewportRef.current;

    let lastTouchY: number | null = null;

    function handleWheel(event: WheelEvent): void {
      if (isUpwardGesture(event.deltaY)) followingRef.current = false;
    }

    function handleTouchStart(event: TouchEvent): void {
      lastTouchY = event.touches[0]?.clientY ?? null;
    }

    function handleTouchMove(event: TouchEvent): void {
      const currentY = event.touches[0]?.clientY ?? null;
      if (currentY === null) return;
      if (lastTouchY !== null && isUpwardGesture(lastTouchY - currentY)) {
        followingRef.current = false;
      }
      lastTouchY = currentY;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const origin = event.target instanceof HTMLElement ? event.target : null;
      if (isUpwardScrollKey(event.key, origin)) followingRef.current = false;
    }

    // Menyusul kembali ke posisi yang dituju berarti pengguna ingin ikut mengalir lagi.
    function handleScroll(): void {
      if (viewport.scrollTop >= readFollowTarget(viewport) - FOLLOW_THRESHOLD_PX) {
        followingRef.current = true;
      }
    }

    viewport.addEventListener("wheel", handleWheel, { passive: true });
    viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: true });
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("scroll", handleScroll);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStreaming, readFollowTarget]);

  /**
   * Teks yang mengalir menambah tinggi isi tanpa mengubah daftar pesan, jadi
   * perubahannya diikuti langsung dari dalam callback `ResizeObserver` — yakni
   * sebelum browser melukis, sehingga tidak ada loncatan satu frame.
   */
  React.useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!isStreaming || !viewport || !content) return undefined;

    const observer = new ResizeObserver(() => {
      if (!followingRef.current) return;
      cancelPendingFrame();
      viewport.scrollTop = readFollowTarget(viewport);
    });

    observer.observe(content);

    return () => observer.disconnect();
  }, [cancelPendingFrame, isStreaming, readFollowTarget]);

  return { viewportRef, contentRef, jumpToBottom, followStream, resumeFollowing };
}
