"use client";

import React from "react";

import { AppIcon, ButtonLink, FormDisclosure, GroupedSurface, MoneyValue } from "@/components/ui";
import {
  useWorkspaceControlPresentation,
  useWorkspacePresentation,
} from "@/lib/navigation/workspace-presentation";
import { formatShortIdr as formatShortRp } from "@atria/core/utils/money";
import type { PendingChangeOrderSummary } from "../../server/get-approvals-page-data";

export function PendingChangeOrdersBanner({
  orders,
}: {
  readonly orders: readonly PendingChangeOrderSummary[];
}): React.JSX.Element | null {
  const viewportDesktop = useWorkspacePresentation() === "desktop";
  const controlsDesktop = useWorkspaceControlPresentation() === "desktop";
  const [expanded, setExpanded] = React.useState(false);
  if (orders.length === 0) return null;

  if (viewportDesktop || controlsDesktop) {
    return (
      <GroupedSurface variant="desktopPanel" className="px-4">
        <FormDisclosure
          title={`${orders.length} revisi proyek menunggu persetujuan`}
          description="Tinjau perubahan nilai dan lingkup melalui RAB proyek."
          icon={<AppIcon name="history" className="icon-sm" />}
          variant="plain"
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
        >
          <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
            {orders.map((order) => {
              const delta = Number(order.valueDelta);
              return (
                <div
                  key={order.id}
                  className="flex min-w-0 items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-row font-semibold" title={order.projectName}>
                      {order.projectName}
                    </p>
                    <p
                      className="mt-1 truncate text-support text-on-surface-variant"
                      title={order.reason}
                    >
                      {order.reason}
                    </p>
                    <p className="mt-1 text-meta text-on-surface-variant">
                      Revisi {order.baseRevision} ke {order.revisedRevision} · {order.createdByName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <MoneyValue
                      amount={delta}
                      fractionDigits={Number.isInteger(delta) ? 0 : 2}
                      variant="compact"
                      size="sm"
                    />
                    <ButtonLink
                      href={`/projects/${order.projectId}?tab=rab`}
                      size="compact"
                      variant="secondary"
                    >
                      Buka RAB <AppIcon name="arrow_forward" className="icon-sm" />
                    </ButtonLink>
                  </div>
                </div>
              );
            })}
          </div>
        </FormDisclosure>
      </GroupedSurface>
    );
  }

  return (
    <div className="mb-3 rounded-3xl bg-surface-container-lowest p-4 shadow-surface ring-1 ring-ring-subtle">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <AppIcon name="history" className="h-4 w-4" />
          </span>
          <span className="text-meta font-bold tracking-[0.12em] text-on-surface-variant uppercase">
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
                  <p className="truncate text-xs font-bold text-on-surface">{order.projectName}</p>
                  <span className="shrink-0 text-meta font-bold text-primary">
                    R{order.baseRevision} → R{order.revisedRevision}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-meta text-on-surface-variant">{order.reason}</p>
                <p className="mt-0.5 text-meta text-on-surface-variant/70">
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
