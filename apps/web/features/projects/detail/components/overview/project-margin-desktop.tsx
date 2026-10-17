"use client";

import React from "react";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import type { ProjectMarginData } from "@atria/core/types/project-margin";
import {
  AppIcon,
  Button,
  DesktopTable,
  FactRow,
  GroupedSurface,
  MoneyValue,
  PageState,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { ProjectOverviewTab } from "./project-overview";
import { ProjectCategoryDesktopDetail } from "./project-overview-desktop";
import {
  marginCategoryContext,
  marginFinalSnapshot,
  marginSource,
  marginVerdict,
} from "./project-margin-desktop-model";

function percent(value: number): string {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function Amount({
  amount,
  large = false,
}: {
  readonly amount: number;
  readonly large?: boolean;
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      variant="compact"
      size={large ? "xl" : "sm"}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      tone={amount < 0 ? "danger" : "default"}
    />
  );
}

export function ProjectMarginDesktop({
  budget,
  marginData,
  projectStatus,
  selectedCategoryId,
  onCategorySelect,
  onCategoryClose,
  onNavigate,
  onRetry,
}: {
  readonly budget: ProjectBudgetDashboard | null;
  readonly marginData?: ProjectMarginData;
  readonly projectStatus: string;
  readonly selectedCategoryId: string | null;
  readonly onCategorySelect: (id: string) => void;
  readonly onCategoryClose: () => void;
  readonly onNavigate: (tab: ProjectOverviewTab) => void;
  readonly onRetry: () => void;
}): React.JSX.Element {
  const wide = useWorkspaceViewportAtLeast(1280);
  const source = marginSource(marginData, budget);
  const available = source.status === "ready" ? budget : null;
  const category = marginCategoryContext(available?.categories ?? [], selectedCategoryId);
  const detailOnly = !wide && category !== null;
  const final = marginFinalSnapshot(projectStatus, marginData);
  const summary = final
    ? {
        contractValue: Number(final.contractValue),
        internalBudget: Number(final.internalBudget),
        projectedMarginAmount: Number(final.realizedMarginAmount),
        projectedMarginPercentage: Number(final.realizedMarginPercentage),
        targetGrossPercentage: Number(final.targetGrossPercentage),
        targetGrossAmount: Number(final.targetGrossAmount),
        actualCost: Number(final.actualCost),
        remainingBudget: Number(final.remainingBudget),
        status: "COMPLETED",
      }
    : available;
  if (!summary) {
    return (
      <PageState
        compact
        kind={
          source.status === "restricted"
            ? "restricted"
            : source.status === "missing"
              ? "first-use"
              : "error"
        }
        title={
          source.status === "restricted"
            ? "Akses margin terbatas"
            : source.status === "missing"
              ? "Budget internal belum terbentuk"
              : "Margin belum dapat dimuat"
        }
        description={
          source.message ?? "Kondisi margin belum dapat dipastikan tanpa rincian budget proyek."
        }
        actionLabel={source.status === "unavailable" ? "Coba lagi" : undefined}
        onAction={source.status === "unavailable" ? onRetry : undefined}
      />
    );
  }
  const margin = summary.projectedMarginAmount;
  const marginPercentage = summary.projectedMarginPercentage;
  const targetPercentage = summary.targetGrossPercentage;
  const targetAmount = summary.targetGrossAmount;
  const actual = summary.actualCost;
  const remaining = summary.remainingBudget;
  const verdict = marginVerdict(margin, marginPercentage, targetPercentage);

  return (
    <div className="min-w-0 space-y-4 select-text">
      <GroupedSurface variant="desktopPanel" className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section font-semibold">
            {final ? "Margin akhir tersimpan" : "Posisi margin proyek"}
          </h2>
          <StatusBadge
            label={final ? "Proyek selesai" : verdict.label}
            tone={final ? "neutral" : verdict.tone}
          />
        </div>
        <div className="grid min-w-0 grid-cols-[1.25fr_1fr_1fr_1fr] divide-x divide-outline-variant/25">
          <div className="min-w-0 space-y-1 pr-4">
            <p className="text-support text-on-surface-variant">
              {final ? "Margin realisasi" : "Margin proyeksi"}
            </p>
            <Amount amount={margin} large />
            <p className="text-support text-on-surface-variant tabular-nums">
              {percent(marginPercentage)} dari nilai kontrak
            </p>
          </div>
          <div className="min-w-0 space-y-1 px-4">
            <p className="text-support text-on-surface-variant">Target margin</p>
            <Amount amount={targetAmount} />
            <p className="text-support text-on-surface-variant tabular-nums">
              {percent(targetPercentage)} dari kontrak
            </p>
          </div>
          <div className="min-w-0 space-y-1 px-4">
            <p className="text-support text-on-surface-variant">Biaya terpakai</p>
            <Amount amount={actual} />
            <p className="text-support text-on-surface-variant">Beban budget, termasuk nonkas</p>
          </div>
          <div className="min-w-0 space-y-1 pl-4">
            <p className="text-support text-on-surface-variant">Sisa budget</p>
            <Amount amount={remaining} />
            <p className="text-support text-on-surface-variant">Budget internal − terpakai</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-outline-variant/25 pt-3 text-support text-on-surface-variant">
          <span className="inline-flex items-center gap-2">
            Nilai kontrak <Amount amount={summary.contractValue} />
          </span>
          <span className="inline-flex items-center gap-2">
            Budget internal <Amount amount={summary.internalBudget} />
          </span>
          {!final ? (
            <span>Budget {formatBusinessLabel(summary.status).toLocaleLowerCase("id-ID")}</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              Posisi kas saat ditutup <Amount amount={Number(final.cashPosition)} />
            </span>
          )}
        </div>
        <p className="mt-3 text-support leading-5 text-on-surface-variant">
          {final
            ? `Ringkasan saat proyek ditutup · ${new Date(final.snapshotAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })}.`
            : "Proyeksi = nilai kontrak − nilai yang lebih besar antara biaya terpakai dan budget internal. Ini bukan perkiraan biaya tersisa atau laba final."}
        </p>
      </GroupedSurface>
      {projectStatus === "COMPLETED" && !final ? (
        <PageState
          compact
          kind={marginData?.finalSnapshotSource.status === "unavailable" ? "error" : "partial"}
          title="Ringkasan akhir belum tersedia"
          description={
            marginData?.finalSnapshotSource.message ??
            "Angka di atas mengikuti budget saat ini. Ringkasan tersimpan saat penutupan belum tersedia dan tidak digantikan dengan proyeksi."
          }
          actionLabel={
            marginData?.finalSnapshotSource.status === "unavailable" ? "Coba lagi" : undefined
          }
          onAction={onRetry}
        />
      ) : null}
      {available ? (
        <section className="min-w-0 space-y-3" aria-label="Dampak kategori pada margin">
          <SectionHeader
            title="Biaya per kategori"
            meta={projectStatus === "COMPLETED" ? "Data budget saat ini" : "Lima kategori budget"}
          />
          <p className="px-1 text-support text-on-surface-variant">
            Bandingkan alokasi dengan beban budget. Rincian memisahkan pembayaran kas dan pengajuan
            menunggu keputusan.
          </p>
          {detailOnly ? (
            <Button size="compact" variant="secondary" onClick={onCategoryClose}>
              <AppIcon name="arrow_back" className="icon-sm" />
              Kembali ke kategori
            </Button>
          ) : null}
          <div
            className={`grid min-w-0 items-start gap-4 ${wide && category ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1"}`}
          >
            {!detailOnly ? (
              <DesktopTable
                ariaLabel="Perbandingan kategori terhadap margin"
                rows={available.categories}
                rowKey={(row) => row.id}
                layout="fixed"
                selectedRowKey={wide ? (category?.id ?? null) : null}
                onRowSelectionChange={(row) => {
                  if (row) onCategorySelect(row.id);
                  else onCategoryClose();
                }}
                emptyTitle="Alokasi kategori belum tersedia"
                emptyDescription="Kondisi kategori belum dapat dipastikan tanpa alokasi budget."
                columns={[
                  {
                    key: "category",
                    label: "Kategori",
                    widthPercent: 24,
                    render: (row) => (
                      <div className="space-y-1 wrap-anywhere">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-support text-on-surface-variant">
                          {percent(row.usedPercentage)} terpakai
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "allocation",
                    label: "Alokasi",
                    widthPercent: 18,
                    align: "end",
                    render: (row) => <Amount amount={row.allocatedAmount} />,
                  },
                  {
                    key: "actual",
                    label: "Terpakai",
                    widthPercent: 18,
                    align: "end",
                    render: (row) => <Amount amount={row.actualAmount} />,
                  },
                  {
                    key: "remaining",
                    label: "Sisa",
                    widthPercent: 18,
                    align: "end",
                    render: (row) => <Amount amount={row.remainingAmount} />,
                  },
                  {
                    key: "status",
                    label: "Kondisi",
                    widthPercent: 22,
                    render: (row) => (
                      <StatusBadge
                        label={formatBusinessLabel(row.status)}
                        tone={
                          row.status === "OVER_BUDGET"
                            ? "critical"
                            : row.status === "WATCH"
                              ? "warning"
                              : "healthy"
                        }
                      />
                    ),
                  },
                ]}
              />
            ) : null}
            {category ? (
              <ProjectCategoryDesktopDetail category={category} onNavigate={onNavigate} />
            ) : null}
          </div>
        </section>
      ) : (
        <PageState
          compact
          kind={source.status === "missing" ? "first-use" : "error"}
          title={
            source.status === "missing"
              ? "Budget saat ini belum tersedia"
              : "Kategori saat ini belum dapat dimuat"
          }
          description={
            source.message ??
            "Ringkasan akhir tetap menggunakan data tersimpan saat penutupan. Rincian kategori saat ini belum tersedia."
          }
          actionLabel={source.status === "unavailable" ? "Coba lagi" : undefined}
          onAction={source.status === "unavailable" ? onRetry : undefined}
        />
      )}
    </div>
  );
}

export function ProjectMarginDesktopCash({
  marginData,
  onRetry,
}: {
  readonly marginData?: ProjectMarginData;
  readonly onRetry: () => void;
}): React.JSX.Element {
  const source = marginData?.cashSource;
  const cash = source?.status === "ready" ? marginData?.cash : null;
  return (
    <section className="min-w-0 space-y-3" aria-label="Realisasi kas proyek">
      <SectionHeader title="Realisasi kas" meta="Data saat ini" />
      <GroupedSurface variant="desktopPanel">
        {cash ? (
          <>
            <div className="divide-y divide-outline-variant/20">
              {[
                { label: "Dana klien diterima", amount: cash.received },
                { label: "Pengeluaran kas", amount: cash.paid },
                { label: "Posisi kas bersih", amount: cash.position },
              ].map((fact) => (
                <FactRow
                  key={fact.label}
                  label={fact.label}
                  value={
                    <MoneyValue
                      amount={fact.amount}
                      variant="fullDynamic"
                      size="md"
                      fractionDigits={Number.isInteger(fact.amount) ? 0 : 2}
                      tone={fact.amount < 0 ? "danger" : "default"}
                    />
                  }
                />
              ))}
            </div>
            <p className="border-t border-outline-variant/20 p-4 text-support leading-5 text-on-surface-variant">
              Posisi kas bukan laba. Pemakaian stok nonkas memengaruhi budget, tanpa otomatis
              menjadi pembayaran kas.
            </p>
          </>
        ) : (
          <PageState
            compact
            kind={source?.status === "restricted" ? "restricted" : "error"}
            title={
              source?.status === "restricted"
                ? "Akses kas terbatas"
                : "Realisasi kas belum dapat dimuat"
            }
            description={
              source?.message ??
              "Total proyek hanya ditampilkan setelah seluruh sumber kas dapat dibaca."
            }
            actionLabel={source?.status === "unavailable" ? "Coba lagi" : undefined}
            onAction={onRetry}
          />
        )}
      </GroupedSurface>
    </section>
  );
}

function MarginSkeletonLine({
  className = "",
}: {
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`rounded-full bg-surface-container-high motion-safe:animate-pulse ${className}`}
    />
  );
}

export function ProjectMarginDesktopLoading(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Memuat margin proyek"
      className="min-w-0 space-y-4"
    >
      <div aria-hidden="true" inert className="space-y-4">
        <GroupedSurface variant="desktopPanel" className="space-y-4 p-4">
          <MarginSkeletonLine className="h-5 w-44" />
          <div className="grid grid-cols-4 gap-5">
            {["margin", "target", "actual", "remaining"].map((id) => (
              <div key={id} className="space-y-2">
                <MarginSkeletonLine className="h-3 w-24" />
                <MarginSkeletonLine className="h-6 w-28" />
                <MarginSkeletonLine className="h-3 w-32" />
              </div>
            ))}
          </div>
          <MarginSkeletonLine className="h-3 w-3/4" />
        </GroupedSurface>
        <MarginSkeletonLine className="h-5 w-40" />
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <DesktopTable
            ariaLabel="Memuat biaya kategori"
            rows={["material", "tukang", "operations", "other", "subcon"].map((id) => ({ id }))}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "name",
                label: "Kategori",
                render: () => <MarginSkeletonLine className="my-2 h-4 w-24" />,
              },
              ...["Alokasi", "Terpakai", "Sisa", "Kondisi"].map((label) => ({
                key: label,
                label,
                render: (): React.JSX.Element => <MarginSkeletonLine className="h-3 w-16" />,
              })),
            ]}
          />
          <GroupedSurface variant="desktopPanel" className="hidden space-y-5 p-4 xl:block">
            <MarginSkeletonLine className="h-5 w-32" />
            {["allocation", "actual", "remaining", "pending", "paid"].map((id) => (
              <MarginSkeletonLine key={id} className="h-4 w-full" />
            ))}
            <MarginSkeletonLine className="h-8 w-full" />
          </GroupedSurface>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_22rem] items-start gap-4">
          {["cash", "closing"].map((id) => (
            <GroupedSurface key={id} variant="desktopPanel" className="space-y-4 p-4">
              <MarginSkeletonLine className="h-5 w-36" />
              <MarginSkeletonLine className="h-3 w-full" />
              <MarginSkeletonLine className="h-3 w-4/5" />
              <MarginSkeletonLine className="h-8 w-40" />
            </GroupedSurface>
          ))}
        </div>
      </div>
      <span className="sr-only">Memuat margin proyek…</span>
    </div>
  );
}
