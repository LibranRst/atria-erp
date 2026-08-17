import type { ExpenseDraftSummary } from "@/app/actions/finance/expense-drafts";
import { AppIcon, FormSection } from "@/components/ui";
interface ExpenseActiveDraftsProps {
  readonly drafts: readonly ExpenseDraftSummary[];
  readonly onLoad: (id: string) => void;
  readonly onDiscard: (id: string) => void;
}

export function ExpenseActiveDrafts({
  drafts,
  onLoad,
  onDiscard,
}: ExpenseActiveDraftsProps): React.JSX.Element {
  return (
    <FormSection
      title="Draft aktif"
      helper="Lanjutkan pengeluaran yang pernah disimpan."
      presentation="plain"
    >
      <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
        {drafts.slice(0, 5).map((item) => (
          <div key={item.id} className="flex min-h-18 min-w-0 items-center gap-1 px-2 py-1.5">
            <button
              type="button"
              onClick={() => onLoad(item.id)}
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[18px] px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-low"
              aria-label={`Lanjutkan draft ${item.projectName}`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant"
                aria-hidden="true"
              >
                <AppIcon name="edit_note" className="icon-md leading-none" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-xs leading-[1.15] font-bold text-on-surface">
                  {item.projectName}
                </span>
                <span className="truncate text-[10px] leading-[1.2] text-on-surface-variant">
                  {item.itemCount} item · Rp {Number(item.totalAmount || 0).toLocaleString("id-ID")}
                </span>
                <span className="text-[9px] leading-[1.2] text-on-surface-variant/75">
                  Disimpan{" "}
                  {new Date(item.lastSavedAt).toLocaleString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <AppIcon
                name="chevron_right"
                className="icon-md shrink-0 leading-none text-on-surface-variant"
              />
            </button>
            <button
              type="button"
              onClick={() => onDiscard(item.id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-error transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-error-container/20"
              aria-label={`Buang draft ${item.projectName}`}
            >
              <AppIcon name="delete" className="icon-md leading-none" />
            </button>
          </div>
        ))}
      </div>
    </FormSection>
  );
}
