"use client";

import React, { useState } from "react";

interface DashboardTabsProps {
  readonly budgetSection: React.ReactNode;
  readonly financeSection: React.ReactNode;
  readonly activitySection: React.ReactNode;
}

export function DashboardTabs({
  budgetSection,
  financeSection,
  activitySection,
}: DashboardTabsProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<"BUDGET" | "FINANCE" | "ACTIVITY">("BUDGET");

  return (
    <div className="space-y-lg select-none">
      {/* Segmented Control Switcher */}
      <div className="flex w-full bg-surface-container-low border border-outline-variant/10 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setActiveTab("BUDGET")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "BUDGET"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Anggaran
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("FINANCE")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "FINANCE"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Stok & Kas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ACTIVITY")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "ACTIVITY"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Aktivitas
        </button>
      </div>

      {/* Tab Contents */}
      <div className="transition-all duration-200">
        {activeTab === "BUDGET" && budgetSection}
        {activeTab === "FINANCE" && financeSection}
        {activeTab === "ACTIVITY" && activitySection}
      </div>
    </div>
  );
}
