import React from "react";

import { ConfirmationDialog, Button } from "@/components/ui";

export function ProjectRecoveryModal({
  open,
  onClose,
  onSaveAndClose,
  onDiscard,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSaveAndClose: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  return (
    <ConfirmationDialog
      open={open}
      title="Tutup form proyek?"
      description="Isian sudah aman di perangkat ini dan dapat dilanjutkan saat form dibuka kembali."
      tone="warning"
      onClose={onClose}
      actions={
        <div className="space-y-2">
          <Button type="button" onClick={onSaveAndClose} fullWidth variant="primary">
            Simpan Lokal & Tutup
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={onDiscard}
              fullWidth
              className="min-w-0 px-4"
              variant="critical"
            >
              Buang Perubahan
            </Button>
            <Button
              type="button"
              onClick={onClose}
              fullWidth
              className="min-w-0 px-4"
              variant="secondary"
            >
              Lanjut Mengisi
            </Button>
          </div>
        </div>
      }
    />
  );
}
