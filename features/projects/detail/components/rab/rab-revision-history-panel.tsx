"use client";

import React from "react";

import { NativePanel } from "../shared/rap-rab-primitives";
import { formatShortIdr as formatShortRp } from "@/lib/utils/money";
import type {
  ChangeOrderHistoryView,
  RabRevisionHistoryView,
} from "../shared/rap-rab-manager";

export function RabRevisionHistoryPanel({
  revisionHistory,
  changeOrders,
  setHistoryDetailId,
}: {
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly setHistoryDetailId: (id: string | null) => void;
}): React.JSX.Element {
  return (
    <NativePanel eyebrow="Jejak perubahan" title="Riwayat Revisi">
      <div className="space-y-2">
        {revisionHistory.map((revision) => (
          <div
            key={revision.id}
            className={`rounded-2xl bg-surface-container-low p-3 ${
              revision.status === "VOID" ? "opacity-65" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-primary">
                R{revision.revision}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">
                  {revision.status === "VOID"
                    ? "Revisi dibatalkan"
                    : revision.status}
                </span>
                {revision.voidReason && (
                  <span className="block truncate text-[10px] text-on-surface-variant">
                    {revision.voidReason}
                  </span>
                )}
              </span>
              <span className="font-mono text-[10px] font-bold">
                {formatShortRp(revision.value)}
              </span>
            </div>
          </div>
        ))}
        {changeOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => setHistoryDetailId(order.id)}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-primary/5 p-3 text-left"
          >
            <span className="material-symbols-outlined text-primary">history</span>
            <span className="min-w-0 flex-1 truncate text-xs font-bold">
              Change Order R{order.baseRevision} ke R{order.revisedRevision}
            </span>
            <span className="font-mono text-[10px] font-bold text-primary">
              {Number(order.valueDelta) >= 0 ? "+" : ""}
              {formatShortRp(Number(order.valueDelta))}
            </span>
          </button>
        ))}
      </div>
    </NativePanel>
  );
}
