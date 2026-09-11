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
    expect(html).not.toContain("Daftar proyek dibaca");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("aria-controls=");
    expect(html).toContain("after:-inset-y-2");
    expect(html.match(/pointer-events-none/g)).toHaveLength(3);
  });

  test("tetap compact dan dapat dibuka pengguna selama tool berjalan", () => {
    const html = renderToStaticMarkup(
      <ToolTraceList
        traces={[{ key: "a", label: "Membaca daftar proyek", state: "running", count: 1 }]}
      />,
    );

    expect(html).toContain("0 dari 1 sumber dibaca");
    expect(html).not.toContain("Membaca daftar proyek");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("disabled");
    expect(html).toContain("rotate-0");
  });

  test("tetap compact dan dapat dibuka pengguna ketika tool gagal", () => {
    const html = renderToStaticMarkup(
      <ToolTraceList
        traces={[
          done("Daftar proyek dibaca"),
          { key: "b", label: "Gagal membaca budget", state: "failed", count: 1 },
        ]}
      />,
    );

    expect(html).toContain("1 sumber data dibaca, 1 gagal");
    expect(html).not.toContain("Gagal membaca budget");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("disabled");
  });

  test("menyebut jejak yang terputus terpisah dari yang gagal", () => {
    const html = renderToStaticMarkup(
      <ToolTraceList
        traces={[
          done("Daftar proyek dibaca"),
          { key: "b", label: "Membaca budget", state: "interrupted", count: 1 },
        ]}
      />,
    );

    expect(html).toContain("1 sumber data dibaca, 1 dihentikan");
  });

  test("tidak merender apa-apa ketika tidak ada tool yang dipanggil", () => {
    expect(renderToStaticMarkup(<ToolTraceList traces={[]} />)).toBe("");
  });

  test("memisahkan key animasi running dan static sehingga icon selesai tidak terus berputar", () => {
    const runningHtml = renderToStaticMarkup(
      <ToolTraceList
        traces={[{ key: "tool-1", label: "Membaca kas", state: "running", count: 1 }]}
      />,
    );
    expect(runningHtml).toContain("0 dari 1 sumber dibaca");

    const doneHtml = renderToStaticMarkup(
      <ToolTraceList
        traces={[{ key: "tool-1", label: "Kas dibaca", state: "done", count: 1 }]}
      />,
    );
    expect(doneHtml).toContain("1 sumber data dibaca");
  });
});
