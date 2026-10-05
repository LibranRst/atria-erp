"use client";

import React from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { toast } from "sonner";

import { approveProjectChangeOrder } from "@/app/actions/project/revision-change-order";
import { NativePanel } from "../shared/rap-rab-primitives";
import { formatShortIdr as formatShortRp } from "@atria/core/utils/money";
import type { ChangeOrderHistoryView, RabRevisionHistoryView } from "../shared/rap-rab-manager";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { AppIcon, Button, CompactFormDialog, FormField, Textarea } from "@/components/ui";

export function RabRevisionHistoryPanel({
  revisionHistory,
  changeOrders,
  setHistoryDetailId,
}: {
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly setHistoryDetailId: (id: string | null) => void;
}): React.JSX.Element {
  const router = useRouter();
  const { openActivityDetail } = useActivityDetail();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const [overrideOrderId, setOverrideOrderId] = React.useState<string | null>(null);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [overridePending, setOverridePending] = React.useState(false);

  async function approve(orderId: string): Promise<void> {
    setPendingId(orderId);
    const result = await approveProjectChangeOrder({ changeOrderId: orderId });
    setPendingId(null);
    if (!result.success) {
      if (
        result.error.message.includes("MAKER_CHECKER_REQUIRED") ||
        result.error.message.includes("disetujui user lain")
      ) {
        setOverrideOrderId(orderId);
        setOverrideReason("");
        return;
      }
      toast.error(result.error.message);
      return;
    }
    toast.success("Change Order disetujui dan baseline kontrak diperbarui.");
    router.refresh();
  }

  async function submitEmergencyOverride(): Promise<void> {
    if (!overrideOrderId) return;
    if (overrideReason.trim().length < 10) {
      toast.error("Alasan persetujuan darurat minimal 10 karakter.");
      return;
    }
    setOverridePending(true);
    const result = await approveProjectChangeOrder({
      changeOrderId: overrideOrderId,
      emergencyOverride: true,
      reason: overrideReason.trim(),
    });
    setOverridePending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    setOverrideOrderId(null);
    setOverrideReason("");
    toast.success("Change Order disetujui dengan persetujuan darurat (Emergency Override).");
    router.refresh();
  }

  return (
    <NativePanel eyebrow="Jejak perubahan" title="Riwayat Revisi">
      <div className="space-y-2">
        {revisionHistory.map((revision) => (
          <button
            type="button"
            onClick={() => openActivityDetail({ kind: "RAB_REVISION", id: revision.id })}
            key={revision.id}
            className={`min-h-12 w-full rounded-2xl bg-surface-container-low p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              revision.status === "VOID" ? "opacity-65" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-meta font-bold text-primary">
                R{revision.revision}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs leading-5 font-bold">
                  {revision.status === "VOID"
                    ? "Revisi dibatalkan"
                    : formatBusinessLabel(revision.status)}
                </span>
                {revision.voidReason && (
                  <span className="block truncate text-meta text-on-surface-variant">
                    {revision.voidReason}
                  </span>
                )}
              </span>
              <span className="font-mono text-meta font-bold">{formatShortRp(revision.value)}</span>
              <ActivityDetailChevron />
            </div>
          </button>
        ))}
        {changeOrders.map((order) => (
          <div
            key={order.id}
            className="flex min-h-14 items-center gap-2 rounded-2xl bg-primary/5 p-2"
          >
            <button
              type="button"
              onClick={() => setHistoryDetailId(order.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-2 text-left"
            >
              <AppIcon name="history" className="text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">
                Change Order R{order.baseRevision} ke R{order.revisedRevision}
              </span>
              <span className="font-mono text-meta font-bold text-primary">
                {Number(order.valueDelta) >= 0 ? "+" : ""}
                {formatShortRp(Number(order.valueDelta))}
              </span>
            </button>
            {order.status === "PENDING_APPROVAL" ? (
              <button
                type="button"
                disabled={pendingId === order.id}
                onClick={() => void approve(order.id)}
                className="min-h-12 shrink-0 rounded-full bg-primary px-4 text-meta font-bold text-white disabled:opacity-50"
              >
                {pendingId === order.id ? "Memproses" : "Setujui"}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <CompactFormDialog
        open={overrideOrderId !== null}
        title="Persetujuan Darurat (Emergency Override)"
        pending={overridePending}
        onClose={() => {
          if (!overridePending) {
            setOverrideOrderId(null);
            setOverrideReason("");
          }
        }}
        actions={
          <Button
            variant="primary"
            fullWidth
            pending={overridePending}
            disabled={overrideReason.trim().length < 10}
            onClick={() => void submitEmergencyOverride()}
          >
            Setujui Darurat
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-on-surface-variant">
            Change Order ini dibuat oleh akun Anda. Sesuai prinsip Maker-Checker, persetujuan
            memerlukan otorisasi pihak lain (Finance/Owner). Sebagai Owner, Anda dapat memakai hak
            persetujuan darurat dengan alasan tertulis.
          </p>
          <FormField
            label="Alasan Persetujuan Darurat"
            helper="Minimal 10 karakter alasan tertulis."
            required
          >
            <Textarea
              id="co-emergency-override-reason"
              autoFocus
              rows={3}
              value={overrideReason}
              onChange={setOverrideReason}
              placeholder="Contoh: Klien mengonfirmasi via WA dan meminta pengerjaan add-on segera dimulai."
              disabled={overridePending}
            />
          </FormField>
        </div>
      </CompactFormDialog>
    </NativePanel>
  );
}
