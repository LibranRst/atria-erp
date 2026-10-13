import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatementDraftSummary, StatementImportSummary } from "./reconciliation-form-summary";

describe("bank evidence form summaries", () => {
  test("an unread file is not presented as zero bank movement", () => {
    const html = renderToStaticMarkup(
      <StatementImportSummary
        accountName={undefined}
        fileName=""
        rowCount={0}
        inflow={0}
        outflow={0}
        state="unread"
      />,
    );
    expect(html).toContain("Belum dipilih");
    expect(html).not.toContain("Dana masuk");
    expect(html).not.toContain("Dana keluar");
    expect(html).toContain("Belum dibaca");
    expect(html).not.toContain("0 mutasi");
    expect(html).toContain("Impor tidak mengubah saldo rekening Atria");
  });

  test("a parsed zero inflow is visible while parsing and errors stay distinct", () => {
    const render = (state: "ready" | "reading" | "failed"): string =>
      renderToStaticMarkup(
        <StatementImportSummary
          accountName="Rekening operasional"
          fileName="Oktober.csv"
          rowCount={2}
          inflow={0}
          outflow={123456.78}
          state={state}
        />,
      );
    const ready = render("ready");
    expect(ready).toContain("2 mutasi");
    expect(ready).toContain("Dana masuk");
    expect(ready).toContain("Rp 0");
    expect(render("reading")).toContain("Sedang dibaca");
    const failed = render("failed");
    expect(failed).toContain("Perlu diperiksa");
    expect(failed).not.toContain("Siap");
    expect(failed).not.toContain("2 mutasi");
    expect(failed).not.toContain("Dana masuk");
    expect(failed).not.toContain("Dana keluar");
  });

  test("zero remaining preview rows is known only after successful file reading", () => {
    const render = (state: "unread" | "ready"): string =>
      renderToStaticMarkup(
        <StatementImportSummary
          accountName="Rekening operasional"
          fileName="Oktober.csv"
          rowCount={0}
          inflow={0}
          outflow={0}
          state={state}
        />,
      );
    expect(render("unread")).not.toContain("0 mutasi");
    expect(render("unread")).toContain("Belum dibaca");
    expect(render("ready")).toContain("0 mutasi");
  });

  test("an invalid manual amount stays incomplete instead of rendering NaN", () => {
    const html = renderToStaticMarkup(
      <StatementDraftSummary
        accountName="Bank perusahaan"
        date="2026-10-13"
        type="OUTFLOW"
        amount="invalid"
      />,
    );
    expect(html).toContain("Dana keluar");
    expect(html).toContain("Belum diisi");
    expect(html).not.toContain("NaN");
    expect(html).toContain("tidak mencatat kas masuk atau keluar baru");
  });
});
