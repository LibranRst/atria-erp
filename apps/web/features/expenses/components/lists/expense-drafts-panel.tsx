"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
  discardExpenseDraft,
  type ExpenseDraftSummary,
} from "@/app/actions/finance/expense-drafts";
import {
  AppIcon,
  Button,
  ConfirmationDialog,
  FormDisclosure,
  GroupedSurface,
  InlineStateRow,
  MoneyValue,
} from "@/components/ui";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { transitionSpringSnappy, transitionSpringSmooth } from "@/lib/utils/motion";
import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import {
  ExpenseDraftsReadContext,
  ExpenseDraftsReadProvider,
} from "./expense-drafts-read-provider";
function savedTimeLabel(value: Date): string {
  const date = new Date(value);
  const differenceMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (differenceMinutes < 1) return "baru saja";
  if (differenceMinutes < 60) return `${differenceMinutes} menit lalu`;
  const hours = Math.round(differenceMinutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

type ExpenseDraftsPanelProps = {
  readonly projectId?: string;
  readonly onWorkflowActiveChange?: (active: boolean) => void;
};

export function ExpenseDraftsPanel(props: ExpenseDraftsPanelProps): React.JSX.Element {
  const source = React.useContext(ExpenseDraftsReadContext);
  if (!source)
    return (
      <ExpenseDraftsReadProvider generation="standalone" projectId={props.projectId}>
        <ExpenseDraftsPanel {...props} />
      </ExpenseDraftsReadProvider>
    );
  return <ExpenseDraftsPanelContent key={source.scopeKey} {...props} source={source} />;
}

function ExpenseDraftsPanelContent({
  projectId,
  onWorkflowActiveChange,
  source,
}: ExpenseDraftsPanelProps & {
  readonly source: NonNullable<React.ContextType<typeof ExpenseDraftsReadContext>>;
}): React.JSX.Element | null {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const drafts = source.data ?? [];
  const activate = source.activate;
  React.useEffect(() => activate(), [activate]);
  const [discardTarget, setDiscardTarget] = React.useState<ExpenseDraftSummary | null>(null);
  const [pending, setPending] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const loading = source.loading || (source.data === null && source.error === null);
  const loadError = source.error;
  const workflowActive = pending || Boolean(discardTarget);
  React.useEffect((): void => {
    onWorkflowActiveChange?.(workflowActive);
  }, [onWorkflowActiveChange, workflowActive]);
  React.useEffect(
    () => (): void => {
      onWorkflowActiveChange?.(false);
    },
    [onWorkflowActiveChange],
  );

  const loadDrafts = source.reload;

  const visibleDrafts = projectId
    ? drafts.filter((draft) => draft.projectId === projectId)
    : drafts;
  if (visibleDrafts.length === 0 && (!desktop || (!loading && !loadError))) return null;

  function resumeDraft(draft: ExpenseDraftSummary): void {
    updateUrlSearchParam("expense-draft", draft.id, "replace");
    updateUrlSearchParam("new-expense", "true", "push");
  }

  async function confirmDiscard(): Promise<void> {
    if (!discardTarget) return;
    setPending(true);
    try {
      const response = await discardExpenseDraft({ draftId: discardTarget.id });
      if (!response.success) {
        toast.error(response.error.message);
        return;
      }
      window.dispatchEvent(new Event("atria:expense-drafts-changed"));
      setDiscardTarget(null);
      toast.success("Draft dibuang.");
    } catch {
      toast.error("Draft belum dibuang. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {desktop ? (
        <div className="space-y-2">
          {loadError ? (
            <GroupedSurface variant="desktopPanel">
              <InlineStateRow
                icon="warning"
                title="Draft belum dapat dimuat"
                description={loadError}
                tone="warning"
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => void loadDrafts()}
                  >
                    Coba lagi
                  </Button>
                }
              />
            </GroupedSurface>
          ) : null}
          {loading && visibleDrafts.length === 0 ? (
            <GroupedSurface variant="desktopPanel" className="p-3">
              <div
                role="status"
                aria-label="Memuat draft pengeluaran"
                className="flex items-center gap-3"
              >
                <div
                  aria-hidden="true"
                  className="h-8 w-8 shrink-0 rounded-full bg-surface-container"
                />
                <div aria-hidden="true" className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-40 max-w-full rounded-full bg-surface-container" />
                  <div className="h-3 w-64 max-w-full rounded-full bg-surface-container-low" />
                </div>
                <span className="sr-only">Daftar draft pengeluaran sedang disiapkan.</span>
              </div>
            </GroupedSurface>
          ) : null}
          {visibleDrafts.length > 0 ? (
            <GroupedSurface variant="desktopPanel" className="px-3">
              <FormDisclosure
                variant="plain"
                title={`${visibleDrafts.length} draft siap dilanjutkan`}
                description={
                  loading
                    ? "Memperbarui daftar draft…"
                    : `Terakhir: ${visibleDrafts[0]?.projectName} · ${savedTimeLabel(visibleDrafts[0]?.lastSavedAt ?? new Date())}`
                }
                icon={<AppIcon name="edit_note" className="icon-sm" />}
                expanded={expanded}
                onToggle={() => setExpanded((current) => !current)}
              >
                <div className="divide-y divide-ring-subtle pb-2">
                  {visibleDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="flex flex-wrap items-center gap-3 py-3 first:pt-0"
                    >
                      <div className="min-w-0 flex-1 basis-52">
                        <p className="text-row font-semibold">{draft.projectName}</p>
                        <p className="mt-1 text-support text-on-surface-variant">
                          {draft.itemCount} item · {savedTimeLabel(draft.lastSavedAt)}
                        </p>
                      </div>
                      <MoneyValue
                        amount={draft.totalAmount}
                        variant="compact"
                        size="sm"
                        fractionDigits={Number.isInteger(draft.totalAmount) ? 0 : 2}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        onClick={() => resumeDraft(draft)}
                      >
                        Lanjutkan
                      </Button>
                      <Button
                        type="button"
                        variant="criticalQuiet"
                        size="compact"
                        aria-label={`Buang draft ${draft.projectName}`}
                        onClick={() => setDiscardTarget(draft)}
                      >
                        <AppIcon name="delete" className="icon-sm" />
                      </Button>
                    </div>
                  ))}
                </div>
              </FormDisclosure>
            </GroupedSurface>
          ) : null}
        </div>
      ) : (
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
              <span className="block truncate text-meta leading-[1.2] text-on-surface-variant">
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
                      className="flex min-h-14 items-center gap-2 rounded-inset bg-surface-container-low/65 px-2 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => resumeDraft(draft)}
                        className="min-w-0 flex-1 rounded-2xl px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="block truncate text-xs font-bold text-on-surface">
                          {draft.projectName}
                        </span>
                        <span className="mt-0.5 block truncate text-support text-on-surface-variant">
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
                        <AppIcon name="delete" className="icon-md" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </GroupedSurface>
      )}

      <ConfirmationDialog
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
