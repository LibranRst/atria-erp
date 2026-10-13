"use client";
import * as React from "react";
import { FormDisclosure, AppIcon } from "@/components/ui";
import { ActivityMark, ActivityLine } from "./ai-activity";
import { activitySummary, waitingDuration, type ActivityTrace } from "../utils/activity-summary";
export type ToolTrace = ActivityTrace;
export function ToolTraceList({
  traces,
  isActive = false,
  elapsedSeconds = 0,
}: {
  readonly traces: readonly ToolTrace[];
  readonly isActive?: boolean;
  readonly elapsedSeconds?: number;
}): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  if (!traces.length)
    return isActive ? <ActivityLine label="Menyusun jawaban…" seconds={elapsedSeconds} /> : null;
  const summary = activitySummary(traces, isActive);
  const detail = [
    summary.detail,
    summary.state === "running" ? waitingDuration(elapsedSeconds) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <FormDisclosure
      variant="activity"
      title={summary.label}
      description={detail || undefined}
      icon={<ActivityMark state={summary.state} />}
      expanded={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <ul aria-label="Langkah asisten" className="space-y-0.5 pb-1 pl-2.5">
        {traces.map((trace) => (
          <li key={trace.key} className="flex min-h-8 items-start gap-2 py-1">
            <ActivityMark state={trace.state} compact />
            <div className="min-w-0 flex-1 py-0.5 text-support leading-5 text-on-surface-variant">
              <span>
                {trace.label}
                {trace.count > 1 ? ` (${trace.count})` : ""}
              </span>
              {trace.detail && (
                <p className="mt-0.5 text-meta text-on-surface-variant">{trace.detail}</p>
              )}
            </div>
            <span
              className={
                trace.state === "done"
                  ? "sr-only"
                  : trace.state === "failed"
                    ? "shrink-0 py-1 text-meta font-semibold text-critical"
                    : "shrink-0 py-1 text-meta text-on-surface-variant"
              }
            >
              {trace.state === "running"
                ? "Berjalan"
                : trace.state === "done"
                  ? "Selesai"
                  : trace.state === "failed"
                    ? "Gagal"
                    : trace.state === "recovered"
                      ? "Pulih"
                      : "Dihentikan"}
            </span>
          </li>
        ))}
      </ul>
      {(summary.state === "failed" || summary.state === "interrupted") && (
        <p className="flex items-start gap-2 text-meta text-on-surface-variant">
          <AppIcon name="info" className="icon-sm shrink-0" />
          Hasil yang sudah tersedia tetap dapat ditinjau. Kirim pertanyaan lagi untuk melanjutkan
          pemeriksaan yang belum selesai.
        </p>
      )}
    </FormDisclosure>
  );
}
