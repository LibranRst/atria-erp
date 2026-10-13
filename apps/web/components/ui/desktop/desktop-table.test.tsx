import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopTable, type DesktopTableColumn } from "./desktop-table";
import { DesktopButton, DesktopInput, DesktopSelect } from "./desktop-controls";

type Row = { readonly id: string; readonly name: string; readonly amount: number };
const columns: readonly DesktopTableColumn<Row>[] = [
  { key: "name", label: "Proyek", render: (row): string => row.name },
  { key: "amount", label: "Anggaran", align: "end", render: (row): string => `Rp ${row.amount}` },
];

describe("desktop HeroUI adapters", () => {
  test("renders real labelled table cells and current-row semantics", () => {
    const html = renderToStaticMarkup(
      <DesktopTable
        ariaLabel="Anggaran proyek"
        columns={columns}
        rows={[{ id: "one", name: "Bassura", amount: 5000 }]}
        rowKey={(row): string => row.id}
        selectedRowKey="one"
      />,
    );
    expect(html).toContain('aria-label="Anggaran proyek"');
    expect(html).toContain("Bassura");
    expect(html).toContain("Rp 5000");
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("tabular-nums");
  });

  test("gives pending actions a disabled state and a readable progress label", () => {
    const html = renderToStaticMarkup(
      <DesktopButton pending pendingLabel="Menyimpan">
        Simpan
      </DesktopButton>,
    );
    expect(html).toContain("Menyimpan");
    expect(html).toContain("disabled");
    expect(html).toContain('type="button"');
    expect(html).toContain('data-atria-variant="primary"');
  });

  test("keeps one keyboard focus stop and honors an explicit reference id", () => {
    const html = renderToStaticMarkup(
      <DesktopButton id="workspace-switch">Tampilan ringkas</DesktopButton>,
    );
    expect(html).toContain('id="workspace-switch"');
    expect(html).not.toMatch(/<span[^>]*tabindex="0"/);
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
  });

  test("generates a stable button id when rendered without a caller id", () => {
    const first = renderToStaticMarkup(<DesktopButton>Buka</DesktopButton>);
    const second = renderToStaticMarkup(<DesktopButton>Buka</DesktopButton>);
    expect(first.match(/<button[^>]*id="([^"]+)"/)?.[1]).toBe(
      second.match(/<button[^>]*id="([^"]+)"/)?.[1],
    );
    expect(first).toContain("desktop-button-");
  });

  test("associates label and error with the input through React Aria", () => {
    const html = renderToStaticMarkup(
      <DesktopInput
        label="Nama proyek"
        value=""
        onChange={(): void => undefined}
        error="Isi nama proyek"
      />,
    );
    expect(html).toContain("Nama proyek");
    expect(html).toContain("Isi nama proyek");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("aria-describedby=");
    expect(html).toContain("for=");
  });

  test("uses stable option values and an associated label for selection", () => {
    const html = renderToStaticMarkup(
      <DesktopSelect
        label="Kategori"
        value="material"
        onChange={(): void => undefined}
        options={[
          { value: "material", label: "Material" },
          { value: "tukang", label: "Tukang" },
        ]}
      />,
    );
    expect(html).toContain("Kategori");
    expect(html).toContain("Material");
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain('aria-haspopup="listbox"');
  });

  test("selected grouped option retains its label and distinct metadata before the popover opens", () => {
    const html = renderToStaticMarkup(
      <DesktopSelect
        label="Proyek"
        value="active"
        placeholder="Pilih proyek"
        onChange={(): void => undefined}
        options={[
          { value: "active", label: "Aktif", meta: "12 proyek", group: "Berjalan" },
          {
            value: "locked",
            label: "Ditutup",
            disabledReason: "Proyek sudah ditutup",
            group: "Arsip",
          },
        ]}
      />,
    );
    const value = html.slice(
      html.indexOf('data-slot="select-value"'),
      html.indexOf('data-slot="select-indicator"'),
    );
    expect(value).toContain("Aktif");
    expect(value).toContain("12 proyek");
    expect(value).not.toContain("Pilih proyek");
    expect(html).toContain('value="active" selected=""');
  });

  test("searchable selects retain committed value and label/error association before opening", () => {
    const html = renderToStaticMarkup(
      <DesktopSelect
        id="material-choice"
        label="Material"
        searchable
        value="wood"
        onChange={(): void => undefined}
        error="Pilih material aktif"
        options={[{ value: "wood", label: "Kayu solid" }]}
      />,
    );
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain("Kayu solid");
    expect(html).toContain('id="material-choice"');
    expect(html).toContain('data-invalid="true"');
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("aria-describedby=");
  });
});
