"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import {
  reverseInventoryOpening,
  type InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import {
  AppIcon,
  FormField,
  FormRiskNotice,
  FormSection,
  InlineStateRow,
  MoneyValue,
  OperationalFormSheet,
  Textarea,
  useSheetPresenceValue,
} from "@/components/ui";
import { MaterialStatusLabel } from "@/features/materials/components/shared/material-page-primitives";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  OpeningBatchItemRow,
  OpeningBatchStateNotice,
  OpeningDetailRow,
  OpeningDetailSection,
} from "./opening-inventory-detail-primitives";
import { statusPresentation } from "./opening-inventory-utils";

interface OpeningInventoryBatchDetailSheetProps {
  readonly selectedBatch: InventoryOpeningBatchView | null;
  readonly setupOnly: boolean;
  readonly onDismiss: () => void;
  readonly onMutationComplete?: () => void;
}

export function OpeningInventoryBatchDetailSheet({
  selectedBatch,
  setupOnly,
  onDismiss,
  onMutationComplete,
}: OpeningInventoryBatchDetailSheetProps): React.JSX.Element {
  const router = useRouter();
  const [reversalMode, setReversalMode] = React.useState(false);
  const [reversalReason, setReversalReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const {
    presentedValue: presentedBatch,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedBatch, selectedBatch?.id);

  function close(): void {
    if (pending) return;
    onDismiss();
    setReversalMode(false);
    setReversalReason("");
  }

  async function reverseSelectedBatch(): Promise<void> {
    if (!selectedBatch || !selectedBatch.canReverse || reversalReason.trim().length < 10) return;

    setPending(true);
    const result = await reverseInventoryOpening({
      batchId: selectedBatch.id,
      reason: reversalReason,
    });
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Saldo awal stok berhasil dibalik dan tercatat di audit log.");
    close();
    onMutationComplete?.();
    router.refresh();
  }

  return (
    <OperationalFormSheet
      open={open}
      title={
        reversalMode
          ? "Konfirmasi pembalikan"
          : (presentedBatch?.batchNumber ?? "Detail saldo awal")
      }
      submitLabel="Balik"
      submittingLabel="Membalik…"
      pending={pending}
      danger
      hideSubmit={!reversalMode}
      disabled={reversalReason.trim().length < 10}
      disabledReason={
        reversalMode && reversalReason.trim().length < 10
          ? "Alasan audit minimal 10 karakter."
          : undefined
      }
      onClose={close}
      onExitComplete={handleExitComplete}
      onSubmit={() => void reverseSelectedBatch()}
    >
      {presentedBatch ? (
        <div className="space-y-4 pb-1">
          <div className="flex items-center gap-3 px-1">
            <AppIcon
              name="inventory"
              className="flex! icon-lg h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-5 font-bold text-on-surface">
                Saldo awal stok
              </span>
              <span className="mt-0.5 block truncate text-meta text-on-surface-variant">
                {new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "long",
                }).format(new Date(presentedBatch.cutoverDate))}
              </span>
            </span>
            <MaterialStatusLabel
              label={statusPresentation(presentedBatch.status).label}
              tone={statusPresentation(presentedBatch.status).tone}
            />
          </div>

          <OpeningDetailSection title="Ringkasan batch">
            <div className="divide-y divide-outline-variant/15 px-3">
              <OpeningDetailRow label="Nomor batch" value={presentedBatch.batchNumber} />
              <OpeningDetailRow label="Jumlah item" value={`${presentedBatch.itemCount} item`} />
              <OpeningDetailRow
                label="Nilai inventory"
                value={
                  <MoneyValue
                    amount={presentedBatch.totalValue}
                    variant="compactWithFull"
                    size="sm"
                    align="right"
                  />
                }
              />
            </div>
          </OpeningDetailSection>

          <OpeningDetailSection title="Item stok awal">
            {presentedBatch.items.length > 0 ? (
              <div className="divide-y divide-outline-variant/15 px-3">
                {presentedBatch.items.map((item) => (
                  <OpeningBatchItemRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <InlineStateRow
                icon="inventory_2"
                title="Rincian item tidak tersedia"
                description="Batch tidak memiliki item saldo awal yang dapat ditampilkan."
                tone="warning"
              />
            )}
          </OpeningDetailSection>

          <OpeningDetailSection title="Sumber & audit">
            <div className="divide-y divide-outline-variant/15 px-3">
              <OpeningDetailRow
                label="Dokumen"
                value={presentedBatch.referenceNumber || "Tidak ada"}
              />
              <OpeningDetailRow label="Diajukan oleh" value={presentedBatch.requestedByName} />
              {presentedBatch.approvedByName ? (
                <OpeningDetailRow
                  label={
                    presentedBatch.status === "REJECTED" ? "Diputuskan oleh" : "Disetujui oleh"
                  }
                  value={presentedBatch.approvedByName}
                />
              ) : null}
              {presentedBatch.reversedByName ? (
                <OpeningDetailRow label="Dibalik oleh" value={presentedBatch.reversedByName} />
              ) : null}
              <div className="py-3.5">
                <p className="text-[10px] font-medium text-on-surface-variant">Catatan sumber</p>
                <p className="mt-1.5 text-[12px] leading-5 font-semibold whitespace-pre-wrap text-on-surface">
                  {presentedBatch.note}
                </p>
              </div>
            </div>
          </OpeningDetailSection>

          {reversalMode ? (
            <>
              <FormRiskNotice title="Pastikan belum ada movement berikutnya" tone="danger">
                Pembalikan hanya berhasil jika saldo, reservation, dan urutan pergerakan stok masih
                persis seperti saat saldo awal diposting.
              </FormRiskNotice>
              <FormSection
                title="Alasan audit"
                helper="Alasan disimpan bersama movement pembalikan dan audit log."
              >
                <FormField label="Alasan pembalikan" required>
                  <Textarea
                    value={reversalReason}
                    onChange={setReversalReason}
                    placeholder="Contoh: Saldo awal salah lokasi dan belum ada transaksi stok lanjutan."
                    disabled={pending}
                    required
                  />
                </FormField>
              </FormSection>
            </>
          ) : (
            <OpeningBatchStateNotice
              batch={presentedBatch}
              reversalAvailable={presentedBatch.canReverse && !setupOnly}
            />
          )}

          {!reversalMode && presentedBatch.canReverse && !setupOnly ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setReversalMode(true)}
              className="min-h-12 w-full rounded-full bg-error/10 px-5 text-xs font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              Balik saldo awal
            </motion.button>
          ) : null}
        </div>
      ) : null}
    </OperationalFormSheet>
  );
}
