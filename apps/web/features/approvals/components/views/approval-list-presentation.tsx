"use client";

import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import { motion, useReducedMotion } from "framer-motion";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import {
  AppIcon,
  Button,
  DetailSheet,
  DuotoneIconTile,
  FactRow,
  GroupedSurface,
  MoneyImpactRow,
  MoneyValue,
  SheetFooterActions,
  StatusBadge,
  useSheetPresenceValue,
} from "@/components/ui";
import { approvalIsCritical } from "@/features/approvals/utils/approval-list-utils";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/shared/inventory-opening-approval-items";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@atria/core/finance/budget-indicator";
import { formatShortDate } from "@atria/core/utils/date";
import { formatIdr } from "@atria/core/utils/money";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";

export type ApprovalItem = ApprovalDetail;

export interface ApprovalDecision {
  readonly item: ApprovalItem;
  readonly status: "APPROVED" | "REJECTED";
}
/**
 * Cleans system-generated raw prefixes like `[Kategori: Tukang] ` from user-facing notes.
 */
export function cleanApprovalNotes(notes: string): string {
  return notes.replace(/^\[Kategori:\s*[^\]]+\]\s*/i, "").trim();
}

import { cn } from "@/lib/utils/cn";

const rowPressScale = { scale: buttonTapActiveScale } as const;

/**
 * What's being decided, restated at the commit step (approve/reject) so the
 * last checkpoint before an audit-logged action doesn't say less than the
 * screen the user just left.
 */
export function ApprovalDecisionSubject({
  item,
  className = "",
}: {
  readonly item: ApprovalItem;
  readonly className?: string;
}): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  return (
    <div className={cn("flex items-center justify-between gap-3 text-left", className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-support font-semibold text-on-surface">{item.description}</p>
        <p className="mt-0.5 truncate text-eyebrow font-semibold text-on-surface-variant/70">
          {item.projectName}
        </p>
      </div>
      <MoneyValue
        amount={item.amount}
        fractionDigits={Number.isInteger(item.amount) ? 0 : 2}
        variant={desktop ? "fullDynamic" : "compact"}
        size="sm"
        align="right"
        className="shrink-0"
      />
    </div>
  );
}

export function ApprovalQueueRow({
  item,
  pending,
  onSelect,
}: {
  readonly item: ApprovalItem;
  readonly pending: boolean;
  readonly onSelect: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const critical = approvalIsCritical(item);
  const warning = !critical && item.priority === "WARNING";
  const iconTone = critical ? "critical" : warning ? "attention" : "neutral";
  const reasonClass = critical
    ? "text-error"
    : warning
      ? "text-warning"
      : "text-on-surface-variant";
  const priorityLabel =
    item.priority === "NORMAL" && critical ? "Mencapai batas budget" : item.priorityReason;

  return (
    <div className="px-2.5 py-1.5">
      <motion.button
        type="button"
        onClick={onSelect}
        disabled={pending}
        whileTap={reduceMotion ? undefined : rowPressScale}
        transition={transitionSpringSnappy}
        className="min-h-12 w-full rounded-inset px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <DuotoneIconTile
            name={
              item.type === "project_cost"
                ? "receipt_long"
                : item.type === "inventory_opening"
                  ? "inventory"
                  : "request_quote"
            }
            tone={iconTone}
            className="h-9 w-9"
            iconClassName="icon-md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <MoneyValue
                amount={item.amount}
                variant="fullDynamic"
                size="lg"
                className="min-w-0"
              />
              <span
                className={`max-w-[42%] shrink-0 text-right text-eyebrow font-semibold ${reasonClass}`}
              >
                {priorityLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-support font-semibold text-on-surface">
              {item.description}
            </p>
            <p className="mt-0.5 truncate text-meta text-on-surface-variant/75">
              {item.projectName}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="icon-sm" />
          </span>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-eyebrow font-semibold text-on-surface-variant/70">
          <span className="max-w-full truncate">{item.requestedBy}</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant/60" aria-hidden="true" />
          <span className="max-w-full truncate">{item.budgetItemName}</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant/60" aria-hidden="true" />
          <span className="shrink-0">{formatQueueTime(item.createdAt)}</span>
        </div>
      </motion.button>
    </div>
  );
}

export function ApprovalDetailSheet({
  item,
  pending,
  canDecide = true,
  onClose,
  onOpenReceipt,
  onDecision,
}: {
  readonly item: ApprovalItem | null;
  readonly pending: boolean;
  readonly canDecide?: boolean;
  readonly onClose: () => void;
  readonly onOpenReceipt: (url: string) => void;
  readonly onDecision: (item: ApprovalItem, status: ApprovalDecision["status"]) => void;
}): React.JSX.Element {
  const {
    presentedValue: presentedItem,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(item, item?.id);

  return (
    <DetailSheet
      open={open}
      title="Detail persetujuan"
      onClose={onClose}
      onExitComplete={handleExitComplete}
      footer={
        presentedItem ? (
          <SheetFooterActions
            secondary={{
              label: "Tolak",
              disabled: pending || !canDecide,
              variant: "criticalQuiet",
              onClick: () => onDecision(presentedItem, "REJECTED"),
            }}
            primary={{
              label: "Setujui",
              disabled: pending || !canDecide,
              variant: "primary",
              onClick: () => onDecision(presentedItem, "APPROVED"),
            }}
          />
        ) : undefined
      }
    >
      {presentedItem ? (
        <ApprovalDetailContent item={presentedItem} onOpenReceipt={onOpenReceipt} />
      ) : null}
    </DetailSheet>
  );
}

export function ApprovalDetailContent({
  item,
  onOpenReceipt,
}: {
  readonly item: ApprovalItem;
  readonly onOpenReceipt: (url: string) => void;
}): React.JSX.Element {
  const critical = approvalIsCritical(item);
  const warning = !critical && item.priority === "WARNING";
  const typeLabel =
    item.type === "project_cost"
      ? "Biaya lapangan"
      : item.type === "inventory_opening"
        ? "Saldo awal stok"
        : "Tagihan vendor";
  const statusLabel = critical ? "Risiko tinggi" : warning ? "Perlu perhatian" : "Siap ditinjau";

  return (
    <div className="space-y-4 pb-1">
      <section className="overflow-hidden rounded-owner bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-meta font-bold tracking-[0.12em] text-on-surface-variant/70 uppercase">
              {typeLabel}
            </p>
            <StatusBadge
              tone={critical ? "critical" : warning ? "warning" : "neutral"}
              label={statusLabel}
              className="shrink-0"
            />
          </div>
          <p className="mt-1.5 text-section font-semibold wrap-break-word text-on-surface">
            {item.description}
          </p>
          <p className="mt-0.5 text-support text-on-surface-variant">
            Diajukan {formatShortDate(item.createdAt)}
          </p>
        </div>
        <div className="border-t border-outline-variant/15 px-4 pt-3 pb-3.5">
          <p className="text-eyebrow font-semibold text-on-surface-variant/70">Nilai pengajuan</p>
          <MoneyValue
            amount={item.amount}
            variant="fullDynamic"
            size="hero"
            align="left"
            className="mt-1"
          />
          <p
            className="mt-2 truncate text-support font-semibold text-on-surface-variant"
            title={item.priorityReason}
          >
            {item.priorityReason}
          </p>
        </div>
      </section>
      <section aria-labelledby="approval-context-title" className="space-y-2">
        <h3 id="approval-context-title" className="px-1 text-row font-bold text-on-surface">
          Konteks pengajuan
        </h3>
        <GroupedSurface>
          <div className="divide-y divide-outline-variant/15">
            <FactRow
              label={item.type === "inventory_opening" ? "Ruang kerja" : "Proyek"}
              value={item.projectName}
            />
            <FactRow label="Pengaju" value={item.requestedBy} />
            <FactRow
              label={item.type === "inventory_opening" ? "Cakupan" : "Kategori"}
              value={item.budgetItemName}
            />
            <FactRow
              label="Jatuh tempo"
              value={item.dueDate ? formatShortDate(item.dueDate) : "Tidak ditentukan"}
            />
            {item.notes ? (
              <FactRow
                label="Catatan"
                value={
                  <span className="font-medium whitespace-pre-wrap text-on-surface">
                    {cleanApprovalNotes(item.notes)}
                  </span>
                }
              />
            ) : null}
          </div>
        </GroupedSurface>
      </section>

      <section aria-labelledby="approval-evidence-title" className="space-y-2">
        <h3 id="approval-evidence-title" className="px-1 text-row font-bold text-on-surface">
          Dokumen pendukung
        </h3>
        <ApprovalEvidenceRow item={item} onOpenReceipt={onOpenReceipt} />
      </section>

      {item.type === "inventory_opening" ? <InventoryOpeningApprovalItems item={item} /> : null}

      <ApprovalImpactReview item={item} />
    </div>
  );
}

/**
 * The receipt as its own attached exhibit — a photo chip in the same gray
 * canvas as every other fact, not a bordered row inside a white list.
 */
export function ApprovalEvidenceRow({
  item,
  onOpenReceipt,
  presentation = "mobile",
}: {
  readonly item: ApprovalItem;
  readonly onOpenReceipt: (url: string) => void;
  readonly presentation?: "mobile" | "desktop";
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  if (presentation === "desktop") {
    const receiptUrl = item.receiptImageUrl;
    return (
      <GroupedSurface variant="desktopPanel" className="p-3">
        {receiptUrl ? (
          <Button
            variant="secondary"
            size="compact"
            fullWidth
            onClick={() => onOpenReceipt(receiptUrl)}
          >
            <AppIcon name="image" className="icon-sm" /> Buka bukti pengajuan
          </Button>
        ) : (
          <p className="text-support text-on-surface-variant">Tidak ada bukti terlampir.</p>
        )}
      </GroupedSurface>
    );
  }

  if (!item.receiptImageUrl) {
    return (
      <GroupedSurface>
        <div className="flex items-center gap-3 p-3.5 text-on-surface-variant">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-icon bg-surface-container-low text-on-surface-variant">
            <AppIcon name="image" className="icon-md" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow font-semibold text-on-surface-variant/70">
              Bukti tidak terlampir
            </p>
            <p className="mt-0.5 text-support font-semibold text-on-surface">
              Tidak ada bukti terlampir
            </p>
          </div>
        </div>
      </GroupedSurface>
    );
  }
  const receiptUrl = item.receiptImageUrl;
  return (
    <GroupedSurface className="p-3">
      <motion.button
        type="button"
        onClick={() => onOpenReceipt(receiptUrl)}
        whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
        transition={transitionSpringSnappy}
        className="group relative block h-48 w-full overflow-hidden rounded-inset bg-surface-container text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={receiptUrl}
          alt="Bukti pengajuan"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-eyebrow font-bold text-white shadow-sm backdrop-blur-sm">
            Pratinjau bukti
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm transition-transform group-hover:scale-105">
            <AppIcon name="north_east" className="icon-sm" />
          </span>
        </span>
      </motion.button>
    </GroupedSurface>
  );
}

function ApprovalContextRow({
  icon,
  label,
  value,
  multiline = false,
  surface = "card",
}: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly multiline?: boolean;
  readonly surface?: "card" | "row";
}): React.JSX.Element {
  return (
    <div
      className={`flex items-center gap-3 ${surface === "card" ? "rounded-inset bg-white p-3.5" : "px-3.5 py-3"}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-icon bg-surface-container-low text-on-surface-variant">
        <AppIcon name={icon} className="icon-md" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-eyebrow font-semibold text-on-surface-variant/60">{label}</p>
        <p
          className={`mt-0.5 text-support font-semibold text-on-surface ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function ApprovalImpactReview({ item }: { readonly item: ApprovalItem }): React.JSX.Element {
  if (item.type === "inventory_opening") {
    return (
      <section aria-labelledby="approval-impact-title">
        <h3 id="approval-impact-title" className="mb-2 px-1 text-row font-bold text-on-surface">
          Dampak setelah disetujui
        </h3>
        <GroupedSurface>
          <div className="divide-y divide-outline-variant/15">
            <ApprovalContextRow
              icon="add_box"
              label="Inventory"
              value={`Menambah ${item.budgetItemName} sesuai jumlah fisik`}
              multiline
              surface="row"
            />
            <ApprovalContextRow
              icon="account_balance_wallet"
              label="Kas & proyek"
              value="Tidak membuat kas keluar, utang vendor, atau actual cost proyek"
              multiline
              surface="row"
            />
            <ApprovalContextRow
              icon="history"
              label="Audit"
              value="Mencatat pergerakan saldo awal stok dan riwayat audit"
              multiline
              surface="row"
            />
          </div>
        </GroupedSurface>
      </section>
    );
  }
  // Pembelian persediaan tidak menaikkan realisasi kategori, jadi dampaknya
  // dihitung dengan permintaan bernilai nol: angka "sesudah" harus sama dengan
  // angka sekarang, bukan proyeksi kenaikan yang tidak akan terjadi.
  const consumesActual = item.consumesBudgetActual;
  const impact = getApprovalBudgetImpact(
    item.allocatedAmount,
    item.actualSpent,
    consumesActual ? item.amount : 0,
  );
  const nextSpent = consumesActual ? item.actualSpent + item.amount : item.actualSpent;
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const badgeTone = critical ? "critical" : warning ? "warning" : "neutral";
  const impactLabel = !consumesActual
    ? "Menjadi nilai persediaan, bukan realisasi"
    : critical
      ? impact.overflowPercentage > 0
        ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
        : "Mencapai batas budget"
      : warning
        ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
        : "Tetap dalam batas budget";
  return (
    <section aria-labelledby="approval-impact-title" className="space-y-2">
      <h3 id="approval-impact-title" className="px-1 text-row font-bold text-on-surface">
        Dampak ke budget
      </h3>

      <MoneyImpactRow
        label={`Kategori · ${item.budgetItemName}`}
        sublabel={
          item.allocatedAmount > 0
            ? `Plafon alokasi ${formatIdr(item.allocatedAmount)}`
            : "Tanpa plafon alokasi"
        }
        before={item.actualSpent}
        delta={consumesActual ? item.amount : 0}
        after={nextSpent}
        note={
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {!consumesActual
                ? "Menjadi nilai persediaan, bukan realisasi"
                : `${impact.beforePercentage.toFixed(0)}% terpakai → ${impact.afterPercentage.toFixed(0)}% terpakai`}
            </span>
            <StatusBadge tone={badgeTone} label={impactLabel} className="shrink-0" />
          </div>
        }
      />
    </section>
  );
}

function formatQueueTime(value: Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
