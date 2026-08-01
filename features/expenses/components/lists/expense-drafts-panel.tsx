"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
  discardExpenseDraft,
  listExpenseDrafts,
  type ExpenseDraftSummary,
} from "@/app/actions/finance/expense-drafts";
import { AppIcon, ConfirmationSheet, GroupedSurface } from "@/components/ui";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { transitionSpringSnappy, transitionSpringSmooth } from "@/lib/utils/motion";
function savedTimeLabel(value: Date): string {
  const date = new Date(value);
  const differenceMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (differenceMinutes < 1) return "baru saja";
  if (differenceMinutes < 60) return `${differenceMinutes} menit lalu`;
  const hours = Math.round(differenceMinutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function ExpenseDraftsPanel({
  projectId,
}: {
  readonly projectId?: string;
}): React.JSX.Element | null {
  const [drafts, setDrafts] = React.useState<readonly ExpenseDraftSummary[]>([]);
  const [discardTarget, setDiscardTarget] = React.useState<ExpenseDraftSummary | null>(null);
  const [pending, setPending] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const loadDrafts = React.useCallback(async (): Promise<void> => {
    const response = await listExpenseDrafts();
    if (!response.success) return;
    setDrafts(response.data);
  }, []);

  React.useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDrafts(), 0);
    function reload(): void {
      void loadDrafts();
    }
    window.addEventListener("atria:expense-drafts-changed", reload);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("atria:expense-drafts-changed", reload);
    };
  }, [loadDrafts]);

  const visibleDrafts = projectId
    ? drafts.filter((draft) => draft.projectId === projectId)
    : drafts;
  if (visibleDrafts.length === 0) return null;

  async function confirmDiscard(): Promise<void> {
    if (!discardTarget) return;
    setPending(true);
    const response = await discardExpenseDraft({ draftId: discardTarget.id });
    setPending(false);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    setDrafts((current) => current.filter((draft) => draft.id !== discardTarget.id));
    setDiscardTarget(null);
    toast.success("Draft dibuang.");
  }

  return (
    <>
      <GroupedSurface as="section">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-expanded={expanded}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/9 text-primary ring-1 ring-primary/6">
            <AppIcon name="edit_note" className="icon-md" />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="block text-xs leading-[1.15] font-bold text-on-surface">
              {visibleDrafts.length} draft siap dilanjutkan
            </span>
            <span className="block truncate text-[10px] leading-[1.2] text-on-surface-variant">
              Terakhir: {visibleDrafts[0]?.projectName} ·{" "}
              {savedTimeLabel(visibleDrafts[0]?.lastSavedAt ?? new Date())}
            </span>
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={transitionSpringSnappy}
            className="text-on-surface-variant"
          >
            <AppIcon name="expand_more" className="h-5 w-5" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transitionSpringSmooth}
              className="overflow-hidden border-t border-outline-variant/12"
            >
              <div className="space-y-1 p-2">
                {visibleDrafts.map((draft) => (
                  <motion.div
                    layout
                    key={draft.id}
                    transition={transitionSpringSnappy}
                    className="flex min-h-14 items-center gap-2 rounded-[20px] bg-surface-container-low/65 px-2 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        updateUrlSearchParam("expense-draft", draft.id, "replace");
                        updateUrlSearchParam("new-expense", "true", "push");
                      }}
                      className="min-w-0 flex-1 rounded-2xl px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <span className="block truncate text-xs font-bold text-on-surface">
                        {draft.projectName}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-on-surface-variant">
                        {draft.itemCount} item · Rp {draft.totalAmount.toLocaleString("id-ID")} ·{" "}
                        {savedTimeLabel(draft.lastSavedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscardTarget(draft)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      aria-label={`Buang draft ${draft.projectName}`}
                    >
                      <AppIcon name="delete" className="text-[19px]" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </GroupedSurface>

      <ConfirmationSheet
        open={discardTarget !== null}
        title="Buang Draft?"
        description={`Draft ${discardTarget?.projectName ?? "pengeluaran"} dan attachment yang belum diajukan akan dihapus.`}
        confirmLabel="Buang Draft"
        danger
        pending={pending}
        onClose={() => setDiscardTarget(null)}
        onConfirm={() => void confirmDiscard()}
      />
    </>
  );
}
