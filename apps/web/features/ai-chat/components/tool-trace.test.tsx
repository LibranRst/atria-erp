import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolTraceList } from "./tool-trace";

const done = (label: string, count = 1) =>
  ({ key: label, label, state: "done" as const, count }) as const;

describe("jejak tool yang diringkas", () => {
  test("meringkas jejak selesai menjadi satu baris bercacah", () => {
    const html = renderToStaticMarkup(
      <ToolTraceList traces={[done("Daftar proyek dibaca"), done("Budget dibaca", 3)]} />,
    );

    expect(html).toContain("4 sumber data dibaca");
    // Rincian disembunyikan sampai dibuka, supaya jawaban tidak terdorong ke bawah.
    expect(html).not.toContain("Daftar proyek dibaca");
    expect(html).toContain('aria-expanded="false"');
  });

  test("membuka rincian dengan sendirinya selama masih berjalan", () => {
    // Saat berjalan justru itu isinya yang berguna: pengguna melihat apa yang
    // sedang diambil, bukan sekadar bahwa ada sesuatu yang berjalan.
    const html = renderToStaticMarkup(
      <ToolTraceList
        traces={[{ key: "a", label: "Membaca daftar proyek", state: "running", count: 1 }]}
      />,
    );

    expect(html).toContain("Mengambil data…");
    expect(html).toContain("Membaca daftar proyek");
    expect(html).toContain('aria-expanded="true"');
  });

  test("membuka rincian dan menyebut jumlah kegagalan ketika ada tool yang gagal", () => {
    const html = renderToStaticMarkup(
      <ToolTraceList
        traces={[
          done("Daftar proyek dibaca"),
          { key: "b", label: "Gagal membaca budget", state: "failed", count: 1 },
        ]}
      />,
    );

    expect(html).toContain("2 sumber data dibaca, 1 gagal");
    expect(html).toContain("Gagal membaca budget");
  });

  test("tidak merender apa-apa ketika tidak ada tool yang dipanggil", () => {
    expect(renderToStaticMarkup(<ToolTraceList traces={[]} />)).toBe("");
  });
});
