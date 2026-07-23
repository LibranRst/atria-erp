import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PageState } from "./page-state";

describe("shared page states", () => {
  test("renders filtered empty with a reset action", () => {
    const html = renderToStaticMarkup(
      <PageState
        kind="filtered-empty"
        title="Tidak ditemukan"
        description="Ubah filter."
        actionLabel="Reset"
        onAction={() => undefined}
      />,
    );
    expect(html).toContain("Tidak ditemukan");
    expect(html).toContain("Reset");
  });

  test("renders restricted access as an alert", () => {
    const html = renderToStaticMarkup(
      <PageState kind="restricted" title="Akses terbatas" description="Owner only." />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Akses terbatas");
  });

  test("renders offline state without inventing operational data", () => {
    const html = renderToStaticMarkup(
      <PageState kind="offline" title="Offline" description="Mode baca saja." />,
    );
    expect(html).toContain("cloud_off");
    expect(html).toContain("Mode baca saja");
  });
});
