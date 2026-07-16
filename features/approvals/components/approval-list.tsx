"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  approveFieldRequest,
  approveVendorPayment,
} from "@/app/actions/finance/field-requests";
import {
  BottomSheet,
  ConfirmationSheet,
  PageState,
  Textarea,
  useSheetPresenceValue,
} from "@/components/ui";
import {
  ExclusiveSearchFilterBar,
  type SearchFilterMode,
} from "@/components/ui/exclusive-search-filter-bar";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  approvalIsCritical,
  groupApprovals,
} from "@/features/approvals/components/approval-list-utils";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardSummarySurface,
} from "@/features/finance-dashboard/components/dashboard-primitives";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@/features/finance-dashboard/components/dashboard-budget-indicators";
import { formatShortDate } from "@/features/finance-dashboard/lib/dashboard-formatters";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@/lib/ui/presentation-flags";
import { getErrorMessage } from "@/lib/utils/error-message";
import {
  transitionEaseSmooth,
  transitionSpringSmooth,
  transitionSpringSnappy,
} from "@/lib/utils/motion";

export type ApprovalItem = ApprovalDetail;

type ApprovalFilter = "ALL" | "FIELD" | "VENDOR" | "CRITICAL";

type ApprovalDecision = {
  readonly item: ApprovalItem;
  readonly status: "APPROVED" | "REJECTED";
};

interface ApprovalListProps {
  readonly initialApprovals: readonly ApprovalItem[];
}

const rowPressScale = { scale: 0.985 } as const;

export function ApprovalList({
  initialApprovals,
}: ApprovalListProps): React.JSX.Element {
  const router = useRouter();
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([
    ...initialApprovals,
  ]);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<ApprovalFilter>("ALL");
  const [controlMode, setControlMode] = React.useState<SearchFilterMode>("filter");
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null);
  const [decision, setDecision] = React.useState<ApprovalDecision | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = React.useState(20);
  const [resultsMinHeight, setResultsMinHeight] = React.useState<number | null>(null);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const stickyControlRef = React.useRef<HTMLDivElement | null>(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const stickyActive = WORKSPACE_STICKY_CONTROLS_ENABLED && isSticky;
  const pendingScrollYRef = React.useRef<number | null>(null);
  const [pending, startTransition] = React.useTransition();
  const shouldReduceStickyMotion = useReducedMotion();
  const hasApprovals = approvals.length > 0;
  const stickyTransition = shouldReduceStickyMotion
    ? { duration: 0 }
    : transitionSpringSmooth;
  const surfaceTransition = shouldReduceStickyMotion
    ? { duration: 0 }
    : transitionEaseSmooth;

  React.useEffect(() => {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;

    const stickyControl = stickyControlRef.current;
    if (!stickyControl) return;
    let frameId: number | null = null;

    const updateStickyState = (): void => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const nextSticky =
          window.scrollY > 0 &&
          stickyControl.getBoundingClientRect().top <= 64.5;
        setIsSticky((current) =>
          current === nextSticky ? current : nextSticky,
        );
      });
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, [hasApprovals]);

  const counts = React.useMemo(() => ({
    critical: approvals.filter(approvalIsCritical).length,
    field: approvals.filter((item) => item.type === "project_cost").length,
    vendor: approvals.filter((item) => item.type === "vendor_payment").length,
  }), [approvals]);
  const totalAmount = React.useMemo(
    () => approvals.reduce((sum, item) => sum + item.amount, 0),
    [approvals],
  );

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return approvals.filter((item) => {
      const matchesQuery =
        normalized.length === 0 ||
        item.projectName.toLowerCase().includes(normalized) ||
        item.requestedBy.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "FIELD" && item.type === "project_cost") ||
        (filter === "VENDOR" && item.type === "vendor_payment") ||
        (filter === "CRITICAL" && approvalIsCritical(item));
      return controlMode === "search" ? matchesQuery : matchesFilter;
    });
  }, [approvals, controlMode, filter, query]);

  const grouped = React.useMemo(
    () => groupApprovals(filtered.slice(0, visibleLimit)),
    [filtered, visibleLimit],
  );

  React.useLayoutEffect(() => {
    const pendingScrollY = pendingScrollYRef.current;
    if (pendingScrollY === null) return;
    window.scrollTo({ top: pendingScrollY, behavior: "auto" });
    pendingScrollYRef.current = null;
  }, [filter]);

  function changeFilter(value: ApprovalFilter): void {
    const currentResultsHeight = resultsRef.current?.getBoundingClientRect().height ?? 0;
    setResultsMinHeight((current) => Math.max(current ?? 0, currentResultsHeight));
    pendingScrollYRef.current = window.scrollY;
    setVisibleLimit(20);
    setFilter(value);
  }

  function changeControlMode(mode: SearchFilterMode): void {
    const currentResultsHeight = resultsRef.current?.getBoundingClientRect().height ?? 0;
    setResultsMinHeight((current) => Math.max(current ?? 0, currentResultsHeight));
    setVisibleLimit(20);
    setQuery("");
    setControlMode(mode);
    if (mode === "search" && filter !== "ALL") {
      pendingScrollYRef.current = window.scrollY;
      setFilter("ALL");
    }
  }

  function requestDecision(
    item: ApprovalItem,
    status: ApprovalDecision["status"],
  ): void {
    setDecision({ item, status });
    if (status === "REJECTED") setRejectionReason("");
  }

  function closeDecision(): void {
    if (pending) return;
    setDecision(null);
    setRejectionReason("");
  }

  function confirmDecision(): void {
    if (!decision) return;
    if (decision.status === "REJECTED" && rejectionReason.trim().length < 5) {
      toast.error("Tuliskan alasan penolakan minimal 5 karakter.");
      return;
    }

    const { item, status } = decision;
    startTransition(async () => {
      try {
        const notes = status === "APPROVED"
          ? "Disetujui Owner"
          : rejectionReason.trim();
        const response = item.type === "project_cost"
          ? await approveFieldRequest({
              projectCostId: item.referenceId,
              status,
              notes,
            })
          : await approveVendorPayment(item.referenceId, notes, status);

        if (!response.success) throw new Error(response.error.message);

        setApprovals((current) => current.filter((row) => row.id !== item.id));
        setSelected(null);
        setDecision(null);
        setRejectionReason("");
        toast.success(
          `${status === "APPROVED" ? "Persetujuan diberikan" : "Pengajuan ditolak"} · Rp ${item.amount.toLocaleString("id-ID")}`,
        );
        router.refresh();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Persetujuan gagal diproses."));
      }
    });
  }

  function resetFilters(): void {
    setQuery("");
    setFilter("ALL");
    setControlMode("filter");
    setVisibleLimit(20);
  }

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Antrean persetujuan"
        eyebrow="Keputusan"
        icon="approval"
        status={approvals.length > 0 ? "Perlu ditinjau" : "Selesai"}
        statusTone={approvals.length > 0 ? "warning" : "positive"}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[30px] font-black leading-none text-on-surface max-[430px]:text-[27px]">
              {approvals.length}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
              persetujuan menunggu keputusan
            </p>
          </div>
          <div className="min-w-0 shrink-0 text-right">
            <p className="text-[8px] font-semibold text-on-surface-variant/60">
              Total antrean
            </p>
            <MoneyValue
              amount={totalAmount}
              variant="compactWithFull"
              size="sm"
              align="right"
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 divide-x divide-black/[0.055] rounded-[18px] bg-surface-container-low/65 px-3 py-2.5">
          <QueueMetric
            label="Prioritas kritis"
            value={String(counts.critical)}
            danger={counts.critical > 0}
          />
          <QueueMetric
            label="Lapangan · Vendor"
            value={`${counts.field} · ${counts.vendor}`}
            align="right"
          />
        </div>
      </DashboardSummarySurface>

      {hasApprovals ? (
        <motion.div
          ref={stickyControlRef}
          data-sticky={stickyActive ? "true" : "false"}
          data-density={stickyActive ? "floating" : "inline"}
          animate={{
            marginLeft: stickyActive ? -8 : 0,
            marginRight: stickyActive ? -8 : 0,
            padding: stickyActive ? 8 : 0,
          }}
          transition={stickyTransition}
          className={WORKSPACE_STICKY_CONTROLS_ENABLED ? "sticky top-16 z-20" : "relative"}
        >
          <AnimatePresence initial={false}>
            {stickyActive ? (
              <motion.div
                key="sticky-approval-filter-surface"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={surfaceTransition}
                className="pointer-events-none absolute inset-0 rounded-[24px] bg-white/[0.96] shadow-[0_1px_2px_rgba(17,17,17,0.03),0_12px_30px_rgba(17,17,17,0.08)] ring-1 ring-black/[0.035] backdrop-blur-xl"
                aria-hidden="true"
              />
            ) : null}
          </AnimatePresence>
          <div className="relative">
            <ExclusiveSearchFilterBar
              mode={controlMode}
              filterValue={filter}
              onFilterChange={changeFilter}
              filterAriaLabel="Filter persetujuan"
              filterLayoutId="approval-list-filter"
              searchLayoutId="approval-list-search-control"
              searchValue={query}
              onSearchChange={(value) => {
                setVisibleLimit(20);
                setQuery(value);
              }}
              onModeChange={changeControlMode}
              searchPlaceholder="Cari proyek, pengaju, keterangan"
              searchAriaLabel="Cari antrean persetujuan"
              fillAvailableSpace
              filterOptions={[
                { value: "ALL", label: "Semua", count: approvals.length },
                {
                  value: "FIELD",
                  label: "Lapangan",
                  count: counts.field > 0 ? counts.field : undefined,
                },
                {
                  value: "VENDOR",
                  label: "Vendor",
                  count: counts.vendor > 0 ? counts.vendor : undefined,
                },
                {
                  value: "CRITICAL",
                  label: "Risiko",
                  count: counts.critical > 0 ? counts.critical : undefined,
                },
              ]}
            />
          </div>
        </motion.div>
      ) : null}

      <div
        ref={resultsRef}
        className="space-y-lg max-[430px]:space-y-5"
        style={resultsMinHeight === null ? undefined : { minHeight: `${resultsMinHeight}px` }}
      >
        {approvals.length === 0 ? (
          <DashboardDetailSection title="Urutan prioritas">
            <PageState
              kind="first-use"
              title="Semua keputusan selesai"
              description="Tidak ada pengajuan finansial yang menunggu otorisasi saat ini."
            />
          </DashboardDetailSection>
        ) : filtered.length === 0 ? (
          <DashboardDetailSection title="Hasil pencarian">
            <PageState
              kind="filtered-empty"
              title="Antrean tidak ditemukan"
              description={controlMode === "search" ? "Coba kata kunci lain atau tutup pencarian." : "Pilih filter lain untuk melihat pengajuan."}
              actionLabel={controlMode === "search" ? "Tutup pencarian" : "Reset filter"}
              onAction={resetFilters}
            />
          </DashboardDetailSection>
        ) : (
          grouped.map((group) => (
            <DashboardDetailSection
              key={group.label}
              title={`${group.label} · ${group.items.length}`}
            >
              <DashboardRowGroup>
                {group.items.map((item) => (
                  <ApprovalQueueRow
                    key={item.id}
                    item={item}
                    pending={pending}
                    onSelect={() => setSelected(item)}
                  />
                ))}
              </DashboardRowGroup>
            </DashboardDetailSection>
          ))
        )}

        {filtered.length > visibleLimit ? (
          <button
            type="button"
            onClick={() => setVisibleLimit((current) => current + 20)}
            className="min-h-12 w-full rounded-full bg-surface-container text-xs font-bold text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            Tampilkan 20 berikutnya
          </button>
        ) : null}
      </div>

      <ApprovalDetailSheet
        item={selected}
        pending={pending}
        onClose={() => {
          if (!pending) setSelected(null);
        }}
        onOpenReceipt={setActiveImage}
        onDecision={requestDecision}
      />

      <ConfirmationSheet
        open={decision?.status === "APPROVED"}
        title="Setujui pengajuan?"
        description="Dampak budget sudah ditampilkan di detail. Keputusan ini akan dicatat dalam audit log."
        confirmLabel="Setujui"
        pending={pending}
        onClose={closeDecision}
        onConfirm={confirmDecision}
      />

      <BottomSheet
        open={decision?.status === "REJECTED"}
        title="Alasan Penolakan"
        onClose={closeDecision}
      >
        <div className="space-y-md">
          <div className="rounded-[20px] bg-error-container/25 p-4 text-xs leading-5 text-error">
            Pengajuan tidak akan dilanjutkan. Jelaskan alasan yang dapat ditindaklanjuti oleh pengaju.
          </div>
          <div>
            <label
              htmlFor="approval-rejection-reason"
              className="px-1 text-xs font-bold text-on-surface"
            >
              Alasan penolakan
            </label>
            <Textarea
              id="approval-rejection-reason"
              autoFocus
              rows={4}
              value={rejectionReason}
              onChange={setRejectionReason}
              disabled={pending}
              placeholder="Contoh: nominal belum sesuai dengan progres pekerjaan"
              className="mt-2"
              aria-invalid={rejectionReason.length > 0 && rejectionReason.trim().length < 5}
            />
            <p className="mt-1 px-1 text-[10px] text-on-surface-variant">
              Minimal 5 karakter.
            </p>
          </div>
          <button
            type="button"
            disabled={pending || rejectionReason.trim().length < 5}
            onClick={confirmDecision}
            className="min-h-12 w-full rounded-full bg-error px-5 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-error/25 disabled:opacity-40"
          >
            {pending ? "Menyimpan penolakan" : "Tolak pengajuan"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={activeImage !== null}
        title="Bukti pengajuan"
        onClose={() => setActiveImage(null)}
      >
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImage}
            alt="Bukti pengajuan"
            className="max-h-[68dvh] w-full rounded-[24px] bg-surface-container object-contain"
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

function QueueMetric({
  label,
  value,
  danger = false,
  align = "left",
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
  readonly align?: "left" | "right";
}): React.JSX.Element {
  return (
    <div className={`min-w-0 px-2.5 first:pl-0 last:pr-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <p className="truncate text-[9px] font-semibold text-on-surface-variant/60">
        {label}
      </p>
      <p className={`mt-1 truncate font-mono text-[11px] font-bold ${danger ? "text-error" : "text-on-surface"}`}>
        {value}
      </p>
    </div>
  );
}

function ApprovalQueueRow({
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
    ? "bg-error/[0.075] text-error ring-error/[0.05]"
    : warning
      ? "bg-warning/[0.09] text-warning ring-warning/[0.06]"
      : "bg-primary/[0.075] text-primary ring-primary/[0.05]";
  const reasonClass = critical
    ? "text-error"
    : warning
      ? "text-warning"
      : "text-on-surface-variant";
  const priorityLabel = item.priority === "NORMAL" && critical
    ? "Mencapai batas budget"
    : item.priorityReason;

  return (
    <div className="px-2.5 py-1.5">
      <motion.button
        type="button"
        onClick={onSelect}
        disabled={pending}
        whileTap={reduceMotion ? undefined : rowPressScale}
        transition={transitionSpringSnappy}
        className="min-h-12 w-full rounded-[20px] px-2 py-2.5 text-left outline-none active:bg-black/[0.025] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${toneClass}`}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {item.type === "project_cost" ? "receipt_long" : "request_quote"}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <MoneyValue
                amount={item.amount}
                variant="compactWithFull"
                size="lg"
                className="min-w-0"
              />
              <span className={`max-w-[42%] shrink-0 text-right text-[9px] font-semibold leading-3 ${reasonClass}`}>
                {priorityLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] font-semibold leading-5 text-on-surface">
              {item.description}
            </p>
            <p className="mt-0.5 truncate text-[10px] leading-4 text-on-surface-variant/75">
              {item.projectName}
            </p>
          </div>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-[#007AFF]" aria-hidden="true">
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
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

function ApprovalDetailSheet({
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
  readonly onDecision: (
    item: ApprovalItem,
    status: ApprovalDecision["status"],
  ) => void;
}): React.JSX.Element {
  const { presentedValue: presentedItem, open, handleExitComplete } =
    useSheetPresenceValue(item, item?.id);

  return (
    <BottomSheet
      open={open}
      title="Detail persetujuan"
      onClose={onClose}
      onExitComplete={handleExitComplete}
      footer={presentedItem ? (
        <ApprovalDecisionFooter
          item={presentedItem}
          pending={pending}
          onDecision={onDecision}
        />
      ) : undefined}
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
  const typeLabel = item.type === "project_cost" ? "Biaya lapangan" : "Tagihan vendor";
  const typeIcon = item.type === "project_cost" ? "receipt_long" : "request_quote";
  const statusLabel = critical ? "Risiko tinggi" : warning ? "Perlu perhatian" : "Siap ditinjau";

  return (
    <div className="space-y-4 pb-1">
      <section className="overflow-hidden rounded-[26px] bg-[#171819] px-4 pb-4 pt-3.5 text-white shadow-[0_16px_34px_rgba(17,17,17,0.16)]">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-[10px] font-bold text-white/70">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-white/10 text-white">
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                {typeIcon}
              </span>
            </span>
            <span className="truncate">{typeLabel}</span>
          </span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${critical ? "bg-[#ff6b61]/18 text-[#ff9b94]" : warning ? "bg-[#ffb020]/16 text-[#ffd081]" : "bg-white/10 text-white/75"}`}>
            {statusLabel}
          </span>
        </div>

        <div className="mt-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
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

        <p className="mt-3 text-[13px] font-semibold leading-5 text-white">
          {item.description}
        </p>
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
        <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/[0.025]">
          <ApprovalContextRow icon="folder_open" label="Project" value={item.projectName} />
          <ApprovalContextRow icon="person" label="Pengaju" value={item.requestedBy} />
          <ApprovalContextRow icon="category" label="Kategori budget" value={item.budgetItemName} />
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
              className="flex min-h-12 w-full items-center gap-3 border-t border-outline-variant/20 px-3.5 py-2.5 text-left outline-none active:bg-black/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-primary/[0.075] text-primary">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">image</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-semibold text-on-surface-variant/60">Dokumen pendukung</span>
                <span className="mt-0.5 block text-[12px] font-bold text-on-surface">Lihat bukti pengajuan</span>
              </span>
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">chevron_right</span>
            </button>
          ) : null}
        </div>
      </section>

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
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold text-on-surface-variant/60">{label}</p>
        <p className={`mt-0.5 text-[12px] font-semibold leading-4 text-on-surface ${multiline ? "whitespace-pre-wrap" : "truncate"}`} title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ApprovalImpactReview({ item }: { readonly item: ApprovalItem }): React.JSX.Element {
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
          <h3 id="approval-impact-title" className="text-[13px] font-bold text-on-surface">Dampak ke budget</h3>
          <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">{item.budgetItemName}</p>
        </div>
        <span className={`shrink-0 font-mono text-[12px] font-black ${critical ? "text-error" : warning ? "text-warning" : "text-on-surface"}`}>
          {impact.afterPercentage.toFixed(0)}%
        </span>
      </div>

      <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/[0.025]">
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-semibold text-on-surface-variant/60">Budget kategori</span>
            <MoneyValue amount={item.allocatedAmount} variant="compactWithFull" size="sm" align="right" />
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-on-surface-variant/60">Saat ini</p>
              <MoneyValue amount={item.actualSpent} variant="compactWithFull" size="lg" className="mt-1" />
              <p className="mt-1 font-mono text-[9px] font-bold text-on-surface-variant">{impact.beforePercentage.toFixed(0)}% terpakai</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant" aria-hidden="true">
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </span>
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-semibold text-on-surface-variant/60">Jika disetujui</p>
              <MoneyValue amount={nextSpent} variant="compactWithFull" size="lg" align="right" tone={critical ? "danger" : warning ? "warning" : "default"} className="mt-1" />
              <p className={`mt-1 font-mono text-[9px] font-bold ${critical ? "text-error" : warning ? "text-warning" : "text-on-surface-variant"}`}>{impact.afterPercentage.toFixed(0)}% terpakai</p>
            </div>
          </div>
        </div>
        <div className={`flex min-h-10 items-center gap-2 px-4 py-2.5 text-[10px] font-bold ${toneClass}`}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            {critical ? "report" : warning ? "warning" : "check_circle"}
          </span>
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
        className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-error/25 disabled:opacity-45"
      >
        Tolak
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => onDecision(item, "APPROVED")}
        className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary shadow-[0_8px_18px_rgba(0,122,255,0.18)] outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-45"
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
