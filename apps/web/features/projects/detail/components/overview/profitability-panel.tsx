"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCan } from "@/components/auth/permissions-provider";
import { ConfirmationDialog, FactRow, MoneyValue, PageState } from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import type { ProjectMarginData } from "@atria/core/types/project-margin";
import { LockedTabState } from "../shared/project-tab-states";
import { CashRealizationSection, ProfitProjectionSection } from "./profitability-summary-sections";
import { ProjectClosingSection } from "./project-closing-section";
import { ProjectMarginDesktop, ProjectMarginDesktopCash } from "./project-margin-desktop";
import {
  canReviewProjectClosing,
  marginFinalSnapshot,
  marginSource,
} from "./project-margin-desktop-model";
import {
  completeProject,
  getProjectClosingChecklist,
  type ProjectClosingChecklist,
} from "@/app/actions/project/closing";
import type { TabId } from "../shared/project-tabs";

interface ProfitabilityPanelProps {
  readonly projectId: string;
  readonly projectStatus: string;
  readonly contractValue: number;
  readonly totalAllocated: number;
  readonly projectedGrossProfit: number;
  readonly projectedGrossMargin: number;
  readonly totalRemaining: number;
  readonly totalReceived: number;
  readonly totalPaid: number;
  readonly cashPosition: number;
  readonly isLocked: boolean;
  readonly nextSetupTab: TabId;
  readonly nextSetupLabel: string;
  readonly nextSetupIcon: string;
  readonly setActiveTab: (tab: TabId) => void;
  readonly budget?: ProjectBudgetDashboard | null;
  readonly marginData?: ProjectMarginData;
  readonly onWorkflowActiveChange?: (active: boolean) => void;
}

type MarginSnapshot = Pick<ProfitabilityPanelProps, "budget" | "marginData" | "projectStatus">;

export function ProfitabilityPanel(props: ProfitabilityPanelProps): React.JSX.Element {
  const { onWorkflowActiveChange } = props;
  const can = useCan();
  const router = useRouter();
  const desktop = useWorkspacePresentation() === "desktop";
  const [snapshot, setSnapshot] = useState<MarginSnapshot>({
    budget: props.budget,
    marginData: props.marginData,
    projectStatus: props.projectStatus,
  });
  const { budget, marginData, projectStatus } = snapshot;
  const [closingChecklist, setClosingChecklist] = useState<ProjectClosingChecklist | null>(null);
  const [closingMessage, setClosingMessage] = useState<string | null>(null);
  const [closingNote, setClosingNote] = useState("");
  const [closingAction, setClosingAction] = useState<"check" | "complete" | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [confirmation, setConfirmation] = useState<"complete" | "discard" | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const requestPending = useRef(false);
  const closingPending = closingAction !== null;
  const workflowActive =
    closingPending || closingChecklist !== null || closingNote.length > 0 || confirmation !== null;
  useEffect(() => {
    onWorkflowActiveChange?.(workflowActive);
    return () => onWorkflowActiveChange?.(false);
  }, [onWorkflowActiveChange, workflowActive]);
  if (
    !workflowActive &&
    (snapshot.budget !== props.budget ||
      snapshot.marginData !== props.marginData ||
      snapshot.projectStatus !== props.projectStatus)
  ) {
    setSnapshot({
      budget: props.budget,
      marginData: props.marginData,
      projectStatus: props.projectStatus,
    });
  }
  const source = marginSource(marginData, budget);
  const sourceReady = source.status === "ready" && Boolean(budget);
  const canClose =
    can("view:project") &&
    can("update:budget") &&
    can("view:profitability") &&
    can("close:project");
  const canReview = canReviewProjectClosing({
    projectStatus,
    sourceReady,
    checklist: closingChecklist,
    permitted: canClose,
    note: closingNote,
    pending: closingPending,
  });
  const final = marginFinalSnapshot(projectStatus, marginData);

  function clearInspection(): void {
    setClosingChecklist(null);
    setCheckedAt(null);
    setClosingNote("");
    setClosingMessage(null);
    setConfirmation(null);
  }
  function dismissInspection(): void {
    if (requestPending.current) return;
    if (closingNote.trim()) setConfirmation("discard");
    else clearInspection();
  }
  function loadClosingChecklist(): void {
    if (requestPending.current || !canClose || !sourceReady || projectStatus !== "ACTIVE") return;
    requestPending.current = true;
    setClosingChecklist(null);
    setCheckedAt(null);
    setConfirmation(null);
    setClosingMessage(null);
    setClosingAction("check");
    void (async (): Promise<void> => {
      try {
        const result = await getProjectClosingChecklist(props.projectId);
        if (!result.success) {
          setClosingMessage(result.error.message);
          toast.error(result.error.message);
          return;
        }
        setClosingChecklist(result.data);
        setCheckedAt(new Date());
        toast.success(
          result.data.canComplete
            ? "Proyek siap untuk ditinjau sebelum penutupan."
            : "Pemeriksaan penutupan selesai.",
        );
      } catch {
        const message = "Kesiapan penutupan belum dapat diperiksa. Periksa koneksi lalu coba lagi.";
        setClosingMessage(message);
        toast.error(message);
      } finally {
        requestPending.current = false;
        setClosingAction(null);
      }
    })();
  }
  function handleCompleteProject(): void {
    if (requestPending.current || !canReview || confirmation !== "complete") return;
    requestPending.current = true;
    setClosingAction("complete");
    setClosingMessage(null);
    void (async (): Promise<void> => {
      try {
        const result = await completeProject({
          projectId: props.projectId,
          closingNote: closingNote.trim(),
        });
        if (!result.success) {
          setClosingChecklist(null);
          setCheckedAt(null);
          setConfirmation(null);
          setClosingMessage(result.error.message);
          toast.error(result.error.message);
          return;
        }
        clearInspection();
        toast.success("Proyek selesai dan ringkasan akhir berhasil disimpan.");
        router.refresh();
      } catch {
        setClosingChecklist(null);
        setCheckedAt(null);
        setConfirmation(null);
        const message =
          "Penutupan belum dapat dipastikan. Periksa kembali kesiapan sebelum mencoba lagi.";
        setClosingMessage(message);
        toast.error(message);
      } finally {
        requestPending.current = false;
        setClosingAction(null);
      }
    })();
  }

  if (!final && source.status === "missing" && props.isLocked)
    return (
      <LockedTabState
        tabLabel="Margin"
        actionLabel={props.nextSetupLabel}
        actionIcon={props.nextSetupIcon}
        onAction={() => props.setActiveTab(props.nextSetupTab)}
      />
    );
  if (!sourceReady && !final)
    return (
      <PageState
        compact
        kind={
          source.status === "restricted"
            ? "restricted"
            : source.status === "missing"
              ? "first-use"
              : "error"
        }
        title={
          source.status === "restricted"
            ? "Akses margin terbatas"
            : source.status === "missing"
              ? "Budget internal belum tersedia"
              : "Margin belum dapat dimuat"
        }
        description={
          source.message ?? "Kondisi margin belum dapat dipastikan tanpa sumber budget proyek."
        }
        actionLabel={source.status === "unavailable" ? "Coba lagi" : undefined}
        onAction={source.status === "unavailable" ? () => router.refresh() : undefined}
      />
    );

  return (
    <div
      className={
        desktop ? "grid min-w-0 grid-cols-[minmax(0,1fr)_22rem] items-start gap-4" : "space-y-sm"
      }
    >
      <div className={desktop ? "col-span-2 min-w-0" : "contents"}>
        {desktop ? (
          <ProjectMarginDesktop
            budget={budget ?? null}
            marginData={marginData}
            projectStatus={projectStatus}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={setSelectedCategoryId}
            onCategoryClose={() => setSelectedCategoryId(null)}
            onNavigate={props.setActiveTab}
            onRetry={() => router.refresh()}
          />
        ) : (
          <>
            <ProfitProjectionSection
              contractValue={
                final ? Number(final.contractValue) : (budget?.contractValue ?? props.contractValue)
              }
              totalAllocated={
                final
                  ? Number(final.internalBudget)
                  : (budget?.internalBudget ?? props.totalAllocated)
              }
              projectedGrossProfit={
                final
                  ? Number(final.realizedMarginAmount)
                  : (budget?.projectedMarginAmount ?? props.projectedGrossProfit)
              }
              projectedGrossMargin={
                final
                  ? Number(final.realizedMarginPercentage)
                  : (budget?.projectedMarginPercentage ?? props.projectedGrossMargin)
              }
              totalRemaining={
                final
                  ? Number(final.remainingBudget)
                  : (budget?.remainingBudget ?? props.totalRemaining)
              }
              targetGrossPercentage={
                final ? Number(final.targetGrossPercentage) : budget?.targetGrossPercentage
              }
              finalSnapshotAt={final?.snapshotAt}
            />
            {final && !sourceReady ? (
              <PageState
                compact
                kind={source.status === "missing" ? "first-use" : "error"}
                title="Budget saat ini belum tersedia"
                description={
                  source.message ??
                  "Ringkasan akhir tetap memakai data tersimpan saat penutupan. Data budget saat ini belum tersedia."
                }
                actionLabel={source.status === "unavailable" ? "Coba lagi" : undefined}
                onAction={source.status === "unavailable" ? () => router.refresh() : undefined}
              />
            ) : null}
            {projectStatus === "COMPLETED" && !final ? (
              <PageState
                compact
                kind={
                  marginData?.finalSnapshotSource.status === "unavailable" ? "error" : "partial"
                }
                title="Ringkasan akhir belum tersedia"
                description={
                  marginData?.finalSnapshotSource.message ??
                  "Angka di atas mengikuti budget saat ini, bukan ringkasan tersimpan saat penutupan."
                }
              />
            ) : null}
          </>
        )}
      </div>
      <div className="min-w-0">
        {desktop ? (
          <ProjectMarginDesktopCash marginData={marginData} onRetry={() => router.refresh()} />
        ) : marginData?.cashSource.status === "ready" && marginData.cash ? (
          <CashRealizationSection
            totalReceived={marginData.cash.received}
            totalPaid={marginData.cash.paid}
            cashPosition={marginData.cash.position}
          />
        ) : (
          <PageState
            compact
            kind={marginData?.cashSource.status === "restricted" ? "restricted" : "error"}
            title="Realisasi kas belum tersedia"
            description={marginData?.cashSource.message ?? "Seluruh sumber kas belum dapat dibaca."}
          />
        )}
      </div>
      <ProjectClosingSection
        projectStatus={projectStatus}
        closingChecklist={closingChecklist}
        closingMessage={closingMessage}
        closingNote={closingNote}
        setClosingNote={setClosingNote}
        closingPending={closingPending}
        loadClosingChecklist={loadClosingChecklist}
        handleCompleteProject={() => {
          if (canReview) setConfirmation("complete");
        }}
        desktop={desktop}
        canManage={canClose}
        sourceReady={sourceReady}
        canReview={canReview}
        closingAction={closingAction}
        checkedAt={checkedAt}
        onDismiss={dismissInspection}
      />
      <ConfirmationDialog
        open={confirmation !== null}
        title={confirmation === "discard" ? "Buang catatan penutupan?" : "Selesaikan proyek?"}
        description={
          confirmation === "discard"
            ? "Catatan yang belum disimpan akan dibuang. Anda dapat memeriksa kesiapan lagi."
            : "Server akan memeriksa ulang seluruh syarat, menutup proyek, dan menyimpan ringkasan margin akhir. Pastikan catatan final sudah benar."
        }
        confirmLabel={confirmation === "discard" ? "Buang catatan" : "Selesaikan proyek"}
        tone="warning"
        pending={closingPending}
        disabled={confirmation === "complete" && !canReview}
        onClose={() => {
          if (!requestPending.current) setConfirmation(null);
        }}
        onConfirm={confirmation === "discard" ? clearInspection : handleCompleteProject}
      >
        {confirmation === "complete" && closingChecklist ? (
          <div className="space-y-3">
            <FactRow
              inset={false}
              label="Biaya terpakai"
              value={
                <MoneyValue
                  amount={closingChecklist.actualCost}
                  variant="fullDynamic"
                  size="sm"
                  fractionDigits={2}
                />
              }
            />
            <FactRow
              inset={false}
              label="Margin dari biaya tercatat"
              value={
                <MoneyValue
                  amount={closingChecklist.realizedMargin}
                  variant="fullDynamic"
                  size="sm"
                  fractionDigits={2}
                />
              }
            />
            <p className="text-support wrap-anywhere whitespace-pre-wrap">{closingNote.trim()}</p>
          </div>
        ) : null}
      </ConfirmationDialog>
    </div>
  );
}
