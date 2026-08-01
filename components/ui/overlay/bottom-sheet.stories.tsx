import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "../button/button";
import { BottomSheet, ConfirmationModal, ConfirmationSheet } from "./bottom-sheet";
import { SheetFooterActions } from "./sheet-footer-actions";

function BottomSheetDemo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[520px] w-full">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka drawer
      </Button>
      <BottomSheet
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
          Pembelian semen 40 sak untuk proyek Renovasi Rumah Jl. Kenanga No. 12. Total Rp
          6.400.000, dibayar tunai oleh Budi Santoso.
        </p>
      </BottomSheet>
    </div>
  );
}

function ConfirmationModalDemo(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <div className="h-[420px] w-full">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka konfirmasi
      </Button>
      <ConfirmationModal
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
    <div className="h-[420px] w-full">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Buka konfirmasi hapus
      </Button>
      <ConfirmationSheet
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
  title: "ui/overlay/BottomSheet",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sheet: Story = {
  render: () => <BottomSheetDemo />,
};

export const ConfirmationDefault: Story = {
  render: () => <ConfirmationModalDemo />,
};

export const ConfirmationDanger: Story = {
  render: () => <ConfirmationSheetDemo />,
};
