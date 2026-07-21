"use client";

import React from "react";
import { AlertTriangle, ArrowRight, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

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
  return (
    <ChevronRight className="text-on-surface-variant/45 h-4 w-4 shrink-0" aria-hidden="true" />
  );
}

function statusClass(tone: ActivityStatusTone): string {
  if (tone === "SUCCESS") return "bg-success-light text-success";
  if (tone === "PENDING") return "bg-warning-light text-warning";
  if (tone === "WARNING") return "bg-warning-light text-warning";
  if (tone === "DANGER") return "bg-error-container/35 text-error";
  return "bg-surface-container text-on-surface-variant";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Value({
  value,
  align = "right",
}: {
  readonly value: ActivityValue;
  readonly align?: "left" | "right";
}): React.JSX.Element {
  if (value.type === "MONEY")
    return (
      <MoneyValue
        amount={value.value}
        variant="compactWithFull"
        size="sm"
        align={align}
        tone={value.value < 0 ? "danger" : "default"}
      />
    );
  if (value.type === "QUANTITY")
    return (
      <span
        className={`${align === "right" ? "text-right" : "text-left"} text-on-surface font-mono text-xs font-bold whitespace-nowrap tabular-nums`}
      >
        {value.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
        {value.unit ? ` ${value.unit}` : ""}
      </span>
    );
  if (value.type === "DATE")
    return (
      <span
        className={`${align === "right" ? "text-right" : "text-left"} text-on-surface text-xs leading-4 font-semibold`}
      >
        {formatDate(value.value)}
      </span>
    );
  return (
    <span
      className={`${align === "right" ? "text-right" : "text-left"} text-on-surface min-w-0 text-xs leading-5 font-semibold wrap-break-word whitespace-pre-wrap`}
    >
      {value.value}
    </span>
  );
}

function Facts({ facts }: { readonly facts: readonly ActivityFact[] }): React.JSX.Element | null {
  if (facts.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-black/2.5">
      <div className="divide-outline-variant/20 divide-y">
        {facts.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3 px-4 py-3"
          >
            <span className="text-on-surface-variant text-[11px] leading-4 font-semibold">
              {item.label}
            </span>
            <Value value={item.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonRows({
  comparisons,
}: {
  readonly comparisons: readonly ActivityComparison[];
}): React.JSX.Element | null {
  if (comparisons.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-on-surface-variant px-1 text-[10px] font-bold tracking-[0.12em] uppercase">
        Perubahan
      </h3>
      <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-black/2.5">
        <div className="divide-outline-variant/20 divide-y">
          {comparisons.map((item, index) => (
            <div key={`${item.label}-${index}`} className="px-4 py-3">
              <p className="text-on-surface-variant text-[11px] font-semibold">{item.label}</p>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-2">
                <div className="bg-surface-container-low rounded-[16px] px-3 py-2">
                  <p className="text-on-surface-variant mb-1 text-[8px] font-bold tracking-wide uppercase">
                    Sebelum
                  </p>
                  <Value value={item.before} align="left" />
                </div>
                <ArrowRight className="text-on-surface-variant/50 h-4 w-4" aria-hidden="true" />
                <div className="bg-primary/5.5 rounded-[16px] px-3 py-2">
                  <p className="text-primary mb-1 text-[8px] font-bold tracking-wide uppercase">
                    Sesudah
                  </p>
                  <Value value={item.after} align="left" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DetailSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-label="Memuat detail aktivitas">
      <div className="rounded-[24px] bg-white p-4">
        <div className="bg-surface-container h-4 w-32 animate-pulse rounded-full" />
        <div className="bg-surface-container-low mt-2 h-3 w-48 animate-pulse rounded-full" />
      </div>
      <div className="overflow-hidden rounded-[24px] bg-white">
        <div className="divide-outline-variant/20 divide-y">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex min-h-14 items-center justify-between gap-4 px-4">
              <div className="bg-surface-container h-3 w-20 animate-pulse rounded-full" />
              <div className="bg-surface-container h-3 w-28 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailContent({ detail }: { readonly detail: ActivityDetailView }): React.JSX.Element {
  return (
    <div className="space-y-4 pb-1">
      <section className="rounded-[24px] bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-black/2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-on-surface text-[15px] leading-5 font-semibold wrap-break-word">
              {detail.title}
            </p>
            <p className="text-on-surface-variant mt-0.5 text-[11px] leading-4">
              {detail.subtitle}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wide uppercase ${statusClass(detail.statusTone)}`}
          >
            {formatBusinessLabel(detail.status)}
          </span>
        </div>
        <div className="border-outline-variant/20 mt-3 grid grid-cols-2 gap-3 border-t pt-3">
          <div>
            <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
              Pelaku
            </p>
            <p className="text-on-surface mt-0.5 truncate text-xs font-semibold">
              {detail.actorName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
              Waktu
            </p>
            <p className="text-on-surface mt-0.5 text-[10px] leading-4 font-semibold">
              {formatDate(detail.occurredAt)}
            </p>
          </div>
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-on-surface-variant px-1 text-[10px] font-bold tracking-[0.12em] uppercase">
          Fakta transaksi
        </h3>
        <Facts facts={detail.facts} />
      </section>
      <ComparisonRows comparisons={detail.comparisons} />
      {detail.impacts.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-on-surface-variant px-1 text-[10px] font-bold tracking-[0.12em] uppercase">
            Dampak bisnis
          </h3>
          <Facts facts={detail.impacts} />
        </section>
      ) : null}
      {detail.notes.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-on-surface-variant px-1 text-[10px] font-bold tracking-[0.12em] uppercase">
            Catatan & bukti
          </h3>
          <Facts facts={detail.notes} />
        </section>
      ) : null}
      {detail.evidenceIncomplete ? (
        <div className="bg-warning-light text-warning flex gap-3 rounded-[20px] px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-[11px] leading-4">
            Data perubahan historis belum tercatat lengkap. Nilai yang ditampilkan hanya fakta yang
            dapat dibuktikan dari record canonical.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ActivityDetailProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [request, setRequest] = React.useState<ActivityDetailRequest | null>(null);
  const [presentedRequest, setPresentedRequest] = React.useState<ActivityDetailRequest | null>(
    null,
  );
  const [detail, setDetail] = React.useState<ActivityDetailView | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestSequence = React.useRef(0);

  const load = React.useCallback(async (target: ActivityDetailRequest): Promise<void> => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    setDetail(null);
    const result = await getActivityDetail(target);
    if (sequence !== requestSequence.current) return;
    if (result.success) setDetail(result.data);
    else setError(result.error.message);
    setLoading(false);
  }, []);

  const openActivityDetail = React.useCallback(
    (target: ActivityDetailRequest): void => {
      setPresentedRequest(target);
      setRequest(target);
      void load(target);
    },
    [load],
  );

  const context = React.useMemo(() => ({ openActivityDetail }), [openActivityDetail]);
  const source = detail?.source ?? null;

  const isAlreadyOnSourcePage = React.useMemo(() => {
    if (!source) return false;
    try {
      const url = new URL(source.href, "http://localhost");
      if (url.pathname !== pathname) return false;
      for (const [key, value] of url.searchParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    } catch {
      return false;
    }
  }, [source, pathname, searchParams]);

  return (
    <ActivityDetailContext.Provider value={context}>
      {children}
      <BottomSheet
        open={request !== null}
        title="Detail aktivitas"
        onClose={() => {
          requestSequence.current += 1;
          setRequest(null);
        }}
        onExitComplete={() => {
          if (!request) {
            setPresentedRequest(null);
            setDetail(null);
            setError(null);
          }
        }}
        footer={
          source && !isAlreadyOnSourcePage ? (
            <button
              type="button"
              onClick={() => {
                setRequest(null);
                router.push(source.href);
              }}
              className="bg-primary focus-visible:ring-primary/30 min-h-12 w-full rounded-full px-5 text-xs font-bold text-white outline-none focus-visible:ring-2"
            >
              {source.label}
            </button>
          ) : undefined
        }
      >
        {loading ? (
          <DetailSkeleton />
        ) : error ? (
          <div className="rounded-[24px] bg-white px-4 py-5 text-center shadow-[0_10px_28px_rgba(17,17,17,0.04)]">
            <AlertTriangle className="text-error mx-auto h-5 w-5" aria-hidden="true" />
            <p className="text-on-surface mt-2 text-sm font-semibold">Detail belum dapat dimuat</p>
            <p className="text-on-surface-variant mt-1 text-[11px] leading-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                if (presentedRequest) void load(presentedRequest);
              }}
              className="bg-surface-container text-on-surface mt-3 inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-xs font-bold"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Coba lagi
            </button>
          </div>
        ) : detail ? (
          <DetailContent detail={detail} />
        ) : (
          <DetailSkeleton />
        )}
      </BottomSheet>
    </ActivityDetailContext.Provider>
  );
}
