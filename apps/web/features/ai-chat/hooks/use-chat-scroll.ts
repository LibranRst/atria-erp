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
 * Ikuti jawaban sampai pertanyaan terbaru menyentuh inset baca paling atas.
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
  /** Lompat ke dasar percakapan dan aktifkan kembali pengikutan. */
  readonly jumpToBottom: () => void;
  /** Ikuti dasar jawaban jika pengguna belum berpindah membaca riwayat. */
  readonly followStream: (behavior?: ScrollBehavior) => void;
  /** Memasang kembali pengikutan, dipakai saat pengguna mengirim pertanyaan baru. */
  readonly resumeFollowing: () => void;
  readonly awayFromBottom: boolean;
};

/**
 * Pengaturan gulir percakapan AI.
 *
 * Pengikutan berjalan selama pengguna berada di dasar percakapan. Gerakan
 * membaca ke atas menghentikannya sampai pengguna kembali ke dasar atau
 * menekan tombol jawaban terbaru.
 */
export function useChatScroll(isStreaming: boolean): ChatScroll {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const followingRef = React.useRef(true);
  const followMode = React.useRef<"question" | "bottom">("bottom");
  const [awayFromBottom, setAway] = React.useState(false);
  const frame = React.useRef<number | null>(null);
  const settle = React.useRef<(() => void) | null>(null);
  const cancel = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    settle.current?.();
    settle.current = null;
  }, []);
  React.useEffect(() => () => cancel(), [cancel]);
  const bottom = React.useCallback(
    (node: HTMLDivElement) => Math.max(0, node.scrollHeight - node.clientHeight),
    [],
  );
  const target = React.useCallback((node: HTMLDivElement): number => {
    if (followMode.current === "bottom") return Math.max(0, node.scrollHeight - node.clientHeight);
    const anchors = node.querySelectorAll<HTMLElement>(`[${USER_MESSAGE_ATTRIBUTE}]`);
    const anchor = anchors.item(anchors.length - 1);
    return computeFollowTarget({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      anchorOffset: anchor
        ? anchor.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop
        : null,
      topInset: Number.parseFloat(getComputedStyle(node).paddingTop) || 0,
    });
  }, []);
  const resumeFollowing = React.useCallback(() => {
    followingRef.current = true;
    followMode.current = "question";
    setAway(false);
  }, []);
  const jumpToBottom = React.useCallback(() => {
    cancel();
    resumeFollowing();
    followMode.current = "bottom";
    const node = viewportRef.current,
      content = contentRef.current;
    if (!node) return;
    const snap = (): void => {
      if (followingRef.current) node.scrollTop = target(node);
    };
    snap();
    if (!content) return;
    const observer = new ResizeObserver(snap);
    observer.observe(content);
    const timer = setTimeout(() => {
      observer.disconnect();
      settle.current = null;
    }, SETTLE_WINDOW_MS);
    settle.current = () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [cancel, resumeFollowing, target]);
  const followStream = React.useCallback(
    (behavior: ScrollBehavior = "auto"): void => {
      if (!followingRef.current) return;
      cancel();
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const node = viewportRef.current;
        if (node) node.scrollTo({ top: Math.max(node.scrollTop, target(node)), behavior });
      });
    },
    [cancel, target],
  );
  React.useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    let touchY: number | null = null;
    const pause = (): void => {
      followingRef.current = false;
      cancel();
    };
    const wheel = (event: WheelEvent): void => {
      if (isUpwardGesture(event.deltaY)) pause();
    };
    const start = (event: TouchEvent): void => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const move = (event: TouchEvent): void => {
      const y = event.touches[0]?.clientY ?? null;
      if (y !== null && touchY !== null && isUpwardGesture(touchY - y)) pause();
      touchY = y;
    };
    const key = (event: KeyboardEvent): void => {
      const origin = event.target instanceof HTMLElement ? event.target : null;
      if (isUpwardScrollKey(event.key, origin)) pause();
    };
    const pointer = (): void => {
      if (isStreaming) pause();
    };
    const scroll = (): void => {
      const atBottom = bottom(node) - node.scrollTop <= FOLLOW_THRESHOLD_PX;
      setAway(!atBottom);
      if (atBottom) {
        if (node.scrollTop - target(node) > FOLLOW_THRESHOLD_PX) followMode.current = "bottom";
        followingRef.current = true;
      } else if (!isStreaming) followingRef.current = false;
    };
    node.addEventListener("wheel", wheel, { passive: true });
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: true });
    node.addEventListener("pointerdown", pointer);
    node.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("pointerdown", pointer);
      node.removeEventListener("scroll", scroll);
      document.removeEventListener("keydown", key);
    };
  }, [bottom, cancel, isStreaming, target]);
  React.useEffect(() => {
    const node = viewportRef.current,
      content = contentRef.current;
    if (!node || !content) return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) node.scrollTop = Math.max(node.scrollTop, target(node));
      setAway(bottom(node) - node.scrollTop > FOLLOW_THRESHOLD_PX);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [bottom, target]);
  return { viewportRef, contentRef, jumpToBottom, followStream, resumeFollowing, awayFromBottom };
}
