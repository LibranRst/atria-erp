"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { approveProjectChangeOrder } from "@/app/actions/project/revision-change-order";
import { NativePanel } from "../shared/rap-rab-primitives";
import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import type { ChangeOrderHistoryView, RabRevisionHistoryView } from "../shared/rap-rab-manager";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { AppIcon } from "@/components/ui/icon/app-icon";

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

  async function approve(orderId: string): Promise<void> {
    setPendingId(orderId);
    const result = await approveProjectChangeOrder({ changeOrderId: orderId });
    setPendingId(null);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Change Order disetujui dan baseline kontrak diperbarui.");
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-primary">
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
              <span className="font-mono text-[10px] font-bold">
                {formatShortRp(revision.value)}
              </span>
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
              <span className="font-mono text-[10px] font-bold text-primary">
                {Number(order.valueDelta) >= 0 ? "+" : ""}
                {formatShortRp(Number(order.valueDelta))}
              </span>
            </button>
            {order.status === "PENDING_APPROVAL" ? (
              <button
                type="button"
                disabled={pendingId === order.id}
                onClick={() => void approve(order.id)}
                className="min-h-12 shrink-0 rounded-full bg-primary px-4 text-[10px] font-bold text-white disabled:opacity-50"
              >
                {pendingId === order.id ? "Memproses" : "Setujui"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </NativePanel>
  );
}
