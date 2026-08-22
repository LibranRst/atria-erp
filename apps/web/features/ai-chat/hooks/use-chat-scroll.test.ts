import { describe, expect, test } from "bun:test";

import {
  computeFollowTarget,
  isUpwardGesture,
  isUpwardScrollKey,
  STREAM_TOP_INSET_PX,
} from "./use-chat-scroll";

const VIEWPORT = { scrollHeight: 2400, clientHeight: 800, topInset: STREAM_TOP_INSET_PX };

describe("batas gulir selama jawaban mengalir", () => {
  test("berhenti tepat saat gelembung pertanyaan menyentuh bilah atas", () => {
    // Diturunkan dari konstantanya, bukan ditulis ulang sebagai 72. Angka itu
    // dulu benar hanya karena kebetulan cocok dengan geometri bilah yang lama.
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 1000 })).toBe(
      1000 - STREAM_TOP_INSET_PX,
    );
  });

  /**
   * Tanpa batas ini, jawaban panjang akan menggulung pertanyaan yang memicunya
   * keluar layar dan pengguna kehilangan konteks bacaannya.
   */
  test("tidak pernah melewati gelembung pertanyaan meski dasar masih jauh", () => {
    const target = computeFollowTarget({ ...VIEWPORT, anchorOffset: 1000 });
    expect(target).toBeLessThan(VIEWPORT.scrollHeight - VIEWPORT.clientHeight);
  });

  test("dasar percakapan menjadi batas ketika isi belum cukup panjang", () => {
    // Gelembung pertanyaan baru saja terkirim dan berada dekat dasar.
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 2300 })).toBe(1600);
  });

  test("pesan pertama tidak menarik tampilan ke posisi negatif", () => {
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: 40 })).toBe(0);
  });

  test("tanpa gelembung pertanyaan, dasar percakapan yang dituju", () => {
    expect(computeFollowTarget({ ...VIEWPORT, anchorOffset: null })).toBe(1600);
  });

  test("isi yang lebih pendek dari viewport tidak menghasilkan gulir", () => {
    expect(
      computeFollowTarget({
        scrollHeight: 500,
        clientHeight: 800,
        anchorOffset: null,
        topInset: 72,
      }),
    ).toBe(0);
  });
});

describe("arah gerakan pengguna", () => {
  test("gerakan ke atas menghentikan pengikutan", () => {
    expect(isUpwardGesture(-40)).toBe(true);
  });

  test("gerakan ke bawah tidak menghentikan pengikutan", () => {
    expect(isUpwardGesture(40)).toBe(false);
  });

  test("getaran jari di bawah deadzone diabaikan", () => {
    expect(isUpwardGesture(-1)).toBe(false);
    expect(isUpwardGesture(0)).toBe(false);
  });
});

describe("tombol papan ketik yang menghentikan pengikutan", () => {
  test("panah atas di area percakapan menghentikan pengikutan", () => {
    expect(isUpwardScrollKey("ArrowUp", null)).toBe(true);
    expect(isUpwardScrollKey("PageUp", null)).toBe(true);
    expect(isUpwardScrollKey("Home", null)).toBe(true);
  });

  test("tombol lain tidak berpengaruh", () => {
    expect(isUpwardScrollKey("ArrowDown", null)).toBe(false);
    expect(isUpwardScrollKey("Enter", null)).toBe(false);
  });

  test("panah atas di dalam composer hanya memindahkan kursor teks", () => {
    expect(isUpwardScrollKey("ArrowUp", { tagName: "TEXTAREA", isContentEditable: false })).toBe(
      false,
    );
    expect(isUpwardScrollKey("ArrowUp", { tagName: "INPUT", isContentEditable: false })).toBe(
      false,
    );
    expect(isUpwardScrollKey("ArrowUp", { tagName: "DIV", isContentEditable: true })).toBe(false);
  });

  test("panah atas di gelembung percakapan tetap menghentikan pengikutan", () => {
    expect(isUpwardScrollKey("ArrowUp", { tagName: "DIV", isContentEditable: false })).toBe(true);
  });
});
