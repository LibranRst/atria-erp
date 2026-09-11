"use client";

import React from "react";

import { RabEmptyState } from "./rab-empty-state";
import { RabClientSummaryPanel, RabDraftActionsPanel, RabItemsPanel } from "./rab-client-sections";
import { RabRevisionHistoryPanel } from "./rab-revision-history-panel";
import { RabExportDrawer } from "./rab-export-drawer";
import type { RabExportMetadata } from "../../utils/rab-export-utils";
import type {
  RapView,
  RabEstimateView,
  RabItemView,
  RabBundleView,
  RabRevisionHistoryView,
  ChangeOrderHistoryView,
} from "../shared/rap-rab-manager";

export function RabClientPanel({
  rabEstimate,
  isRevisionDraft,
  approvedBaseline,
  visibleRabValue,
  staleSourceLabels,
  isPending,
  handleRefreshRabSources,
  canManageRab,
  rap,
  setSourcePickerOpen,
  setManualLineOpen,
  openEditBundle,
  setRabItemEditorId,
  sortedRabItems,
  openCreateBundle,
  setChangeOrderOpen,
  setVoidRevisionOpen,
  handleApproveRab,
  revisionHistory,
  changeOrders,
  setHistoryDetailId,
  exportMetadata,
}: {
  readonly rabEstimate: RabEstimateView | null;
  readonly isRevisionDraft: boolean;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly visibleRabValue: number;
  readonly staleSourceLabels: readonly string[];
  readonly isPending: boolean;
  readonly handleRefreshRabSources: () => void;
  readonly canManageRab: boolean;
  readonly rap: RapView | null;
  readonly setSourcePickerOpen: (open: boolean) => void;
  readonly setManualLineOpen: (open: boolean) => void;
  readonly openEditBundle: (bundle: RabBundleView) => void;
  readonly setRabItemEditorId: (id: string | null) => void;
  readonly sortedRabItems: readonly RabItemView[];
  readonly openCreateBundle: () => void;
  readonly setChangeOrderOpen: (open: boolean) => void;
  readonly setVoidRevisionOpen: (open: boolean) => void;
  readonly handleApproveRab: () => void;
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly setHistoryDetailId: (id: string | null) => void;
  readonly exportMetadata?: RabExportMetadata;
}): React.JSX.Element {
  const [exportDrawerOpen, setExportDrawerOpen] = React.useState(false);

  if (!rabEstimate) {
    return <RabEmptyState canManageRab={canManageRab} setSourcePickerOpen={setSourcePickerOpen} />;
  }

  return (
    <>
      <RabClientSummaryPanel
        rabEstimate={rabEstimate}
        isRevisionDraft={isRevisionDraft}
        approvedBaseline={approvedBaseline}
        visibleRabValue={visibleRabValue}
        staleSourceLabels={staleSourceLabels}
        isPending={isPending}
        handleRefreshRabSources={handleRefreshRabSources}
        canManageRab={canManageRab}
        rap={rap}
        setSourcePickerOpen={setSourcePickerOpen}
        onOpenExport={() => setExportDrawerOpen(true)}
      />

      <RabItemsPanel
        rabEstimate={rabEstimate}
        canManageRab={canManageRab}
        setManualLineOpen={setManualLineOpen}
        openEditBundle={openEditBundle}
        setRabItemEditorId={setRabItemEditorId}
        sortedRabItems={sortedRabItems}
        openCreateBundle={openCreateBundle}
      />

      {canManageRab && rabEstimate.status === "DRAFT" && (
        <RabDraftActionsPanel
          rabEstimate={rabEstimate}
          isRevisionDraft={isRevisionDraft}
          isPending={isPending}
          setChangeOrderOpen={setChangeOrderOpen}
          setVoidRevisionOpen={setVoidRevisionOpen}
          handleApproveRab={handleApproveRab}
        />
      )}

      <RabRevisionHistoryPanel
        revisionHistory={revisionHistory}
        changeOrders={changeOrders}
        setHistoryDetailId={setHistoryDetailId}
      />

      <RabExportDrawer
        open={exportDrawerOpen}
        onClose={() => setExportDrawerOpen(false)}
        rabEstimate={rabEstimate}
        meta={
          exportMetadata || {
            projectName: "Proyek",
          }
        }
      />
    </>
  );
}
