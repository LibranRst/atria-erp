"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { AppIcon, Button, GroupedSurface } from "@/components/ui";

import { RabEmptyState } from "./rab-empty-state";
import { RabClientSummaryPanel, RabDraftActionsPanel, RabItemsPanel } from "./rab-client-sections";
import { RabRevisionHistoryPanel } from "./rab-revision-history-panel";
import { RabDesktopPanel } from "./rab-desktop-panel";
import type { RabExportMetadata } from "../../utils/rab-export-utils";
import type {
  RapView,
  RabEstimateView,
  RabItemView,
  RabBundleView,
  RabRevisionHistoryView,
  ChangeOrderHistoryView,
} from "../shared/rap-rab-manager";

const RabExportDrawer = dynamic(
  () => import("./rab-export-drawer").then((module) => module.RabExportDrawer),
  { ssr: false },
);

export function RabClientPanel({
  rabEstimate,
  isRevisionDraft,
  approvedBaseline,
  visibleRabValue,
  staleSourceLabels,
  isPending,
  handleRefreshRabSources,
  canManageRab,
  canCreateRab = canManageRab,
  canApproveRab = false,
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
  onWorkflowActiveChange,
  fallbackFocusRef,
}: {
  readonly rabEstimate: RabEstimateView | null;
  readonly isRevisionDraft: boolean;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly visibleRabValue: number;
  readonly staleSourceLabels: readonly string[];
  readonly isPending: boolean;
  readonly handleRefreshRabSources: () => void;
  readonly canManageRab: boolean;
  readonly canCreateRab?: boolean;
  readonly canApproveRab?: boolean;
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
  readonly onWorkflowActiveChange?: (active: boolean) => void;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const [exportDrawerOpen, setExportDrawerOpen] = React.useState(false);
  const [exportRequested, setExportRequested] = React.useState(false);
  const [decisionActive, setDecisionActive] = React.useState(false);
  const [historyActive, setHistoryActive] = React.useState(false);
  React.useEffect(() => {
    onWorkflowActiveChange?.(exportDrawerOpen || decisionActive || historyActive);
  }, [exportDrawerOpen, decisionActive, historyActive, onWorkflowActiveChange]);
  const openExport = (): void => {
    setExportRequested(true);
    setExportDrawerOpen(true);
  };

  if (!rabEstimate) {
    return (
      <>
        <div hidden={desktop} inert={desktop}>
          <RabEmptyState canManageRab={canCreateRab} setSourcePickerOpen={setSourcePickerOpen} />
        </div>
        <div hidden={!desktop} inert={!desktop}>
          <GroupedSurface variant="desktopPanel">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-semibold">Belum ada RAB klien</h2>
                <p className="max-w-prose text-support text-on-surface-variant">
                  Pilih material dan paket kerja, lalu tinjau uraian serta harga jual pada draf RAB.
                </p>
              </div>
              {canCreateRab ? (
                <Button variant="primary" size="compact" onClick={() => setSourcePickerOpen(true)}>
                  <AppIcon name="add" className="icon-sm" />
                  Buat draf RAB
                </Button>
              ) : null}
            </div>
          </GroupedSurface>
        </div>
      </>
    );
  }

  return (
    <>
      <div hidden={!desktop} inert={!desktop}>
        <RabDesktopPanel
          rabEstimate={rabEstimate}
          isRevisionDraft={isRevisionDraft}
          approvedBaseline={approvedBaseline}
          visibleRabValue={visibleRabValue}
          staleSourceLabels={staleSourceLabels}
          isPending={isPending}
          handleRefreshRabSources={handleRefreshRabSources}
          canManageRab={canManageRab}
          canCreateRab={canCreateRab}
          rap={rap}
          setSourcePickerOpen={setSourcePickerOpen}
          setManualLineOpen={setManualLineOpen}
          openEditBundle={openEditBundle}
          setRabItemEditorId={setRabItemEditorId}
          openCreateBundle={openCreateBundle}
          onOpenExport={openExport}
        />
      </div>
      <div hidden={desktop} inert={desktop} className="space-y-sm">
        <RabClientSummaryPanel
          rabEstimate={rabEstimate}
          isRevisionDraft={isRevisionDraft}
          approvedBaseline={approvedBaseline}
          visibleRabValue={visibleRabValue}
          staleSourceLabels={staleSourceLabels}
          isPending={isPending}
          handleRefreshRabSources={handleRefreshRabSources}
          canManageRab={canManageRab}
          canCreateRab={canCreateRab}
          rap={rap}
          setSourcePickerOpen={setSourcePickerOpen}
          onOpenExport={openExport}
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
      </div>

      {(canManageRab || canApproveRab) && rabEstimate.status === "DRAFT" && (
        <RabDraftActionsPanel
          rabEstimate={rabEstimate}
          isRevisionDraft={isRevisionDraft}
          isPending={isPending}
          setChangeOrderOpen={setChangeOrderOpen}
          setVoidRevisionOpen={setVoidRevisionOpen}
          handleApproveRab={handleApproveRab}
          canApproveRab={canApproveRab}
          canManageRab={canManageRab}
          desktop={desktop}
          onWorkflowActiveChange={setDecisionActive}
        />
      )}

      <RabRevisionHistoryPanel
        revisionHistory={revisionHistory}
        changeOrders={changeOrders}
        setHistoryDetailId={setHistoryDetailId}
        desktop={desktop}
        canApproveRab={canApproveRab}
        onWorkflowActiveChange={setHistoryActive}
      />

      {exportRequested ? (
        <RabExportDrawer
          fallbackFocusRef={fallbackFocusRef}
          open={exportDrawerOpen}
          onClose={() => setExportDrawerOpen(false)}
          rabEstimate={rabEstimate}
          meta={
            exportMetadata || {
              projectName: "Proyek",
            }
          }
        />
      ) : null}
    </>
  );
}
