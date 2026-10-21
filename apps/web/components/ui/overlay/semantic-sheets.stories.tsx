import type { Meta, StoryObj } from "@storybook/nextjs";
import { useLayoutEffect, useState } from "react";
import { FactRow, FormField, FormSection, SheetSection, TextInput } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

import { Button } from "../button/button";
import { ConfirmationDialog } from "./dialogs";
import { FormSheet } from "./semantic-sheets";
import { SheetFooterActions } from "./sheet-footer-actions";

function FormSheetDemo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-130 w-full">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka drawer
      </Button>
      <FormSheet
        dismissal={{ mode: "discard" }}
        open={open}
        title="Detail Pengeluaran"
        onClose={() => setOpen(false)}
        footer={
          <SheetFooterActions
            secondary={{ label: "Batal", onClick: () => setOpen(false) }}
            primary={{ label: "Simpan", onClick: () => setOpen(false) }}
          />
        }
      >
        <p className="text-sm text-on-surface-variant">
          Pembelian semen 40 sak untuk proyek Renovasi Rumah Jl. Kenanga No. 12. Total Rp 6.400.000,
          dibayar tunai oleh Budi Santoso.
        </p>
      </FormSheet>
    </div>
  );
}

function ConfirmationModalDemo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-105 w-full">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka konfirmasi
      </Button>
      <ConfirmationDialog
        open={open}
        title="Setujui Pengeluaran?"
        description="Rp 6.400.000 akan dipotong dari anggaran Material proyek ini."
        onClose={() => setOpen(false)}
        actions={
          <SheetFooterActions
            secondary={{ label: "Batal", onClick: () => setOpen(false) }}
            primary={{ label: "Setujui", onClick: () => setOpen(false) }}
          />
        }
      />
    </div>
  );
}

function ConfirmationSheetDemo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-105 w-full">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka konfirmasi hapus
      </Button>
      <ConfirmationDialog
        open={open}
        title="Hapus Draf Ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        danger
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

const meta = {
  title: "ui/overlay/SemanticSheets",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ScrollEdgesDemo({ desktop = false }: { readonly desktop?: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("Panel kayu finishing");
  useLayoutEffect((): (() => void) | undefined => {
    if (!desktop) return;
    const previous = document.body.getAttribute("data-atria-admin");
    document.body.setAttribute("data-atria-admin", "");
    return (): void => {
      if (previous === null) document.body.removeAttribute("data-atria-admin");
      else document.body.setAttribute("data-atria-admin", previous);
    };
  }, [desktop]);
  return (
    <WorkspacePresentationProvider presentation={desktop ? "desktop" : "mobile"}>
      <Button onClick={() => setOpen(true)}>Buka sheet panjang</Button>
      <FormSheet
        open={open}
        title="Rincian material"
        dismissal={{ mode: "discard" }}
        onClose={() => setOpen(false)}
        footer={
          <SheetFooterActions
            status={
              <p className="text-support text-on-surface-variant">Data fixture · belum disimpan</p>
            }
            primary={{ label: "Selesai", onClick: () => setOpen(false) }}
          />
        }
      >
        <div className="space-y-4">
          <FormSection title="Identitas">
            <FormField label="Nama material">
              <TextInput value={name} onChange={setName} />
            </FormField>
          </FormSection>
          <SheetSection title="Spesifikasi">
            <div className="divide-y divide-outline-variant/15">
              {Array.from({ length: 16 }, (_, index) => (
                <FactRow
                  key={index}
                  label={`Material ${index + 1}`}
                  value="Finishing kayu · unit lembar"
                />
              ))}
            </div>
          </SheetSection>
          <FormSection title="Catatan akhir">
            <FormField label="Catatan">
              <TextInput value="Periksa warna sebelum pemakaian" readOnly />
            </FormField>
          </FormSection>
        </div>
      </FormSheet>
    </WorkspacePresentationProvider>
  );
}

export const ScrollEdges: Story = { render: () => <ScrollEdgesDemo /> };
export const DesktopScrollEdges: Story = { render: () => <ScrollEdgesDemo desktop /> };

export const Sheet: Story = {
  render: () => <FormSheetDemo />,
};

export const ConfirmationDefault: Story = {
  render: () => <ConfirmationModalDemo />,
};

export const ConfirmationDanger: Story = {
  render: () => <ConfirmationSheetDemo />,
};
