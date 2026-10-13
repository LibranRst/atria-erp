import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { UserAvatar } from "../identity/user-avatar";
import { SegmentedTabs } from "../navigation/segmented-tabs";
import { FormField, TextInput, Textarea, SwitchRow } from "../form/basic-form-controls";
import { ActionMenu } from "../overlay/anchored-surfaces";
import { AppIcon } from "../icon/app-icon";
import { DesktopButton } from "./desktop-controls";
import { Button, IconButton } from "../button/button";
import { DesktopTable } from "./desktop-table";
import { FilterSelect, SearchInput } from "../form/select-form-controls";

function desktop(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      {children}
    </WorkspacePresentationProvider>,
  );
}

test("desktop avatar has a fixed square box even without caller geometry or a loaded image", () => {
  const html = desktop(<UserAvatar initials="RW" renderPx={40} />);
  expect(html).toContain("width:40px;height:40px");
  expect(html).toContain("avatar__fallback");
  expect(html).toContain("RW");
});

test("desktop status filters have an inline trigger, separate count and an accessible hidden label", () => {
  const html = desktop(
    <FilterSelect
      label="Tampilkan"
      value="all"
      searchable={false}
      options={[
        { value: "all", label: "Semua", meta: "12 proyek" },
        { value: "closed", label: "Ditutup", disabledReason: "Tidak tersedia" },
      ]}
      onChange={(): void => undefined}
    />,
  );
  expect(html).toContain("atria-desktop-filter-trigger");
  expect(html).toContain("sr-only");
  expect(html).toContain("12 proyek");
  expect(html).toContain("aria-labelledby=");
  expect(html).not.toContain("select--full-width");
  expect(html).not.toContain("atria-desktop-select-trigger");
  expect(html).not.toContain("data-atria-popover-content");
});

test("desktop peer tabs are intrinsic-width HeroUI tabs with a controlled selected value", () => {
  const html = desktop(
    <SegmentedTabs
      value="budget"
      fillAvailableSpace
      ariaLabel="Dashboard"
      options={[
        { value: "overview", label: "Ringkasan" },
        { value: "budget", label: "Budget" },
      ]}
      onChange={(): void => undefined}
    />,
  );
  expect(html).toContain('data-slot="tabs"');
  expect(html).toContain('role="tablist"');
  expect(html).toContain('aria-selected="true"');
  expect(html).toContain("w-fit max-w-full");
  expect(html).not.toContain("min-w-max flex-1");
});

test("desktop native text controls retain shared field association and validation", () => {
  const html = desktop(
    <>
      <FormField label="Nama proyek" error="Nama wajib diisi" required>
        <TextInput value="" onChange={(): void => undefined} />
      </FormField>
      <FormField label="Catatan">
        <Textarea value="" />
      </FormField>
    </>,
  );
  expect(html).toContain('data-slot="input"');
  expect(html).toContain('data-slot="textarea"');
  expect(html).toContain('aria-invalid="true"');
  const controlId = /<input[^>]*\sid="([^"]+)"/.exec(html)?.[1];
  expect(html).toContain(`for="${controlId}"`);
});

test("desktop action and switch use the HeroUI interaction contract without losing semantics", () => {
  const html = desktop(
    <>
      <Button type="submit" name="intent" value="save">
        Simpan
      </Button>
      <SwitchRow checked onChange={(): void => undefined} title="Akses desktop" />
    </>,
  );
  expect(html).toContain('data-slot="button"');
  expect(html).toContain('type="submit"');
  expect(html).toContain('value="save"');
  expect(html).toContain('role="switch"');
  expect(html).toContain('checked=""');
});

test("shared desktop controls use native compact size variants without inheriting mobile geometry", () => {
  const html = desktop(
    <>
      <Button className="min-h-12 px-5">Simpan perubahan</Button>
      <Button size="compact">Ubah</Button>
      <IconButton label="Aksi" icon={<AppIcon name="add" />} size="mini" />
      <SearchInput value="proyek" onChange={(): void => undefined} ariaLabel="Cari proyek" />
    </>,
  );
  expect(html).toContain("button--md");
  expect(html).toContain("button--sm");
  expect(html).toContain("button--icon-only");
  expect(html).toContain('data-atria-size="compact"');
  expect(html).toContain("atria-desktop-field");
  expect(html).toContain('type="search"');
  expect(html).toContain('aria-label="Cari proyek"');
  expect(html).not.toContain('aria-label="Bersihkan pencarian"');
});

test("native HeroUI table accepts controlled selection with no selected row", () => {
  const html = desktop(
    <DesktopTable
      ariaLabel="Proyek"
      rows={[{ id: "one", name: "Bassura" }]}
      rowKey={(row): string => row.id}
      selectedRowKey={null}
      onRowAction={(): void => undefined}
      columns={[{ key: "name", label: "Proyek", render: (row): string => row.name }]}
    />,
  );
  expect(html).toContain('data-selection-mode="single"');
  expect(html).not.toContain('aria-selected="true"');
});

test("HeroUI table exposes real single selection and sortable columns", () => {
  const html = desktop(
    <DesktopTable
      ariaLabel="Proyek"
      rows={[{ id: "one", name: "Bassura" }]}
      rowKey={(row): string => row.id}
      selectedRowKey="one"
      onRowAction={(): void => undefined}
      columns={[
        {
          key: "name",
          label: "Proyek",
          render: (row): string => row.name,
          sortValue: (row): string => row.name,
        },
      ]}
    />,
  );
  expect(html).toContain('aria-selected="true"');
  expect(html).toContain('data-allows-sorting="true"');
  expect(html).toContain("table-root--primary");
});

test("desktop action menus compose one button instead of nesting interactive triggers", () => {
  for (const trigger of [
    <DesktopButton key="button">Tambah</DesktopButton>,
    <IconButton key="icon" label="Aksi" icon={<AppIcon name="add" />} />,
  ]) {
    const html = desktop(
      <ActionMenu
        label="Aksi"
        trigger={trigger}
        items={[{ id: "create", label: "Proyek baru", onSelect: (): void => undefined }]}
      />,
    );
    expect(html.match(/<button\b/g)?.length).toBe(1);
    expect(html).toMatch(/aria-haspopup="(?:menu|true)"/);
  }
});
