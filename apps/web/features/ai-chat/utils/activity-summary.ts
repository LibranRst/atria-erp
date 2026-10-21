import type { ToolActivityKind, ToolTraceState } from "./tool-labels";
export type ActivityState = ToolTraceState | "recovered" | "waiting";
export type ActivityTrace = {
  readonly key: string;
  readonly label: string;
  readonly state: ToolTraceState | "recovered";
  readonly count: number;
  readonly kind?: ToolActivityKind;
  readonly detail?: string;
  readonly waitingForInput?: "project" | "form";
};
export function activitySummary(
  traces: readonly ActivityTrace[],
  active: boolean,
): { label: string; detail: string; state: ActivityState } {
  const running = traces.findLast((trace) => trace.state === "running");
  const count = (state: ActivityTrace["state"], kind?: ToolActivityKind): number =>
    traces
      .filter((trace) => trace.state === state && (!kind || (trace.kind ?? "read") === kind))
      .reduce((sum, trace) => sum + trace.count, 0);
  const details: string[] = [];
  const reads = count("done", "read"),
    proposals = count("done", "proposal"),
    inputs = count("done", "input"),
    failed = count("failed"),
    stopped = count("interrupted"),
    recovered = count("recovered");
  if (reads) details.push(`${reads} sumber diperiksa`);
  if (proposals) details.push(`${proposals} usulan siap`);
  if (inputs) details.push(`${inputs} permintaan isian`);
  if (recovered) details.push(`${recovered} percobaan dipulihkan`);
  if (failed) details.push(`${failed} gagal`);
  if (stopped) details.push(`${stopped} dihentikan`);
  const detail = details.join(" · ");
  if (running || active)
    return { label: running?.label ?? "Menyusun jawaban…", detail, state: "running" };
  if (failed) return { label: "Sebagian pemeriksaan belum selesai", detail, state: "failed" };
  if (stopped) return { label: "Proses dihentikan", detail, state: "interrupted" };
  const waiting = traces.find((trace) => trace.state === "done" && trace.waitingForInput);
  if (waiting)
    return {
      label:
        waiting.waitingForInput === "project"
          ? "Pilih proyek untuk melanjutkan"
          : "Menunggu isian Anda",
      detail,
      state: "waiting",
    };
  return { label: detail || "Langkah selesai", detail: "", state: "done" };
}
export function waitingDuration(seconds: number): string {
  if (seconds < 10) return "";
  return seconds < 60 ? `${seconds} dtk` : `${Math.floor(seconds / 60)} m ${seconds % 60} dtk`;
}
