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
            className={`bg-surface-container-low focus-visible:ring-primary/25 min-h-12 w-full rounded-2xl p-3 text-left outline-none focus-visible:ring-2 ${
              revision.status === "VOID" ? "opacity-65" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold">
                R{revision.revision}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs leading-5 font-bold">
                  {revision.status === "VOID"
                    ? "Revisi dibatalkan"
                    : formatBusinessLabel(revision.status)}
                </span>
                {revision.voidReason && (
                  <span className="text-on-surface-variant block truncate text-[10px] leading-4">
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
            className="bg-primary/5 flex min-h-14 items-center gap-2 rounded-2xl p-2"
          >
            <button
              type="button"
              onClick={() => setHistoryDetailId(order.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-2 text-left"
            >
              <span className="material-symbols-outlined text-primary">history</span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold">
                Change Order R{order.baseRevision} ke R{order.revisedRevision}
              </span>
              <span className="text-primary font-mono text-[10px] font-bold">
                {Number(order.valueDelta) >= 0 ? "+" : ""}
                {formatShortRp(Number(order.valueDelta))}
              </span>
            </button>
            {order.status === "PENDING_APPROVAL" ? (
              <button
                type="button"
                disabled={pendingId === order.id}
                onClick={() => void approve(order.id)}
                className="bg-primary min-h-12 shrink-0 rounded-full px-4 text-[10px] font-bold text-white disabled:opacity-50"
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
