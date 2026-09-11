"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { getActivityDetail } from "@/app/actions/activity-detail";
import {
  AppIcon,
  DetailSheet,
  Button,
  MoneyValue,
  SheetFooterActions,
  useSheetPresenceValue,
} from "@/components/ui";
import type {
  ActivityComparison,
  ActivityDetailRequest,
  ActivityDetailView,
  ActivityFact,
  ActivityStatusTone,
  ActivityValue,
} from "@atria/core/activity-detail/types";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { isActivityDetailSourceRepresentedInCurrentContext } from "../utils/activity-detail-source-navigation";

type ActivityDetailSheetProps = {
  readonly target: ActivityDetailRequest | null;
  readonly actions?: ActivityDetailSheetActions;
  readonly footerStatus?: ActivityDetailFooterStatus;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
};

export type ActivityDetailSheetActions = {
  readonly primary: {
    readonly label: string;
    readonly onClick: () => void;
  };
  readonly secondary?: {
    readonly label: string;
    readonly onClick: () => void;
  };
};

export type ActivityDetailFooterStatus = {
  readonly label: string;
  readonly tone?: "neutral" | "pending" | "success" | "danger";
};

function ActivityDetailStatusFooter({
  status,
}: {
  readonly status: ActivityDetailFooterStatus;
}): React.JSX.Element {
  const toneClass =
    status.tone === "pending"
      ? "text-warning"
      : status.tone === "success"
        ? "text-success"
        : status.tone === "danger"
          ? "text-error"
          : "text-on-surface-variant";

  return (
    <p
      role="status"
      className={`flex min-h-12 w-full items-center justify-center px-5 text-center text-xs leading-4 font-bold ${toneClass}`}
    >
      {status.label}
    </p>
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
        variant="fullDynamic"
        size="sm"
        align={align}
        tone={value.value < 0 ? "danger" : "default"}
      />
    );
  if (value.type === "QUANTITY")
    return (
      <span
        className={`${align === "right" ? "text-right" : "text-left"} font-mono text-xs font-bold whitespace-nowrap text-on-surface tabular-nums`}
      >
        {value.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
        {value.unit ? ` ${value.unit}` : ""}
      </span>
    );
  if (value.type === "DATE")
    return (
      <span
        className={`${align === "right" ? "text-right" : "text-left"} text-xs leading-4 font-semibold text-on-surface`}
      >
        {formatDate(value.value)}
      </span>
    );
  return (
    <span
      className={`${align === "right" ? "text-right" : "text-left"} min-w-0 text-xs leading-5 font-semibold wrap-break-word whitespace-pre-wrap text-on-surface`}
    >
      {value.value}
    </span>
  );
}

function Facts({ facts }: { readonly facts: readonly ActivityFact[] }): React.JSX.Element | null {
  if (facts.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
      <div className="divide-y divide-outline-variant/20">
        {facts.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3 px-4 py-3"
          >
            <span className="text-support font-semibold text-on-surface-variant">{item.label}</span>
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
      <h3 className="px-1 text-meta font-bold tracking-[0.12em] text-on-surface-variant uppercase">
        Perubahan
      </h3>
      <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
        <div className="divide-y divide-outline-variant/20">
          {comparisons.map((item, index) => (
            <div key={`${item.label}-${index}`} className="px-4 py-3">
              <p className="text-support font-semibold text-on-surface-variant">{item.label}</p>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-2">
                <div className="rounded-2xl bg-surface-container-low px-3 py-2">
                  <p className="mb-1 text-[8px] font-bold tracking-wide text-on-surface-variant uppercase">
                    Sebelum
                  </p>
                  <Value value={item.before} align="left" />
                </div>
                <AppIcon name="arrow_forward" className="h-4 w-4 text-on-surface-variant/50" />
                <div className="rounded-2xl bg-primary/5.5 px-3 py-2">
                  <p className="mb-1 text-[8px] font-bold tracking-wide text-primary uppercase">
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
      <div className="rounded-3xl bg-white p-4">
        <div className="h-4 w-32 animate-pulse rounded-full bg-surface-container" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded-full bg-surface-container-low" />
      </div>
      <div className="overflow-hidden rounded-3xl bg-white">
        <div className="divide-y divide-outline-variant/20">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex min-h-14 items-center justify-between gap-4 px-4">
              <div className="h-3 w-20 animate-pulse rounded-full bg-surface-container" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-surface-container" />
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
      <section className="rounded-3xl bg-white px-4 py-3.5 shadow-surface ring-1 ring-ring-subtle">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-section font-semibold wrap-break-word text-on-surface">
              {detail.title}
            </p>
            <p className="mt-0.5 text-support text-on-surface-variant">{detail.subtitle}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-eyebrow font-bold tracking-wide uppercase ${statusClass(detail.statusTone)}`}
          >
            {formatBusinessLabel(detail.status)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-outline-variant/20 pt-3">
          <div>
            <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
              Pelaku
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-on-surface">
              {detail.actorName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
              Waktu
            </p>
            <p className="mt-0.5 text-meta font-semibold text-on-surface">
              {formatDate(detail.occurredAt)}
            </p>
          </div>
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="px-1 text-meta font-bold tracking-[0.12em] text-on-surface-variant uppercase">
          Rincian transaksi
        </h3>
        <Facts facts={detail.facts} />
      </section>
      <ComparisonRows comparisons={detail.comparisons} />
      {detail.impacts.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-meta font-bold tracking-[0.12em] text-on-surface-variant uppercase">
            Dampak bisnis
          </h3>
          <Facts facts={detail.impacts} />
        </section>
      ) : null}
      {detail.notes.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-meta font-bold tracking-[0.12em] text-on-surface-variant uppercase">
            Catatan & bukti
          </h3>
          <Facts facts={detail.notes} />
        </section>
      ) : null}
      {detail.evidenceIncomplete ? (
        <div className="flex gap-3 rounded-inset bg-warning-light px-3.5 py-3 text-warning">
          <AppIcon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-support">
            Riwayat lama belum menyimpan semua perubahan. Hanya data yang tersedia yang ditampilkan.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ActivityDetailSourceButton({
  source,
  pathname,
  onNavigate,
}: {
  readonly source: NonNullable<ActivityDetailView["source"]>;
  readonly pathname: string;
  readonly onNavigate: () => void;
}): React.JSX.Element | null {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");

  const isAlreadyOnSourcePage = React.useMemo(() => {
    return isActivityDetailSourceRepresentedInCurrentContext({
      sourceHref: source.href,
      pathname,
      activeTab,
    });
  }, [source, pathname, activeTab]);

  if (isAlreadyOnSourcePage) return null;

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {source.label}
    </button>
  );
}

function ActiveDetailSheetInner({
  target,
  open,
  actions,
  footerStatus,
  onClose,
  onExitComplete,
}: {
  readonly target: ActivityDetailRequest;
  readonly open: boolean;
  readonly actions?: ActivityDetailSheetActions;
  readonly footerStatus?: ActivityDetailFooterStatus;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const [retrySequence, setRetrySequence] = React.useState(0);
  const [state, setState] = React.useState<
    | { readonly status: "loading" }
    | { readonly status: "error"; readonly message: string }
    | { readonly status: "success"; readonly detail: ActivityDetailView }
  >({ status: "loading" });

  React.useEffect(() => {
    let active = true;
    void getActivityDetail(target)
      .then((result) => {
        if (!active) return;
        if (result.success) {
          setState({ status: "success", detail: result.data });
        } else {
          setState({ status: "error", message: result.error.message });
        }
      })
      .catch(() => {
        if (active) {
          setState({
            status: "error",
            message: "Koneksi terputus saat memuat detail aktivitas.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [target, retrySequence]);

  const source = state.status === "success" ? state.detail.source : null;

  return (
    <DetailSheet
      open={open}
      title="Detail aktivitas"
      onClose={onClose}
      onExitComplete={onExitComplete}
      footer={
        state.status === "success" && actions ? (
          <SheetFooterActions primary={actions.primary} secondary={actions.secondary} />
        ) : state.status === "success" && footerStatus ? (
          <ActivityDetailStatusFooter status={footerStatus} />
        ) : source ? (
          <React.Suspense fallback={null}>
            <ActivityDetailSourceButton
              source={source}
              pathname={pathname}
              onNavigate={() => {
                onClose();
                router.push(source.href);
              }}
            />
          </React.Suspense>
        ) : undefined
      }
    >
      {state.status === "loading" ? (
        <DetailSkeleton />
      ) : state.status === "error" ? (
        <div className="rounded-3xl bg-white px-4 py-5 text-center shadow-surface">
          <AppIcon name="warning" className="mx-auto h-5 w-5 text-error" />
          <p className="mt-2 text-sm font-semibold text-on-surface">Detail belum dapat dimuat</p>
          <p className="mt-1 text-support text-on-surface-variant">{state.message}</p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="mt-4"
            leadingIcon={<AppIcon name="refresh" className="h-4 w-4" />}
            onClick={() => {
              setState({ status: "loading" });
              setRetrySequence((current) => current + 1);
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : (
        <DetailContent detail={state.detail} />
      )}
    </DetailSheet>
  );
}

export function ActivityDetailSheet({
  target,
  actions,
  footerStatus,
  onClose,
  onExitComplete,
}: ActivityDetailSheetProps): React.JSX.Element | null {
  const identity = target ? `${target.kind}:${target.id}` : null;
  const {
    presentedValue: presentedTarget,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(target, identity);
  const completeExit = React.useCallback((): void => {
    handleExitComplete();
    onExitComplete?.();
  }, [handleExitComplete, onExitComplete]);

  if (!presentedTarget) return null;
  return (
    <ActiveDetailSheetInner
      key={`${presentedTarget.kind}:${presentedTarget.id}`}
      target={presentedTarget}
      open={open}
      actions={actions}
      footerStatus={footerStatus}
      onClose={onClose}
      onExitComplete={completeExit}
    />
  );
}
