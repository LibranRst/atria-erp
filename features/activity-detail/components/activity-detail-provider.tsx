"use client";

import React from "react";
import { AlertTriangle, ArrowRight, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { getActivityDetail } from "@/app/actions/activity-detail";
import { BottomSheet } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import type {
  ActivityComparison,
  ActivityDetailRequest,
  ActivityDetailView,
  ActivityFact,
  ActivityStatusTone,
  ActivityValue,
} from "@/lib/activity-detail/types";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

type ActivityDetailContextValue = {
  readonly openActivityDetail: (request: ActivityDetailRequest) => void;
};

const ActivityDetailContext = React.createContext<ActivityDetailContextValue>({
  openActivityDetail: () => undefined,
});

export function useActivityDetail(): ActivityDetailContextValue {
  return React.useContext(ActivityDetailContext);
}

export function ActivityDetailChevron(): React.JSX.Element {
  return <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant/45" aria-hidden="true" />;
}

function statusClass(tone: ActivityStatusTone): string {
  if (tone === "SUCCESS") return "bg-success-light text-success";
  if (tone === "PENDING") return "bg-warning-light text-warning";
  if (tone === "WARNING") return "bg-warning-light text-warning";
  if (tone === "DANGER") return "bg-error-container/35 text-error";
  return "bg-surface-container text-on-surface-variant";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Value({ value, align = "right" }: { readonly value: ActivityValue; readonly align?: "left" | "right" }): React.JSX.Element {
  if (value.type === "MONEY") return <MoneyValue amount={value.value} variant="compactWithFull" size="sm" align={align} tone={value.value < 0 ? "danger" : "default"} />;
  if (value.type === "QUANTITY") return <span className={`${align === "right" ? "text-right" : "text-left"} whitespace-nowrap font-mono text-xs font-bold tabular-nums text-on-surface`}>{value.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}{value.unit ? ` ${value.unit}` : ""}</span>;
  if (value.type === "DATE") return <span className={`${align === "right" ? "text-right" : "text-left"} text-xs font-semibold leading-4 text-on-surface`}>{formatDate(value.value)}</span>;
  return <span className={`${align === "right" ? "text-right" : "text-left"} min-w-0 whitespace-pre-wrap break-words text-xs font-semibold leading-5 text-on-surface`}>{value.value}</span>;
}

function Facts({ facts }: { readonly facts: readonly ActivityFact[] }): React.JSX.Element | null {
  if (facts.length === 0) return null;
  return <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-black/[0.025]"><div className="divide-y divide-outline-variant/20">{facts.map((item, index) => <div key={`${item.label}-${index}`} className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3 px-4 py-3"><span className="text-[11px] font-semibold leading-4 text-on-surface-variant">{item.label}</span><Value value={item.value} /></div>)}</div></div>;
}

function ComparisonRows({ comparisons }: { readonly comparisons: readonly ActivityComparison[] }): React.JSX.Element | null {
  if (comparisons.length === 0) return null;
  return <section className="space-y-2"><h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Perubahan</h3><div className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-black/[0.025]"><div className="divide-y divide-outline-variant/20">{comparisons.map((item, index) => <div key={`${item.label}-${index}`} className="px-4 py-3"><p className="text-[11px] font-semibold text-on-surface-variant">{item.label}</p><div className="mt-2 grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-2"><div className="rounded-[16px] bg-surface-container-low px-3 py-2"><p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-on-surface-variant">Sebelum</p><Value value={item.before} align="left" /></div><ArrowRight className="h-4 w-4 text-on-surface-variant/50" aria-hidden="true" /><div className="rounded-[16px] bg-primary/[0.055] px-3 py-2"><p className="mb-1 text-[8px] font-bold uppercase tracking-wide text-primary">Sesudah</p><Value value={item.after} align="left" /></div></div></div>)}</div></div></section>;
}

function DetailSkeleton(): React.JSX.Element {
  return <div className="space-y-4" aria-label="Memuat detail aktivitas"><div className="rounded-[24px] bg-white p-4"><div className="h-4 w-32 animate-pulse rounded-full bg-surface-container" /><div className="mt-2 h-3 w-48 animate-pulse rounded-full bg-surface-container-low" /></div><div className="overflow-hidden rounded-[24px] bg-white"><div className="divide-y divide-outline-variant/20">{[0, 1, 2, 3].map((item) => <div key={item} className="flex min-h-14 items-center justify-between gap-4 px-4"><div className="h-3 w-20 animate-pulse rounded-full bg-surface-container" /><div className="h-3 w-28 animate-pulse rounded-full bg-surface-container" /></div>)}</div></div></div>;
}

function DetailContent({ detail }: { readonly detail: ActivityDetailView }): React.JSX.Element {
  return <div className="space-y-4 pb-1"><section className="rounded-[24px] bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-black/[0.025]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-[15px] font-semibold leading-5 text-on-surface">{detail.title}</p><p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">{detail.subtitle}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${statusClass(detail.statusTone)}`}>{formatBusinessLabel(detail.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3"><div><p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Pelaku</p><p className="mt-0.5 truncate text-xs font-semibold text-on-surface">{detail.actorName}</p></div><div className="text-right"><p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Waktu</p><p className="mt-0.5 text-[10px] font-semibold leading-4 text-on-surface">{formatDate(detail.occurredAt)}</p></div></div></section><section className="space-y-2"><h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Fakta transaksi</h3><Facts facts={detail.facts} /></section><ComparisonRows comparisons={detail.comparisons} />{detail.impacts.length > 0 ? <section className="space-y-2"><h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Dampak bisnis</h3><Facts facts={detail.impacts} /></section> : null}{detail.notes.length > 0 ? <section className="space-y-2"><h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Catatan & bukti</h3><Facts facts={detail.notes} /></section> : null}{detail.evidenceIncomplete ? <div className="flex gap-3 rounded-[20px] bg-warning-light px-3.5 py-3 text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p className="text-[11px] leading-4">Data perubahan historis belum tercatat lengkap. Nilai yang ditampilkan hanya fakta yang dapat dibuktikan dari record canonical.</p></div> : null}</div>;
}

export function ActivityDetailProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const [request, setRequest] = React.useState<ActivityDetailRequest | null>(null);
  const [presentedRequest, setPresentedRequest] = React.useState<ActivityDetailRequest | null>(null);
  const [detail, setDetail] = React.useState<ActivityDetailView | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestSequence = React.useRef(0);

  const load = React.useCallback(async (target: ActivityDetailRequest): Promise<void> => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError(null); setDetail(null);
    const result = await getActivityDetail(target);
    if (sequence !== requestSequence.current) return;
    if (result.success) setDetail(result.data); else setError(result.error.message);
    setLoading(false);
  }, []);

  const openActivityDetail = React.useCallback((target: ActivityDetailRequest): void => {
    setPresentedRequest(target); setRequest(target); void load(target);
  }, [load]);

  const context = React.useMemo(() => ({ openActivityDetail }), [openActivityDetail]);
  const source = detail?.source ?? null;
  return <ActivityDetailContext.Provider value={context}>{children}<BottomSheet open={request !== null} title="Detail aktivitas" onClose={() => { requestSequence.current += 1; setRequest(null); }} onExitComplete={() => { if (!request) { setPresentedRequest(null); setDetail(null); setError(null); } }} footer={source ? <button type="button" onClick={() => { setRequest(null); router.push(source.href); }} className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary/30">{source.label}</button> : undefined}>{loading ? <DetailSkeleton /> : error ? <div className="rounded-[24px] bg-white px-4 py-5 text-center shadow-[0_10px_28px_rgba(17,17,17,0.04)]"><AlertTriangle className="mx-auto h-5 w-5 text-error" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-on-surface">Detail belum dapat dimuat</p><p className="mt-1 text-[11px] leading-4 text-on-surface-variant">{error}</p><button type="button" onClick={() => { if (presentedRequest) void load(presentedRequest); }} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Coba lagi</button></div> : detail ? <DetailContent detail={detail} /> : <DetailSkeleton />}</BottomSheet></ActivityDetailContext.Provider>;
}
