import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { DesktopUIProvider } from "./desktop-ui-provider";
import { DesktopButton, DesktopInput, DesktopSelect } from "./desktop-controls";
import {
  Button,
  DesktopTable,
  FactRow,
  GroupedSurface,
  type DesktopTableColumn,
} from "@/components/ui";
import { FormSheet } from "../overlay/semantic-sheets";
import { MoneyValue } from "../feedback/page-primitives";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

type FixtureRow = { readonly id: string; readonly name: string; readonly budget: number };
const columns: readonly DesktopTableColumn<FixtureRow>[] = [
  { key: "name", label: "Proyek", render: (row): string => row.name },
  {
    key: "budget",
    label: "Anggaran",
    align: "end",
    render: (row): React.JSX.Element => (
      <MoneyValue amount={row.budget} variant="compactWithFull" />
    ),
  },
];
const rows: readonly FixtureRow[] = [{ id: "example", name: "Contoh proyek", budget: 125000000 }];

function ToolkitFixture(): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<string | null>("material");
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider className="space-y-5 bg-background p-6">
        <div className="flex flex-wrap gap-3">
          <DesktopButton onPress={(): void => setOpen(true)}>Buka form</DesktopButton>
          <DesktopButton variant="secondary" size="compact">
            Lihat rincian
          </DesktopButton>
          <DesktopButton variant="tertiary" size="mini">
            Ubah
          </DesktopButton>
          <DesktopButton pending>Proses</DesktopButton>
          <DesktopButton variant="critical" disabled>
            Hapus
          </DesktopButton>
        </div>
        <DesktopTable
          ariaLabel="Contoh anggaran proyek"
          columns={columns}
          rows={rows}
          rowKey={(row): string => row.id}
        />
        <DesktopTable
          ariaLabel="Contoh daftar kosong"
          columns={columns}
          rows={[]}
          rowKey={(row): string => row.id}
          emptyDescription="Data baru akan tampil di sini."
        />
        <FormSheet
          open={open}
          title="Contoh form desktop"
          dismissal={{ mode: "discard" }}
          onClose={(): void => setOpen(false)}
        >
          <div className="space-y-4 px-5 py-4">
            <DesktopInput
              label="Nama proyek"
              value={name}
              onChange={setName}
              error={name.length === 1 ? "Nama masih terlalu singkat" : undefined}
            />
            <DesktopSelect
              label="Kategori"
              value={category}
              onChange={setCategory}
              options={[
                { value: "material", label: "Material" },
                { value: "tukang", label: "Tukang" },
              ]}
            />
            <DesktopSelect
              label="Material dengan pencarian"
              searchable
              value={category}
              onChange={setCategory}
              options={[
                { value: "material", label: "Material", meta: "12 pilihan", group: "Aktif" },
                {
                  value: "tukang",
                  label: "Tukang",
                  description: "Tenaga kerja internal",
                  group: "Aktif",
                },
                {
                  value: "locked",
                  label: "Material arsip",
                  disabledReason: "Material sudah dinonaktifkan",
                  group: "Arsip",
                },
              ]}
              createActionLabel="Tambah pilihan"
              onCreateAction={(): void => setNotice("Form pilihan baru dapat dibuka di sini.")}
            />
            {notice ? (
              <p role="status" className="text-support text-muted">
                {notice}
              </p>
            ) : null}
          </div>
        </FormSheet>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const selectionRows: readonly FixtureRow[] = [
  { id: "cipete", name: "Contoh proyek Cipete", budget: 125000000 },
  { id: "menteng", name: "Contoh proyek Menteng", budget: 175000000 },
];

function ToggleableSelectionFixture(): React.JSX.Element {
  const [selected, setSelected] = React.useState<FixtureRow | null>(null);
  return (
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider className="space-y-4 bg-background p-6">
        <div className="space-y-1">
          <h1 className="text-section font-semibold">Pilih proyek untuk melihat rincian</h1>
          <p className="text-support text-on-surface-variant">
            Pilih baris yang sama lagi untuk menutup rincian. Gunakan Spasi saat baris terfokus
            untuk memilih atau membatalkan pilihan.
          </p>
          <p role="status" className="text-support">
            {selected ? `${selected.name} dipilih.` : "Belum ada proyek dipilih."}
          </p>
        </div>
        <div
          className={`grid min-w-0 items-start gap-4 ${selected ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
        >
          <DesktopTable
            ariaLabel="Contoh pemilihan rincian proyek"
            columns={columns}
            rows={selectionRows}
            rowKey={(row): string => row.id}
            selectedRowKey={selected?.id ?? null}
            onRowSelectionChange={setSelected}
          />
          {selected ? (
            <GroupedSurface variant="desktopPanel" className="min-w-0 overflow-hidden">
              <h2 className="p-4 text-row font-semibold">{selected.name}</h2>
              <FactRow
                label="Anggaran"
                value={<MoneyValue amount={selected.budget} variant="fullDynamic" />}
              />
              <div className="p-4">
                <Button
                  variant="secondary"
                  size="compact"
                  fullWidth
                  onClick={(): void => setSelected(null)}
                >
                  Tutup rincian
                </Button>
              </div>
            </GroupedSurface>
          ) : null}
        </div>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = { title: "ui/desktop/HeroUI Toolkit", component: ToolkitFixture } satisfies Meta<
  typeof ToolkitFixture
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TableControlsAndSharedSheet: Story = {};
export const ToggleableRowSelection: Story = {
  render: (): React.JSX.Element => <ToggleableSelectionFixture />,
};
