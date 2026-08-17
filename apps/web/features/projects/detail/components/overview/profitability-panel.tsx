"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { LockedTabState } from "../shared/project-tab-states";
import { CashRealizationSection, ProfitProjectionSection } from "./profitability-summary-sections";
import { ProjectClosingSection } from "./project-closing-section";
import {
  completeProject,
  getProjectClosingChecklist,
  type ProjectClosingChecklist,
} from "@/app/actions/project/closing";
import type { TabId } from "../shared/project-tabs";

interface ProfitabilityPanelProps {
  readonly projectId: string;
  readonly projectStatus: string;
  readonly userRole: string;
  readonly contractValue: number;
  readonly totalAllocated: number;
  readonly projectedGrossProfit: number;
  readonly projectedGrossMargin: number;
  readonly totalRemaining: number;
  readonly totalReceived: number;
  readonly totalSpent: number;
  readonly cashPosition: number;
  readonly isLocked: boolean;
  readonly nextSetupTab: TabId;
  readonly nextSetupLabel: string;
  readonly nextSetupIcon: string;
  readonly setActiveTab: (tab: TabId) => void;
}

export function ProfitabilityPanel({
  projectId,
  projectStatus,
  userRole,
  contractValue,
  totalAllocated,
  projectedGrossProfit,
  projectedGrossMargin,
  totalRemaining,
  totalReceived,
  totalSpent,
  cashPosition,
  isLocked,
  nextSetupTab,
  nextSetupLabel,
  nextSetupIcon,
  setActiveTab,
}: ProfitabilityPanelProps): React.JSX.Element {
  const [closingChecklist, setClosingChecklist] = useState<ProjectClosingChecklist | null>(null);
  const [closingMessage, setClosingMessage] = useState<string | null>(null);
  const [closingNote, setClosingNote] = useState("");
  const [closingPending, startClosingTransition] = useTransition();

  if (isLocked) {
    return (
      <LockedTabState
        tabLabel="Margin"
        actionLabel={nextSetupLabel}
        actionIcon={nextSetupIcon}
        onAction={() => setActiveTab(nextSetupTab)}
      />
    );
  }

  function loadClosingChecklist(): void {
    startClosingTransition(async () => {
      const result = await getProjectClosingChecklist(projectId);
      if (!result.success) {
        setClosingMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setClosingChecklist(result.data);
      setClosingMessage(null);
      toast.success(
        result.data.blockers.length > 0
          ? "Checklist closing selesai diperiksa."
          : "Project siap untuk proses closing.",
      );
    });
  }

  function handleCompleteProject(): void {
    startClosingTransition(async () => {
      const result = await completeProject({
        projectId,
        closingNote: closingNote.trim(),
      });
      if (!result.success) {
        setClosingMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setClosingChecklist(result.data);
      const message = "Proyek selesai dan ringkasan profitabilitas akhir berhasil disimpan.";
      setClosingMessage(message);
      toast.success(message);
      window.location.reload();
    });
  }

  return (
    <div className="space-y-sm">
      <ProfitProjectionSection
        contractValue={contractValue}
        totalAllocated={totalAllocated}
        projectedGrossProfit={projectedGrossProfit}
        projectedGrossMargin={projectedGrossMargin}
        totalRemaining={totalRemaining}
      />

      <CashRealizationSection
        totalReceived={totalReceived}
        totalSpent={totalSpent}
        cashPosition={cashPosition}
      />

      {(userRole === "OWNER" || userRole === "FINANCE_ADMIN") && (
        <ProjectClosingSection
          projectStatus={projectStatus}
          closingChecklist={closingChecklist}
          closingMessage={closingMessage}
          closingNote={closingNote}
          setClosingNote={setClosingNote}
          closingPending={closingPending}
          loadClosingChecklist={loadClosingChecklist}
          handleCompleteProject={handleCompleteProject}
        />
      )}
    </div>
  );
}
