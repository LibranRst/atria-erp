import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { DesktopUIProvider } from "./desktop-ui-provider";
import { DesktopButton, DesktopInput, DesktopSelect } from "./desktop-controls";
import { DesktopTable, type DesktopTableColumn } from "./desktop-table";
import { FormSheet } from "../overlay/semantic-sheets";
import { MoneyValue } from "../feedback/page-primitives";

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
  return (
    <DesktopUIProvider className="space-y-5 bg-background p-6">
      <div className="flex flex-wrap gap-3">
        <DesktopButton onPress={(): void => setOpen(true)}>Buka form</DesktopButton>
        <DesktopButton variant="secondary">Lihat rincian</DesktopButton>
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
        title="Contoh form admin"
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
        </div>
      </FormSheet>
    </DesktopUIProvider>
  );
}

const meta = { title: "ui/desktop/HeroUI Toolkit", component: ToolkitFixture } satisfies Meta<
  typeof ToolkitFixture
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TableControlsAndSharedSheet: Story = {};
