import React from "react";

import { AppIcon, ButtonLink } from "@/components/ui";
import { formatShortIdr as formatShortRp } from "@atria/core/utils/money";
import type { PendingChangeOrderSummary } from "../../server/get-approvals-page-data";

export function PendingChangeOrdersBanner({
  orders,
}: {
  readonly orders: readonly PendingChangeOrderSummary[];
}): React.JSX.Element | null {
  if (orders.length === 0) return null;

  return (
    <div className="mb-3 rounded-3xl bg-surface-container-lowest p-4 ring-1 ring-ring-subtle shadow-surface">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <AppIcon name="history" className="h-4 w-4" />
          </span>
          <span className="text-meta font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            Change Order Menunggu Persetujuan
          </span>
        </div>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-meta font-bold text-primary">
          {orders.length}
        </span>
      </div>

      <div className="space-y-2">
        {orders.map((order) => {
          const delta = Number(order.valueDelta);
          const isPositive = delta >= 0;

          return (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-bold text-on-surface">
                    {order.projectName}
                  </p>
                  <span className="shrink-0 text-meta font-bold text-primary">
                    R{order.baseRevision} → R{order.revisedRevision}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-meta text-on-surface-variant">
                  {order.reason}
                </p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant/70">
                  Diajukan oleh {order.createdByName}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <span className="font-mono text-meta font-bold text-primary tabular-nums">
                  {isPositive ? "+" : ""}
                  {formatShortRp(delta)}
                </span>
                <ButtonLink
                  href={`/projects/${order.projectId}?tab=rab`}
                  size="compact"
                  variant="secondary"
                >
                  Buka RAB →
                </ButtonLink>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
