import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import type {
  ProjectMarginData,
  ProjectMarginFinalSnapshot,
} from "@atria/core/types/project-margin";
import type { ProjectOperationSource } from "@atria/core/types/project-operations";

export type MarginBudgetCategory = ProjectBudgetDashboard["categories"][number];

export function marginSource(
  data: ProjectMarginData | undefined,
  budget: ProjectBudgetDashboard | null | undefined,
): ProjectOperationSource {
  const source = data?.source ?? {
    status: "unavailable",
    message: "Sumber margin belum dapat dipastikan. Muat ulang untuk mencoba lagi.",
  };
  return source.status === "ready" && !budget
    ? { status: "unavailable", message: "Rincian budget belum dapat dimuat. Coba lagi." }
    : source;
}

/** A stored FINAL remains authoritative independently of today's budget read. */
export function marginFinalSnapshot(
  projectStatus: string,
  data: ProjectMarginData | undefined,
): ProjectMarginFinalSnapshot | null {
  return projectStatus === "COMPLETED" &&
    data?.source.status !== "restricted" &&
    data?.finalSnapshotSource.status === "ready"
    ? data.finalSnapshot
    : null;
}

export function marginVerdict(
  marginAmount: number,
  marginPercentage: number,
  targetPercentage: number,
): { readonly label: string; readonly tone: "critical" | "warning" | "healthy" } {
  if (marginAmount < 0) return { label: "Proyeksi rugi", tone: "critical" };
  if (marginPercentage < targetPercentage) return { label: "Di bawah target", tone: "warning" };
  return { label: "Sesuai target", tone: "healthy" };
}

/** Category detail only follows an explicit selection, at every viewport width. */
export function marginCategoryContext(
  categories: readonly MarginBudgetCategory[],
  selectedId: string | null,
): MarginBudgetCategory | null {
  return categories.find((category) => category.id === selectedId) ?? null;
}

export function canReviewProjectClosing(input: {
  readonly projectStatus: string;
  readonly sourceReady: boolean;
  readonly checklist: {
    readonly canComplete: boolean;
    readonly blockers: readonly string[];
  } | null;
  readonly permitted: boolean;
  readonly note: string;
  readonly pending: boolean;
}): boolean {
  return (
    input.permitted &&
    input.sourceReady &&
    input.projectStatus === "ACTIVE" &&
    input.checklist?.canComplete === true &&
    input.checklist.blockers.length === 0 &&
    input.note.trim().length >= 10 &&
    !input.pending
  );
}
