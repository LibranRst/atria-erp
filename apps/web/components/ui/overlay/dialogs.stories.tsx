import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "../button/button";
import { TextInput } from "../form/basic-form-controls";
import { FormField } from "../form/basic-form-controls";
import { SheetFooterActions } from "./sheet-footer-actions";
import { CompactFormDialog, ConfirmationDialog, SuccessDialog } from "./dialogs";

function DialogGallery(): React.JSX.Element {
  const [compactOpen, setCompactOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [name, setName] = useState("Percakapan budget Agustus");

  return (
    <div className="flex min-h-72 flex-wrap items-center justify-center gap-2 bg-background p-6">
      <Button variant="secondary" onClick={() => setCompactOpen(true)}>
        Compact form
      </Button>
      <Button variant="secondary" onClick={() => setConfirmationOpen(true)}>
        Confirmation
      </Button>
      <Button variant="secondary" onClick={() => setSuccessOpen(true)}>
        Success
      </Button>

      <CompactFormDialog
        open={compactOpen}
        title="Ganti judul"
        actions={
          <SheetFooterActions
            secondary={{ label: "Batal", onClick: () => setCompactOpen(false) }}
            primary={{ label: "Simpan", onClick: () => setCompactOpen(false) }}
          />
        }
        onClose={() => setCompactOpen(false)}
      >
        <FormField label="Judul percakapan">
          <TextInput autoFocus value={name} onChange={setName} />
        </FormField>
      </CompactFormDialog>

      <ConfirmationDialog
        open={confirmationOpen}
        title="Hapus percakapan?"
        description="Riwayat chat akan dihapus dan tidak dapat dipulihkan."
        confirmLabel="Hapus"
        danger
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => setConfirmationOpen(false)}
      />

      <SuccessDialog
        open={successOpen}
        title="Pembayaran tercatat"
        description="Saldo rekening dan status invoice sudah diperbarui."
        facts={[
          { label: "Nominal", value: "Rp 12.500.000" },
          { label: "Rekening", value: "BCA Operasional" },
          { label: "Status", value: "Sudah diposting" },
        ]}
        onClose={() => setSuccessOpen(false)}
      />
    </div>
  );
}

const meta = {
  title: "ui/overlay/ContextualDialogs",
  component: DialogGallery,
} satisfies Meta<typeof DialogGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
