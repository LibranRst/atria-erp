"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import {
  AppIcon,
  BottomSheet,
  DuotoneIconTile,
  GroupedSurface,
  MoneyValue,
  StatusBadge,
  useSheetPresenceValue,
} from "@/components/ui";
import { approvalIsCritical } from "@/features/approvals/utils/approval-list-utils";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/shared/inventory-opening-approval-items";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@/lib/finance/budget-indicator";
import { formatShortDate } from "@/lib/utils/date";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export type ApprovalItem = ApprovalDetail;

export interface ApprovalDecision {
  readonly item: ApprovalItem;
  readonly status: "APPROVED" | "REJECTED";
}

const rowPressScale = { scale: 0.985 } as const;

/**
 * What's being decided, restated at the commit step (approve/reject) so the
 * last checkpoint before an audit-logged action doesn't say less than the
 * screen the user just left.
 */
export function ApprovalDecisionSubject({
  item,
}: {
  readonly item: ApprovalItem;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-inset bg-surface-container-low px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-support font-semibold text-on-surface">{item.description}</p>
        <p className="mt-0.5 truncate text-eyebrow font-semibold text-on-surface-variant/70">
          {item.projectName}
        </p>
      </div>
      <MoneyValue
        amount={item.amount}
        variant="compact"
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
                variant="compact"
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
  onClose,
  onOpenReceipt,
  onDecision,
}: {
  readonly item: ApprovalItem | null;
  readonly pending: boolean;
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
    <BottomSheet
      open={open}
      title="Detail persetujuan"
      onClose={onClose}
      onExitComplete={handleExitComplete}
      footer={
        presentedItem ? (
          <ApprovalDecisionFooter item={presentedItem} pending={pending} onDecision={onDecision} />
        ) : undefined
      }
    >
      {presentedItem ? (
        <ApprovalDetailContent item={presentedItem} onOpenReceipt={onOpenReceipt} />
      ) : null}
    </BottomSheet>
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
      <section className="overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle">
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-eyebrow font-bold tracking-wide text-on-surface-variant/60 uppercase">
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
          <p className="text-eyebrow font-semibold text-on-surface-variant/60">Nilai pengajuan</p>
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

      <section aria-labelledby="approval-context-title">
        <h3 id="approval-context-title" className="mb-2 px-1 text-row font-bold text-on-surface">
          Konteks pengajuan
        </h3>
        <div className="space-y-2 bg-surface-container-low">
          <ApprovalContextRow
            icon={item.type === "inventory_opening" ? "warehouse" : "folder_open"}
            label={item.type === "inventory_opening" ? "Ruang kerja" : "Project"}
            value={item.projectName}
          />
          <ApprovalRequesterRow name={item.requestedBy} />
          <div className="grid grid-cols-2 gap-2">
            <ApprovalContextTile
              icon={item.type === "inventory_opening" ? "inventory" : "category"}
              label={item.type === "inventory_opening" ? "Cakupan" : "Kategori"}
              value={item.budgetItemName}
            />
            <ApprovalContextTile
              icon="event"
              label="Jatuh tempo"
              value={item.dueDate ? formatShortDate(item.dueDate) : "Tidak ditentukan"}
            />
          </div>
          {item.notes ? (
            <ApprovalContextRow icon="notes" label="Catatan" value={item.notes} multiline />
          ) : null}
          <ApprovalEvidenceRow item={item} onOpenReceipt={onOpenReceipt} />
        </div>
      </section>

      {item.type === "inventory_opening" ? <InventoryOpeningApprovalItems item={item} /> : null}

      <ApprovalImpactReview item={item} />
    </div>
  );
}

function ApprovalRequesterRow({ name }: { readonly name: string }): React.JSX.Element {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex items-center gap-3 rounded-inset bg-white p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-icon bg-primary/7.5 text-support font-bold text-primary">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-eyebrow font-semibold text-on-surface-variant/60">Pengaju</p>
        <p className="mt-0.5 truncate text-support font-semibold text-on-surface">{name}</p>
      </div>
    </div>
  );
}

/** A square bento tile — used in pairs for two related-but-distinct facts. */
function ApprovalContextTile({
  icon,
  label,
  value,
}: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-inset bg-white p-3 text-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-icon bg-surface-container-low text-on-surface-variant">
        <AppIcon name={icon} className="icon-md" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-eyebrow font-semibold text-on-surface-variant/60">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-support font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

/**
 * The receipt as its own attached exhibit — a photo chip in the same gray
 * canvas as every other fact, not a bordered row inside a white list.
 */
function ApprovalEvidenceRow({
  item,
  onOpenReceipt,
}: {
  readonly item: ApprovalItem;
  readonly onOpenReceipt: (url: string) => void;
}): React.JSX.Element {
  if (!item.receiptImageUrl) {
    return (
      <ApprovalContextRow
        icon="image"
        label="Dokumen pendukung"
        value="Tidak ada bukti terlampir"
      />
    );
  }
  const receiptUrl = item.receiptImageUrl;
  return (
    <motion.button
      type="button"
      onClick={() => onOpenReceipt(receiptUrl)}
      whileTap={{ scale: 0.99 }}
      transition={transitionSpringSnappy}
      className="relative block h-44 w-full overflow-hidden rounded-inset bg-surface-container text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={receiptUrl} alt="Bukti pengajuan" className="h-full w-full object-cover" />
      <span className="absolute inset-x-3.5 bottom-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-black/55 px-2.5 py-1 text-eyebrow font-bold text-white">
          Dokumen pendukung
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/55 text-white">
          <AppIcon name="north_east" className="icon-sm" />
        </span>
      </span>
    </motion.button>
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
  const impact = getApprovalBudgetImpact(item.allocatedAmount, item.actualSpent, item.amount);
  const nextSpent = item.actualSpent + item.amount;
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const toneClass = critical
    ? "bg-error-container text-error"
    : warning
      ? "bg-warning-light text-warning-on-container"
      : "bg-primary-light text-primary";
  const impactLabel = critical
    ? impact.overflowPercentage > 0
      ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
      : "Mencapai batas budget"
    : warning
      ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
      : "Tetap dalam batas budget";

  return (
    <section aria-labelledby="approval-impact-title">
      <h3 id="approval-impact-title" className="mb-2 px-1 text-row font-bold text-on-surface">
        Dampak ke budget
      </h3>

      <div className="overflow-hidden rounded-owner bg-white p-3.5 shadow-surface ring-1 ring-ring-subtle">
        <div className={`flex items-center gap-3 rounded-inset px-3.5 py-3 ${toneClass}`}>
          <AppIcon
            name={critical ? "report" : warning ? "warning" : "check_circle"}
            className="icon-xl shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-support font-bold">{impactLabel}</p>
            <p className="mt-0.5 truncate text-eyebrow font-semibold opacity-60">
              {item.budgetItemName}
            </p>
          </div>
          <span className="shrink-0 font-mono text-title font-black tabular-nums">
            {impact.afterPercentage.toFixed(0)}%
          </span>
        </div>
        <div className="pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-eyebrow font-semibold text-on-surface-variant/60">
              Budget kategori
            </span>
            <MoneyValue
              amount={item.allocatedAmount}
              variant="compact"
              size="sm"
              align="right"
            />
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0">
              <p className="text-eyebrow font-semibold text-on-surface-variant/60">Saat ini</p>
              <MoneyValue
                amount={item.actualSpent}
                variant="compact"
                size="lg"
                className="mt-1"
              />
              <p className="mt-1 font-mono text-eyebrow font-bold text-on-surface-variant">
                {impact.beforePercentage.toFixed(0)}% terpakai
              </p>
            </div>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant"
              aria-hidden="true"
            >
              <AppIcon name="arrow_forward" className="icon-sm" />
            </span>
            <div className="min-w-0 text-right">
              <p className="text-eyebrow font-semibold text-on-surface-variant/60">
                Jika disetujui
              </p>
              <MoneyValue
                amount={nextSpent}
                variant="compact"
                size="lg"
                align="right"
                tone={critical ? "danger" : warning ? "warning" : "default"}
                className="mt-1"
              />
              <p
                className={`mt-1 font-mono text-eyebrow font-bold ${critical ? "text-error" : warning ? "text-warning" : "text-on-surface-variant"}`}
              >
                {impact.afterPercentage.toFixed(0)}% terpakai
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ApprovalDecisionFooter({
  item,
  pending,
  onDecision,
}: {
  readonly item: ApprovalItem;
  readonly pending: boolean;
  readonly onDecision: (item: ApprovalItem, status: ApprovalDecision["status"]) => void;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[0.9fr_1.1fr] gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => onDecision(item, "REJECTED")}
        className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
      >
        Tolak
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => onDecision(item, "APPROVED")}
        className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary shadow-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
      >
        Setujui pengajuan
      </button>
    </div>
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
