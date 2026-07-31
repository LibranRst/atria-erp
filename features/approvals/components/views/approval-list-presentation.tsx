"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { BottomSheet, useSheetPresenceValue } from "@/components/ui";
import { MoneyValue } from "@/components/ui/feedback/page-primitives";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { approvalIsCritical } from "@/features/approvals/utils/approval-list-utils";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/shared/inventory-opening-approval-items";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@/features/finance-dashboard/utils/budget-indicator-utils";
import { formatShortDate } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export type ApprovalItem = ApprovalDetail;

export interface ApprovalDecision {
  readonly item: ApprovalItem;
  readonly status: "APPROVED" | "REJECTED";
}

const rowPressScale = { scale: 0.985 } as const;

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
  const toneClass = critical
    ? "bg-error/7.5 text-error ring-error/5"
    : warning
      ? "bg-warning/9 text-warning ring-warning/6"
      : "bg-primary/7.5 text-primary ring-primary/5";
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
        className="min-h-12 w-full rounded-[20px] px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${toneClass}`}
          >
            <AppIcon
              name={
                item.type === "project_cost"
                  ? "receipt_long"
                  : item.type === "inventory_opening"
                    ? "inventory"
                    : "request_quote"
              }
              className="text-[18px]"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <MoneyValue
                amount={item.amount}
                variant="compactWithFull"
                size="lg"
                className="min-w-0"
              />
              <span
                className={`max-w-[42%] shrink-0 text-right text-[9px] leading-3 font-semibold ${reasonClass}`}
              >
                {priorityLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] leading-5 font-semibold text-on-surface">
              {item.description}
            </p>
            <p className="mt-0.5 truncate text-[10px] leading-4 text-on-surface-variant/75">
              {item.projectName}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="text-[16px]" />
          </span>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-[9px] font-semibold text-on-surface-variant/70">
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
  const typeIcon =
    item.type === "project_cost"
      ? "receipt_long"
      : item.type === "inventory_opening"
        ? "inventory"
        : "request_quote";
  const statusLabel = critical ? "Risiko tinggi" : warning ? "Perlu perhatian" : "Siap ditinjau";

  return (
    <div className="space-y-4 pb-1">
      <section className="overflow-hidden rounded-[26px] bg-[#171819] px-4 pt-3.5 pb-4 text-white shadow-inverse">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-[10px] font-bold text-white/70">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
              <AppIcon name={typeIcon} className="text-[17px]" />
            </span>
            <span className="truncate">{typeLabel}</span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${critical ? "bg-[#ff6b61]/18 text-[#ff9b94]" : warning ? "bg-[#ffb020]/16 text-[#ffd081]" : "bg-white/10 text-white/75"}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-4">
          <p className="text-[9px] font-bold tracking-[0.14em] text-white/45 uppercase">
            Nilai pengajuan
          </p>
          <MoneyValue
            amount={item.amount}
            variant="compactWithFull"
            tone="inverse"
            size="hero"
            className="mt-1"
          />
        </div>

        <p className="mt-3 text-[13px] leading-5 font-semibold text-white">{item.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-[9px] font-semibold text-white/55">
          <span className="truncate">Diajukan {formatShortDate(item.createdAt)}</span>
          <span className="max-w-[48%] shrink-0 truncate text-right" title={item.priorityReason}>
            {item.priorityReason}
          </span>
        </div>
      </section>

      <section aria-labelledby="approval-context-title">
        <h3 id="approval-context-title" className="mb-2 px-1 text-[13px] font-bold text-on-surface">
          Konteks pengajuan
        </h3>
        <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
          <ApprovalContextRow
            icon={item.type === "inventory_opening" ? "warehouse" : "folder_open"}
            label={item.type === "inventory_opening" ? "Ruang kerja" : "Project"}
            value={item.projectName}
          />
          <ApprovalContextRow icon="person" label="Pengaju" value={item.requestedBy} />
          <ApprovalContextRow
            icon={item.type === "inventory_opening" ? "inventory" : "category"}
            label={item.type === "inventory_opening" ? "Cakupan" : "Kategori budget"}
            value={item.budgetItemName}
          />
          <ApprovalContextRow
            icon="event"
            label="Jatuh tempo"
            value={item.dueDate ? formatShortDate(item.dueDate) : "Tidak ditentukan"}
          />
          {item.notes ? (
            <ApprovalContextRow icon="notes" label="Catatan" value={item.notes} multiline />
          ) : null}
          {item.receiptImageUrl ? (
            <button
              type="button"
              onClick={() => onOpenReceipt(item.receiptImageUrl ?? "")}
              className="flex min-h-12 w-full items-center gap-3 border-t border-outline-variant/20 px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-black/2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/7.5 text-primary">
                <AppIcon name="image" className="text-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-semibold text-on-surface-variant/60">
                  Dokumen pendukung
                </span>
                <span className="mt-0.5 block text-[12px] font-bold text-on-surface">
                  Lihat bukti pengajuan
                </span>
              </span>
              <AppIcon name="chevron_right" className="text-[18px] text-primary" />
            </button>
          ) : null}
        </div>
      </section>

      {item.type === "inventory_opening" ? <InventoryOpeningApprovalItems item={item} /> : null}

      <ApprovalImpactReview item={item} />
    </div>
  );
}

function ApprovalContextRow({
  icon,
  label,
  value,
  multiline = false,
}: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly multiline?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-outline-variant/20 px-3.5 py-2.5 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant">
        <AppIcon name={icon} className="text-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold text-on-surface-variant/60">{label}</p>
        <p
          className={`mt-0.5 text-[12px] leading-4 font-semibold text-on-surface ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
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
        <h3 id="approval-impact-title" className="mb-2 px-1 text-[13px] font-bold text-on-surface">
          Dampak setelah disetujui
        </h3>
        <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
          <ApprovalContextRow
            icon="add_box"
            label="Inventory"
            value={`Menambah ${item.budgetItemName} sesuai jumlah fisik`}
            multiline
          />
          <ApprovalContextRow
            icon="account_balance_wallet"
            label="Kas & proyek"
            value="Tidak membuat kas keluar, utang vendor, atau actual cost proyek"
            multiline
          />
          <ApprovalContextRow
            icon="history"
            label="Audit"
            value="Mencatat pergerakan saldo awal stok dan riwayat audit"
            multiline
          />
        </div>
      </section>
    );
  }
  const impact = getApprovalBudgetImpact(item.allocatedAmount, item.actualSpent, item.amount);
  const nextSpent = item.actualSpent + item.amount;
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const toneClass = critical
    ? "bg-error-light text-error"
    : warning
      ? "bg-warning-light text-warning"
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
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 id="approval-impact-title" className="text-[13px] font-bold text-on-surface">
            Dampak ke budget
          </h3>
          <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">
            {item.budgetItemName}
          </p>
        </div>
        <span
          className={`shrink-0 font-mono text-[12px] font-black ${critical ? "text-error" : warning ? "text-warning" : "text-on-surface"}`}
        >
          {impact.afterPercentage.toFixed(0)}%
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-semibold text-on-surface-variant/60">
              Budget kategori
            </span>
            <MoneyValue
              amount={item.allocatedAmount}
              variant="compactWithFull"
              size="sm"
              align="right"
            />
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-on-surface-variant/60">Saat ini</p>
              <MoneyValue
                amount={item.actualSpent}
                variant="compactWithFull"
                size="lg"
                className="mt-1"
              />
              <p className="mt-1 font-mono text-[9px] font-bold text-on-surface-variant">
                {impact.beforePercentage.toFixed(0)}% terpakai
              </p>
            </div>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant"
              aria-hidden="true"
            >
              <AppIcon name="arrow_forward" className="text-[15px]" />
            </span>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-semibold text-on-surface-variant/60">Jika disetujui</p>
              <MoneyValue
                amount={nextSpent}
                variant="compactWithFull"
                size="lg"
                align="right"
                tone={critical ? "danger" : warning ? "warning" : "default"}
                className="mt-1"
              />
              <p
                className={`mt-1 font-mono text-[9px] font-bold ${critical ? "text-error" : warning ? "text-warning" : "text-on-surface-variant"}`}
              >
                {impact.afterPercentage.toFixed(0)}% terpakai
              </p>
            </div>
          </div>
        </div>
        <div
          className={`flex min-h-10 items-center gap-2 px-4 py-2.5 text-[10px] font-bold ${toneClass}`}
        >
          <AppIcon
            name={critical ? "report" : warning ? "warning" : "check_circle"}
            className="text-[16px]"
          />
          <span>{impactLabel}</span>
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
