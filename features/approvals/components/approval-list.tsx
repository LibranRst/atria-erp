"use client";

import React from "react";
import { toast } from "sonner";

import {
  approveFieldRequest,
  approveVendorPayment,
} from "@/app/actions/finance/field-requests";
import { BottomSheet, PageState, SearchInput } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  MoneyValue,
  PillTabs,
} from "@/components/ui/page-primitives";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { getErrorMessage } from "@/lib/utils/error-message";

export type ApprovalItem = ApprovalDetail;

type ApprovalFilter = "ALL" | "FIELD" | "VENDOR" | "CRITICAL";

interface ApprovalListProps {
  readonly initialApprovals: readonly ApprovalItem[];
}

export function ApprovalList({
  initialApprovals,
}: ApprovalListProps): React.JSX.Element {
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([
    ...initialApprovals,
  ]);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<ApprovalFilter>("ALL");
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null);
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = React.useState(20);

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
      return matchesQuery && matchesFilter;
    });
  }, [approvals, filter, query]);

  const grouped = React.useMemo(
    () => groupApprovals(filtered.slice(0, visibleLimit)),
    [filtered, visibleLimit],
  );

  async function handleAction(
    item: ApprovalItem,
    action: "APPROVED" | "REJECTED",
  ): Promise<void> {
    setProcessingId(item.id);
    try {
      if (item.type === "project_cost") {
        const response = await approveFieldRequest({
          projectCostId: item.referenceId,
          status: action,
          notes: action === "APPROVED" ? "Disetujui Owner" : "Ditolak Owner",
        });
        if (!response.success) throw new Error(response.error.message);
      } else {
        const response = await approveVendorPayment(
          item.referenceId,
          action === "APPROVED" ? "Disetujui Owner" : "Ditolak Owner",
          action,
        );
        if (!response.success) throw new Error(response.error.message);
      }

      toast.success(
        `${action === "APPROVED" ? "Persetujuan diberikan" : "Pengajuan ditolak"} · Rp ${item.amount.toLocaleString("id-ID")}`,
      );
      setApprovals((current) => current.filter((row) => row.id !== item.id));
      setSelected(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Persetujuan gagal diproses."));
    } finally {
      setProcessingId(null);
    }
  }

  if (approvals.length === 0) {
    return (
      <PageState
        kind="first-use"
        title="Semua keputusan selesai"
        description="Tidak ada pengajuan finansial yang menunggu otorisasi saat ini."
      />
    );
  }

  return (
    <div className="space-y-md">
      <div className="sticky top-16 z-20 space-y-2 rounded-[28px] border border-outline-variant/20 bg-white/95 p-sm shadow-[0_14px_34px_rgba(17,17,17,0.055)] backdrop-blur-md">
        <SearchInput
          value={query}
          onChange={(value) => {
            setVisibleLimit(20);
            setQuery(value);
          }}
          placeholder="Cari proyek, pengaju, keterangan"
          ariaLabel="Cari antrean persetujuan"
        />
        <PillTabs
          value={filter}
          onChange={(value) => {
            setVisibleLimit(20);
            setFilter(value);
          }}
          ariaLabel="Filter persetujuan"
          options={[
            { value: "ALL", label: "Semua", count: approvals.length },
            {
              value: "FIELD",
              label: "Lapangan",
              count: approvals.filter((item) => item.type === "project_cost").length,
            },
            {
              value: "VENDOR",
              label: "Vendor",
              count: approvals.filter((item) => item.type === "vendor_payment").length,
            },
            {
              value: "CRITICAL",
              label: "Risiko",
              count: approvals.filter(approvalIsCritical).length,
            },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <PageState
          kind="filtered-empty"
          title="Antrean tidak ditemukan"
          description="Ubah kata kunci atau filter untuk melihat pengajuan lain."
          actionLabel="Reset filter"
          onAction={() => {
            setQuery("");
            setFilter("ALL");
          }}
        />
      ) : (
        grouped.map((group) => (
          <section key={group.label} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                {group.label}
              </h2>
              <span className="text-[10px] font-bold text-on-surface-variant">
                {group.items.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {group.items.map((item) => (
                <ApprovalQueueRow
                  key={item.id}
                  item={item}
                  onSelect={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {filtered.length > visibleLimit ? (
        <button
          type="button"
          onClick={() => setVisibleLimit((current) => current + 20)}
          className="min-h-12 w-full rounded-full bg-surface-container text-xs font-bold text-on-surface"
        >
          Tampilkan 20 berikutnya
        </button>
      ) : null}

      <ApprovalDetailSheet
        item={selected}
        pending={processingId === selected?.id}
        onClose={() => setSelected(null)}
        onOpenReceipt={setActiveImage}
        onAction={handleAction}
      />

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

function ApprovalQueueRow({
  item,
  onSelect,
}: {
  readonly item: ApprovalItem;
  readonly onSelect: () => void;
}): React.JSX.Element {
  const nextSpent = item.actualSpent + item.amount;
  const utilization =
    item.allocatedAmount > 0 ? (nextSpent / item.allocatedAmount) * 100 : 0;
  const critical = approvalIsCritical(item);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[86px] w-full items-start gap-3 rounded-[24px] border border-outline-variant/20 bg-white px-3 py-3 text-left shadow-[0_8px_20px_rgba(17,17,17,0.035)] outline-none transition-colors hover:bg-surface-container-low/45 focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99]"
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${critical ? "bg-error/10 text-error" : "bg-primary/8 text-primary"}`}>
        <span className="material-symbols-outlined text-[18px]">
          {item.type === "project_cost" ? "receipt_long" : "payments"}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-bold text-on-surface">{item.projectName}</span>
          {critical ? <Badge status="CRITICAL">Risiko</Badge> : null}
        </span>
        <span className="mt-1 block line-clamp-1 text-[11px] text-on-surface-variant">
          {item.description}
        </span>
        <span className="mt-1 block text-[9px] font-semibold text-on-surface-variant">
          {item.requestedBy} · {formatQueueTime(item.createdAt)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <MoneyValue amount={item.amount} variant="compactWithFull" align="right" size="sm" />
        <span className={`mt-1 block text-[9px] font-bold ${critical ? "text-error" : "text-on-surface-variant"}`}>
          {utilization.toFixed(0)}% budget
        </span>
      </span>
    </button>
  );
}

function ApprovalDetailSheet({
  item,
  pending,
  onClose,
  onOpenReceipt,
  onAction,
}: {
  readonly item: ApprovalItem | null;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onOpenReceipt: (url: string) => void;
  readonly onAction: (
    item: ApprovalItem,
    action: "APPROVED" | "REJECTED",
  ) => Promise<void>;
}): React.JSX.Element {
  const nextSpent = item ? item.actualSpent + item.amount : 0;
  const utilization = item && item.allocatedAmount > 0
    ? (nextSpent / item.allocatedAmount) * 100
    : 0;
  const receiptImageUrl = item?.receiptImageUrl ?? null;

  return (
    <BottomSheet
      open={item !== null}
      title="Keputusan Persetujuan"
      onClose={onClose}
      footer={item ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction(item, "REJECTED")}
            className="min-h-12 rounded-full bg-error/10 px-4 text-xs font-bold text-error disabled:opacity-50"
          >
            {pending ? "Memproses…" : "Tolak"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction(item, "APPROVED")}
            className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-50"
          >
            {pending ? "Memproses…" : "Setujui"}
          </button>
        </div>
      ) : undefined}
    >
      {item ? (
        <div className="space-y-md">
          <div className="rounded-[24px] bg-primary p-4 text-on-primary">
            <p className="text-[9px] font-bold uppercase tracking-wide text-white/55">Nilai pengajuan</p>
            <MoneyValue amount={item.amount} variant="fullDynamic" tone="inverse" size="hero" className="mt-1" />
            <p className="mt-2 text-xs leading-5 text-white/70">{item.description}</p>
          </div>

          <div className="divide-y divide-outline-variant/35 overflow-hidden rounded-[22px] bg-surface-container-low">
            <DetailRow label="Proyek" value={item.projectName} />
            <DetailRow label="Kategori" value={item.budgetItemName} />
            <DetailRow label="Pengaju" value={item.requestedBy} />
            <DetailRow
              label="Waktu"
              value={new Date(item.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            />
          </div>

          <div className={`rounded-[22px] p-3 ${item.budgetOverrun || utilization >= 100 ? "bg-error-container/15" : "bg-surface-container-low"}`}>
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              <span>Budget setelah disetujui</span>
              <span className={item.budgetOverrun || utilization >= 100 ? "text-error" : "text-on-surface"}>{utilization.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div className={`h-full rounded-full ${item.budgetOverrun || utilization >= 100 ? "bg-error" : "bg-primary"}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-on-surface-variant">
              Rp {item.actualSpent.toLocaleString("id-ID")} terpakai dari Rp {item.allocatedAmount.toLocaleString("id-ID")}
            </p>
          </div>

          {receiptImageUrl ? (
            <button
              type="button"
              onClick={() => onOpenReceipt(receiptImageUrl)}
              className="min-h-12 w-full rounded-full bg-surface-container text-xs font-bold text-on-surface"
            >
              Lihat bukti pengajuan
            </button>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
      <span className="max-w-[62%] text-right text-xs font-bold text-on-surface">{value}</span>
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

function approvalIsCritical(item: ApprovalItem): boolean {
  const nextSpent = item.actualSpent + item.amount;
  const utilization = item.allocatedAmount > 0
    ? (nextSpent / item.allocatedAmount) * 100
    : 0;
  return item.budgetOverrun || utilization >= 100;
}

function groupApprovals(
  items: readonly ApprovalItem[],
): readonly { readonly label: string; readonly items: readonly ApprovalItem[] }[] {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const today: ApprovalItem[] = [];
  const yesterday: ApprovalItem[] = [];
  const earlier: ApprovalItem[] = [];

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (date >= startToday) today.push(item);
    else if (date >= startYesterday) yesterday.push(item);
    else earlier.push(item);
  }

  return [
    { label: "Hari ini", items: today },
    { label: "Kemarin", items: yesterday },
    { label: "Lebih lama", items: earlier },
  ].filter((group) => group.items.length > 0);
}
