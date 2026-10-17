"use client";

import React from "react";

import { AppIcon, IconButton } from "@/components/ui";
import {
  getQuickStartProgress,
  QUICK_START_WORK_STEP_IDS,
  type QuickStartStepId,
} from "@atria/core/onboarding/organization-setup";

const STEP_COPY: Record<
  QuickStartStepId,
  { readonly title: string; readonly description: string }
> = {
  welcome: {
    title: "Kendalikan project pertama dalam 10–15 menit",
    description:
      "Review default finansial, buat project nyata, lalu lihat budget kategori dan margin awalnya.",
  },
  financial_defaults: {
    title: "Pastikan angka dasar project",
    description:
      "Default ini menjadi titik awal project baru dan tidak mengubah project yang sudah berjalan.",
  },
  first_project: {
    title: "Buat project pertama",
    description:
      "Isi identitas dan nilai project. Paduna Build menyiapkan Draft budget kategori tanpa memindahkan kas.",
  },
  success: {
    title: "Project pertama siap direncanakan",
    description: "Budget awal sudah terbentuk. Fondasi operasional lain dapat dilengkapi bertahap.",
  },
};

export function QuickStartHeader({
  step,
  busy,
  onExit,
}: {
  readonly step: QuickStartStepId;
  readonly busy: boolean;
  readonly onExit: () => void;
}): React.JSX.Element {
  const progress = getQuickStartProgress(step);
  const copy = STEP_COPY[step];

  return (
    <header className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="h-12 w-12" aria-hidden="true" />
        <div className="min-w-0 text-center">
          <p className="text-support font-bold text-on-surface">Quick start Paduna Build</p>
          <p className="text-meta text-on-surface-variant">{progress.label}</p>
        </div>
        <div className="flex justify-end">
          {step !== "success" ? (
            <IconButton
              label="Jeda dan keluar quick start"
              icon={<AppIcon name="close" className="icon-xl" />}
              size="compact"
              disabled={busy}
              onClick={onExit}
            />
          ) : null}
        </div>
      </div>

      <div
        className="flex gap-2"
        role="progressbar"
        aria-label="Tahap quick start"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.current}
        aria-valuetext={`${progress.current} dari ${progress.total} tahap quick start`}
      >
        {QUICK_START_WORK_STEP_IDS.map((item, index) => {
          const itemNumber = index + 1;
          const active = item === step;
          const complete = progress.current > itemNumber || step === "success";
          return (
            <span
              key={item}
              aria-hidden="true"
              className={`h-2.5 flex-1 rounded-full ${
                complete ? "bg-primary" : active ? "bg-accent" : "bg-surface-container-high"
              }`}
            />
          );
        })}
      </div>

      <div className="px-1">
        <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-on-surface">
          {copy.title}
        </h1>
        <p className="mt-2 text-support text-on-surface-variant">{copy.description}</p>
      </div>
    </header>
  );
}
