"use client";

/* THESIS: compare warehouse availability and project need before changing stock.
 * OWN-WORLD: inherited Atria Operate; cool canvas, Manrope, white grouped
 * owners, native HeroUI tables, ink capsules and restrained terracotta.
 * STORY: scan stock value/risk, inspect a location or RAP need, then use an
 * explicit existing receiving, project-stock, transfer or count workflow.
 * FIRST VIEWPORT: compact header/actions, one four-fact band, four peer tabs;
 * overview prioritizes stock attention beside decisions and recent movement.
 * FORM: the user's specified continuation of the accepted Atria desktop
 * grammar; complete comparison tables, wide context, narrow list/detail.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import React from "react";
import { useCan } from "@/components/auth/permissions-provider";
import { useActivityDetail } from "@/features/activity-detail/components/activity-detail-provider";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import {
  ActionMenu,
  AppIcon,
  Button,
  DesktopTable,
  GroupedSurface,
  MoneyValue,
  PageHeader,
  SegmentedTabs,
  StatusBadge,
  type ActionMenuItem,
} from "@/components/ui";
import type {
  CountView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import type { MaterialOperationDecision } from "../../types/material-dashboard-types";
import type { GroupedMaterial, MaterialTab } from "../../utils/material-ui-utils";
import {
  formatMaterialDate,
  formatMaterialQuantity,
  formatMovementType,
} from "../../utils/material-ui-utils";
import {
  MaterialDesktopInventory,
  MaterialDesktopNeeds,
  stockComparisonColumns,
} from "./material-desktop-comparisons";
import { materialStockComparisons } from "./material-desktop-model";
import { MaterialDesktopActivity } from "./material-desktop-activity";

function Amount({ value }: { readonly value: number }): React.JSX.Element {
  return (
    <MoneyValue
      amount={value}
      fractionDigits={Number.isInteger(value) ? 0 : 2}
      variant="compact"
      size="lg"
    />
  );
}

export function MaterialDesktopWorkspace({
  data,
  refreshToken = data,
  grouped,
  tab,
  active,
  suspended,
  pending,
  totalStockValue,
  availableValue,
  lowCount,
  onNavigate,
  onOperation,
  onOpenMaterial,
  onOpenReceipt,
  onDecision,
  onReload,
  onLoadCountDraft,
  activityReturnFocusRef,
  countToolbarFocusRef,
}: {
  readonly data: MaterialOperationsDashboard;
  readonly refreshToken?: object;
  readonly grouped: readonly GroupedMaterial[];
  readonly tab: MaterialTab;
  readonly active: boolean;
  readonly suspended: boolean;
  readonly pending: boolean;
  readonly totalStockValue: number;
  readonly availableValue: number;
  readonly lowCount: number;
  readonly onNavigate: (tab: MaterialTab) => void;
  readonly onOperation: (action: string) => void;
  readonly onOpenMaterial: (id: string) => void;
  readonly onOpenReceipt: (row: ReceiptView) => void;
  readonly onDecision: (decision: MaterialOperationDecision) => void;
  readonly onReload: () => void;
  readonly onLoadCountDraft: (row: CountView) => void;
  readonly activityReturnFocusRef?: React.RefObject<HTMLElement | null>;
  readonly countToolbarFocusRef?: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  const can = useCan();
  const canCreateLocation =
    can("manage:material_settings") && data.capabilities.canCreateLocation !== false;
  const shortagesReady = !data.shortagesSource || data.shortagesSource.status === "ready";
  const shortageCount = data.shortages.filter((row) => row.needToBuy > 0).length;
  const summary = data.activitySummary;
  const pendingCounts =
    summary?.pendingCounts ?? data.counts.filter((row) => row.status === "PENDING_APPROVAL").length;
  const pendingReversals =
    summary?.pendingReversals ??
    data.receipts.filter((row) => row.status === "REVERSAL_REQUESTED").length;
  function reviewPending(kind: "counts" | "receipts"): void {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "activity");
    url.searchParams.set("activity-kind", kind);
    url.searchParams.set(
      `activity-${kind}-status`,
      kind === "counts" ? "PENDING_APPROVAL" : "REVERSAL_REQUESTED",
    );
    url.searchParams.set(`activity-${kind}-page`, "1");
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  }
  const operations: readonly ActionMenuItem[] = [
    ...(data.capabilities.canOperate
      ? [
          {
            id: "RESERVE",
            label: "Reservasi proyek",
            icon: "inventory_2",
            description: "Ikat stok untuk kebutuhan RAP.",
          },
          {
            id: "USE",
            label: "Pakai material",
            icon: "construction",
            description: "Catat pemakaian stok proyek.",
          },
          {
            id: "RETURN",
            label: "Kembalikan material",
            icon: "assignment_return",
            description: "Kembalikan sisa stok dari proyek.",
          },
          {
            id: "WASTE",
            label: "Catat waste",
            icon: "delete_outline",
            description: "Catat material rusak atau terbuang.",
          },
        ].map((item) => ({
          ...item,
          onSelect: () => onOperation(item.id),
          disabledReason: pending ? "Tunggu proses selesai." : undefined,
        }))
      : []),
    ...(canCreateLocation
      ? [
          {
            id: "LOCATION",
            label: "Tambah lokasi",
            icon: "add_location_alt",
            description: "Siapkan lokasi penyimpanan.",
            onSelect: () => onOperation("LOCATION"),
            disabledReason: pending ? "Tunggu proses selesai." : undefined,
          },
        ]
      : []),
    ...(data.capabilities.canTransfer
      ? [
          {
            id: "TRANSFER",
            label: "Transfer stok",
            icon: "swap_horiz",
            onSelect: () => onOperation("TRANSFER"),
            disabledReason: pending ? "Tunggu proses selesai." : undefined,
          },
        ]
      : []),
    ...(data.capabilities.canCount
      ? [
          {
            id: "COUNT",
            label: "Stock opname",
            icon: "fact_check",
            onSelect: () => onOperation("COUNT"),
            disabledReason: pending ? "Tunggu proses selesai." : undefined,
          },
        ]
      : []),
    ...(data.capabilities.canEmergencyAdjust
      ? [
          {
            id: "ADJUST",
            label: "Penyesuaian darurat",
            icon: "tune",
            onSelect: () => onOperation("ADJUST"),
            disabledReason: pending ? "Tunggu proses selesai." : undefined,
          },
        ]
      : []),
  ];
  const priorities = React.useMemo(
    () =>
      materialStockComparisons(grouped, "ALL")
        .filter((row) => row.summary.status !== "AVAILABLE")
        .sort(
          (a, b) =>
            Number(b.summary.status === "OUT_OF_STOCK") -
              Number(a.summary.status === "OUT_OF_STOCK") ||
            a.material.name.localeCompare(b.material.name, "id-ID"),
        )
        .slice(0, 5),
    [grouped],
  );
  const attentionColumns = React.useMemo(
    () =>
      stockComparisonColumns
        .filter((column) => ["name", "available", "value", "status"].includes(column.key))
        .map((column) => ({
          ...column,
          widthPercent: column.key === "name" ? 38 : column.key === "available" ? 22 : 20,
          sortable: false,
        })),
    [],
  );

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Material & Stok"
        subtitle="Bandingkan posisi gudang, kebutuhan RAP, dan aktivitas material."
        action={
          <div className="flex items-center gap-2">
            {[
              {
                label: "Stok proyek",
                items: operations.filter((item) =>
                  ["RESERVE", "USE", "RETURN", "WASTE"].includes(item.id),
                ),
              },
              {
                label: "Gudang",
                items: operations.filter((item) =>
                  ["LOCATION", "TRANSFER", "COUNT", "ADJUST"].includes(item.id),
                ),
              },
            ]
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <ActionMenu
                  key={group.label}
                  label={group.label}
                  trigger={
                    <Button
                      ref={group.label === "Gudang" ? countToolbarFocusRef : undefined}
                      variant="secondary"
                      size="compact"
                      disabled={pending}
                    >
                      {group.label}
                      <AppIcon name="expand_more" className="icon-xs" />
                    </Button>
                  }
                  items={group.items}
                />
              ))}
            {data.capabilities.canReceive ? (
              <Button
                variant="primary"
                size="compact"
                disabled={pending}
                onClick={() => onOperation("RECEIVE")}
              >
                <AppIcon name="add" className="icon-sm" />
                Terima barang
              </Button>
            ) : null}
          </div>
        }
      />
      <GroupedSurface variant="desktopPanel">
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/30 p-4">
          <div className="min-w-0 pr-4">
            <dt className="text-support text-on-surface-variant">Nilai stok</dt>
            <dd className="mt-2">
              <Amount value={totalStockValue} />
            </dd>
          </div>
          <div className="min-w-0 px-4">
            <dt className="text-support text-on-surface-variant">Nilai tersedia</dt>
            <dd className="mt-2">
              <Amount value={availableValue} />
            </dd>
          </div>
          <div className="min-w-0 px-4">
            <dt className="text-support text-on-surface-variant">Posisi perlu perhatian</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums">{lowCount}</dd>
            <p className="mt-1 text-meta text-on-surface-variant">Per material / lokasi</p>
          </div>
          <div className="min-w-0 pl-4">
            <dt className="text-support text-on-surface-variant">Kebutuhan belum tertutup</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums">
              {shortagesReady ? shortageCount : "—"}
            </dd>
            <p className="mt-1 text-meta text-on-surface-variant">
              {shortagesReady ? "Baris RAP proyek" : "Data RAP belum tersedia"}
            </p>
          </div>
        </dl>
      </GroupedSurface>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={tab}
          onChange={onNavigate}
          ariaLabel="Tab Material dan Stok"
          density="compact"
          scrollable
          options={[
            { value: "overview", label: "Ringkasan" },
            {
              value: "inventory",
              label: "Inventori",
              count: grouped.length,
              countLabel: `${grouped.length} material`,
            },
            {
              value: "needs",
              label: "Kebutuhan",
              count: shortagesReady ? shortageCount : undefined,
              countLabel: `${shortageCount} baris RAP belum tertutup`,
            },
            { value: "activity", label: "Aktivitas" },
          ]}
        />
        <p className="text-support text-on-surface-variant">
          {data.capabilities.canOperate
            ? "Kontrol stok sesuai izin Anda"
            : "Akses sesuai izin Anda"}
        </p>
      </div>
      <div
        hidden={tab !== "overview"}
        inert={tab !== "overview"}
        className={tab === "overview" ? "min-w-0 space-y-4" : "hidden"}
      >
        {!shortagesReady ? (
          <GroupedSurface variant="desktopPanel" className="flex items-start gap-2 p-4">
            <AppIcon name="info" className="icon-sm shrink-0 text-warning" />
            <div className="min-w-0 space-y-1">
              <p className="text-support font-semibold">Kebutuhan RAP belum dapat disimpulkan</p>
              <p className="text-support text-on-surface-variant">
                {data.shortagesSource?.message ?? "Tinjau akses atau coba muat ulang data RAP."}
              </p>
            </div>
          </GroupedSurface>
        ) : null}
        <div className="grid min-w-0 items-start gap-4 min-[1024px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-section font-bold">Prioritas stok</h2>
              <Button variant="secondary" size="mini" onClick={() => onNavigate("inventory")}>
                Lihat inventori
                <AppIcon name="arrow_forward" className="icon-xs" />
              </Button>
            </div>
            <DesktopTable
              ariaLabel="Lima prioritas stok"
              rows={priorities}
              columns={attentionColumns}
              rowKey={(row) => row.id}
              onRowAction={(row) => onOpenMaterial(row.id)}
              selectedRowKey={null}
              layout="fixed"
              emptyTitle="Tidak ada posisi stok berisiko"
              emptyDescription={
                grouped.length
                  ? "Tidak ada stok menipis, habis, atau terikat dalam inventori yang dimuat."
                  : "Belum ada inventori untuk dinilai."
              }
              footer={
                <p className="text-support text-on-surface-variant">
                  Maksimal lima material prioritas dari {grouped.length} material.
                </p>
              }
            />
          </section>
          <div className="min-w-0 space-y-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-section font-bold">Tindak lanjut</h2>
                <StatusBadge
                  label={`${pendingCounts + pendingReversals} menunggu`}
                  tone={pendingCounts + pendingReversals > 0 ? "warning" : "neutral"}
                />
              </div>
              <GroupedSurface variant="desktopPanel" className="divide-y divide-outline-variant/30">
                {[
                  {
                    label: "Stock opname",
                    description: "Periksa selisih sebelum posting stok.",
                    value: pendingCounts,
                    kind: "counts",
                  },
                  {
                    label: "Pembatalan penerimaan",
                    description: "Periksa stok dan dampak sebelum keputusan.",
                    value: pendingReversals,
                    kind: "receipts",
                  },
                ].map((item) => (
                  <div key={item.kind} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-row font-semibold">{item.label}</p>
                      <p className="text-support text-on-surface-variant">{item.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-row font-semibold tabular-nums">{item.value}</span>
                      <Button
                        size="mini"
                        variant="secondary"
                        onClick={() =>
                          reviewPending(item.kind === "counts" ? "counts" : "receipts")
                        }
                      >
                        Tinjau
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="p-4">
                  <Button
                    variant="secondary"
                    size="compact"
                    fullWidth
                    onClick={() => onNavigate("activity")}
                  >
                    Tinjau aktivitas
                  </Button>
                </div>
              </GroupedSurface>
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-section font-bold">Pergerakan terbaru</h2>
                <span className="text-meta text-on-surface-variant">Preview 3 catatan</span>
              </div>
              <GroupedSurface variant="desktopPanel" className="divide-y divide-outline-variant/30">
                {data.movements.length ? (
                  data.movements.slice(0, 3).map((row) => (
                    <Button
                      key={row.id}
                      variant="ghost"
                      size="compact"
                      fullWidth
                      className="h-auto justify-start gap-3 px-4 py-3 text-left font-normal [&>span]:w-full"
                      aria-label={`Buka detail ${formatMovementType(row.movementType)}, ${row.materialName}, ${formatMaterialQuantity(row.quantity)} ${row.unit}`}
                      onClick={() => openActivityDetail({ kind: "STOCK_MOVEMENT", id: row.id })}
                    >
                      <span className="min-w-0 flex-1 space-y-1 whitespace-normal">
                        <span className="block text-support font-semibold">{row.materialName}</span>
                        <span className="flex items-start justify-between gap-2 text-meta text-on-surface-variant">
                          <span className="min-w-0">
                            {formatMovementType(row.movementType)} · {row.locationName}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatMaterialQuantity(row.quantity)} {row.unit}
                          </span>
                        </span>
                        <span className="block text-meta text-on-surface-variant">
                          {formatMaterialDate(row.createdAt)}
                        </span>
                      </span>
                      <AppIcon name="chevron_right" className="icon-xs shrink-0" />
                    </Button>
                  ))
                ) : (
                  <p className="p-4 text-support text-on-surface-variant">
                    Belum ada pergerakan stok yang dapat ditampilkan.
                  </p>
                )}
              </GroupedSurface>
            </section>
          </div>
        </div>
        <GroupedSurface
          variant="desktopPanel"
          className="flex items-center justify-between gap-4 p-4"
        >
          <div className="min-w-0">
            <h2 className="text-row font-semibold">Kebutuhan proyek</h2>
            <p className="mt-1 text-support text-on-surface-variant">
              {shortagesReady
                ? shortageCount
                  ? `${shortageCount} baris RAP belum tertutup. Tinjau per proyek sebelum reservasi atau pengadaan.`
                  : data.shortages.length
                    ? "Tidak ada kebutuhan belum tertutup pada RAP yang dimuat."
                    : "Belum ada baris RAP yang dapat dinilai."
                : "Kebutuhan RAP belum tersedia; kondisi terpenuhi belum dapat disimpulkan."}
            </p>
          </div>
          <Button variant="secondary" size="compact" onClick={() => onNavigate("needs")}>
            Tinjau kebutuhan
            <AppIcon name="arrow_forward" className="icon-xs" />
          </Button>
        </GroupedSurface>
      </div>
      <div
        hidden={tab !== "inventory"}
        inert={tab !== "inventory"}
        className={tab === "inventory" ? "min-w-0" : "hidden"}
      >
        <MaterialDesktopInventory
          data={data}
          active={active && tab === "inventory"}
          grouped={grouped}
          onOpenMaterial={onOpenMaterial}
        />
      </div>
      <div
        hidden={tab !== "needs"}
        inert={tab !== "needs"}
        className={tab === "needs" ? "min-w-0" : "hidden"}
      >
        <MaterialDesktopNeeds data={data} active={active && tab === "needs"} onReload={onReload} />
      </div>
      <div
        hidden={tab !== "activity"}
        inert={tab !== "activity"}
        className={tab === "activity" ? "min-w-0" : "hidden"}
      >
        <MaterialDesktopActivity
          returnFocusRef={activityReturnFocusRef}
          data={data}
          refreshToken={refreshToken}
          active={active && tab === "activity"}
          suspended={suspended}
          pending={pending}
          onOpenReceipt={onOpenReceipt}
          onDecision={onDecision}
          onLoadCountDraft={onLoadCountDraft}
        />
      </div>
    </div>
  );
}
