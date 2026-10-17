"use client";

import React from "react";
import {
  AppIcon,
  Badge,
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  SectionHeader,
  SegmentedTabs,
  StatusBadge,
} from "@/components/ui";
import type {
  ProjectCategoryPlanItemView,
  RapItemView,
  RapOverviewFilter,
  RapSetupStage,
  RapView,
} from "../../types/rap-rab-types";
import {
  isPackageScopeReady,
  isRapSetupStageUnlocked,
  RAP_SETUP_STAGES,
  sumPackageCost,
} from "../../utils/rap-setup-utils";
import {
  countMaterialsNeedingPurchase,
  materialDesktopRows,
  packageDesktopRows,
  type RapDesktopRow,
} from "./rap-desktop-model";
import { RapAmount, RapDesktopTable } from "./rap-desktop-table";

// THESIS: Compare the internal plan and its next decision without mobile card repetition.
// OWN-WORLD: Existing Atria Operate; compact white panels, native HeroUI tables and ink capsules.
// STORY: Read plan cost, inspect source quantities and open the existing explicit editor.
// FIRST VIEWPORT: One divided cost band, meaningful stage rail, toolbar and table with exact context.
// FORM: Established responsive workspace extension; no identity or concept seed required.
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.

interface RapSetupControls {
  readonly activeStage: RapSetupStage;
  readonly onStageChange: (stage: RapSetupStage) => void;
  readonly isPending: boolean;
  readonly canEditCategoryPlan: boolean;
  readonly onAddMaterial: () => void;
  readonly onEditMaterial?: (item: RapItemView) => void;
  readonly onEditPackage?: (item: ProjectCategoryPlanItemView) => void;
  readonly onAddPackage: (category: "TUKANG" | "SUBCON") => void;
  readonly onAdvance: (stage: "TUKANG" | "SUBCON" | "REVIEW") => void;
  readonly onScopeSkip: (category: "TUKANG" | "SUBCON", skipped: boolean) => void;
  readonly canFinalize: boolean;
  readonly onFinalize: () => void;
}

export function RapDesktopWorkspace({
  rap,
  plannedCost,
  tukangPlanItems,
  subconPlanItems,
  canEditRap,
  onMaterialOpen,
  onPackageOpen,
  setup,
  overviewFilter = "MATERIAL",
  onOverviewFilterChange,
  canRevise = false,
  onRevise,
}: {
  readonly rap: RapView;
  readonly plannedCost: number;
  readonly tukangPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly subconPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly canEditRap: boolean;
  readonly onMaterialOpen: (id: string) => void;
  readonly onPackageOpen: (id: string) => void;
  readonly setup?: RapSetupControls;
  readonly overviewFilter?: RapOverviewFilter;
  readonly onOverviewFilterChange?: (filter: RapOverviewFilter) => void;
  readonly canRevise?: boolean;
  readonly onRevise?: () => void;
}): React.JSX.Element {
  const tukangCost = sumPackageCost(tukangPlanItems);
  const subconCost = sumPackageCost(subconPlanItems);
  const totalCost = plannedCost + tukangCost + subconCost;
  const neededCount = countMaterialsNeedingPurchase(rap.items);
  const materialRows = React.useMemo(() => materialDesktopRows(rap.items), [rap.items]);
  const tukangRows = React.useMemo(
    () => packageDesktopRows(tukangPlanItems, "TUKANG"),
    [tukangPlanItems],
  );
  const subconRows = React.useMemo(
    () => packageDesktopRows(subconPlanItems, "SUBCON"),
    [subconPlanItems],
  );
  const active = setup?.activeStage ?? overviewFilter;
  const openRow = (row: RapDesktopRow): void =>
    row.material ? onMaterialOpen(row.id) : onPackageOpen(row.id);
  const reviewRows: readonly {
    readonly stage: "MATERIAL" | "TUKANG" | "SUBCON";
    readonly label: string;
    readonly count: number;
    readonly cost: number;
    readonly skipped: boolean;
    readonly ready: boolean;
  }[] = [
    {
      stage: "MATERIAL",
      label: "Material",
      count: rap.items.length,
      cost: plannedCost,
      skipped: false,
      ready: rap.items.length > 0,
    },
    {
      stage: "TUKANG",
      label: "Tukang",
      count: tukangPlanItems.length,
      cost: tukangCost,
      skipped: rap.tukangScopeSkipped,
      ready: isPackageScopeReady({ skipped: rap.tukangScopeSkipped, items: tukangPlanItems }),
    },
    {
      stage: "SUBCON",
      label: "Subcon",
      count: subconPlanItems.length,
      cost: subconCost,
      skipped: rap.subconScopeSkipped,
      ready: isPackageScopeReady({ skipped: rap.subconScopeSkipped, items: subconPlanItems }),
    },
  ];
  const readyToFinalize = reviewRows.every((row) => row.ready);
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rencana pelaksanaan internal</h2>
          <p className="mt-1 text-support text-on-surface-variant">
            Revisi {rap.revision} · Estimasi biaya pelaksanaan, terpisah dari nilai penawaran klien.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={setup ? "DRAFT" : "APPROVED"}>
            {setup ? "Dalam penyusunan" : "Terkunci"}
          </Badge>
          {!setup && canEditRap && canRevise && (
            <Button type="button" variant="secondary" size="compact" onClick={onRevise}>
              Buat revisi RAP
            </Button>
          )}
        </div>
      </div>
      <GroupedSurface variant="desktopPanel" className="p-4">
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/20">
          {[
            { label: "Total rencana", value: totalCost },
            { label: "Material", value: plannedCost },
            { label: "Tukang", value: tukangCost },
            { label: "Subcon", value: subconCost },
          ].map((fact, index) => (
            <div key={fact.label} className={`min-w-0 ${index === 0 ? "pr-4" : "px-4 last:pr-0"}`}>
              <dt className="text-support text-on-surface-variant">{fact.label}</dt>
              <dd className="mt-1">
                <MoneyValue
                  amount={fact.value}
                  fractionDigits={Number.isInteger(fact.value) ? 0 : 2}
                  variant="compact"
                  size="lg"
                  align="left"
                />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-outline-variant/20 pt-3 text-support text-on-surface-variant">
          {rap.items.length} material · {tukangPlanItems.length + subconPlanItems.length} paket ·{" "}
          {neededCount > 0
            ? `${neededCount} material perlu dibeli`
            : rap.items.length > 0
              ? "Kebutuhan material tertutup stok tersedia"
              : "Belum ada kebutuhan material"}
        </p>
      </GroupedSurface>
      {setup ? (
        <div className="space-y-2">
          <SegmentedTabs
            value={setup.activeStage}
            onChange={setup.onStageChange}
            ariaLabel="Tahap setup RAP desktop"
            options={RAP_SETUP_STAGES.map((stage, index) => ({
              value: stage,
              label: `${index + 1}. ${stage === "MATERIAL" ? "Material" : stage === "TUKANG" ? "Tukang" : stage === "SUBCON" ? "Subcon" : "Tinjau & finalisasi"}`,
              disabled: setup.isPending || !isRapSetupStageUnlocked({ stageIndex: index, rap }),
            }))}
          />
          <p className="px-1 text-support text-on-surface-variant">
            Selesaikan tiap lingkup sebelum membuka tahap berikutnya. Finalisasi mengunci rencana
            internal.
          </p>
        </div>
      ) : (
        <SegmentedTabs
          value={overviewFilter}
          onChange={(filter): void => onOverviewFilterChange?.(filter)}
          ariaLabel="Detail RAP desktop"
          options={reviewRows.map((row) => ({
            value: row.stage,
            label: row.label,
            count: row.count,
            countLabel: row.stage === "MATERIAL" ? "material" : "paket",
          }))}
        />
      )}
      <RapDesktopTable
        kind="MATERIAL"
        planning={Boolean(setup)}
        pending={setup?.isPending}
        onEdit={
          setup && canEditRap && setup.onEditMaterial
            ? (row): void => {
                if (row.material) setup.onEditMaterial?.(row.material);
              }
            : undefined
        }
        rows={materialRows}
        active={active === "MATERIAL"}
        onOpen={openRow}
        action={
          setup && canEditRap ? (
            <Button
              type="button"
              size="compact"
              variant="secondary"
              disabled={setup.isPending}
              leadingIcon={<AppIcon name="add" />}
              onClick={setup.onAddMaterial}
            >
              Tambah material
            </Button>
          ) : undefined
        }
      />
      <RapDesktopTable
        kind="TUKANG"
        planning={Boolean(setup)}
        pending={setup?.isPending}
        onEdit={
          setup?.canEditCategoryPlan && setup.onEditPackage
            ? (row): void => {
                if (row.package) setup.onEditPackage?.(row.package);
              }
            : undefined
        }
        rows={tukangRows}
        skipped={rap.tukangScopeSkipped}
        active={active === "TUKANG"}
        onOpen={openRow}
        action={
          setup && setup.canEditCategoryPlan && !rap.tukangScopeSkipped ? (
            <Button
              type="button"
              size="compact"
              variant="secondary"
              disabled={setup.isPending}
              leadingIcon={<AppIcon name="add" />}
              onClick={(): void => setup.onAddPackage("TUKANG")}
            >
              Tambah paket
            </Button>
          ) : undefined
        }
      />
      <RapDesktopTable
        kind="SUBCON"
        planning={Boolean(setup)}
        pending={setup?.isPending}
        onEdit={
          setup?.canEditCategoryPlan && setup.onEditPackage
            ? (row): void => {
                if (row.package) setup.onEditPackage?.(row.package);
              }
            : undefined
        }
        rows={subconRows}
        skipped={rap.subconScopeSkipped}
        active={active === "SUBCON"}
        onOpen={openRow}
        action={
          setup && setup.canEditCategoryPlan && !rap.subconScopeSkipped ? (
            <Button
              type="button"
              size="compact"
              variant="secondary"
              disabled={setup.isPending}
              leadingIcon={<AppIcon name="add" />}
              onClick={(): void => setup.onAddPackage("SUBCON")}
            >
              Tambah paket
            </Button>
          ) : undefined
        }
      />
      {setup && active === "REVIEW" && (
        <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-4">
          <section className="min-w-0 space-y-3">
            <SectionHeader title="Tinjau lingkup" />
            <GroupedSurface variant="desktopPanel" className="divide-y divide-outline-variant/20">
              {reviewRows.map((row) => (
                <div key={row.stage} className="flex min-w-0 items-center gap-3 p-4">
                  <AppIcon
                    name={row.ready ? "check_circle" : "warning"}
                    className={`icon-sm shrink-0 ${row.ready ? "text-on-surface-variant" : "text-warning"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="mt-1 text-support text-on-surface-variant">
                      {row.skipped
                        ? "Lingkup tidak digunakan"
                        : `${row.count} ${row.stage === "MATERIAL" ? "material" : "paket"} · ${row.ready ? "Siap ditinjau" : "Belum lengkap"}`}
                    </p>
                  </div>
                  <RapAmount amount={row.cost} />
                  <Button
                    type="button"
                    variant="quiet"
                    size="compact"
                    disabled={setup.isPending}
                    onClick={(): void => setup.onStageChange(row.stage)}
                  >
                    Tinjau {row.label.toLowerCase()}
                  </Button>
                </div>
              ))}
            </GroupedSurface>
          </section>
          <section className="min-w-0 space-y-3">
            <SectionHeader title="Finalisasi" />
            <GroupedSurface variant="desktopPanel" className="overflow-hidden">
              <FactRow label="Total rencana" value={<RapAmount amount={totalCost} exact />} />
              <div className="space-y-3 border-t border-outline-variant/20 p-4">
                <StatusBadge
                  label={readyToFinalize ? "Lingkup lengkap" : "Lingkup belum lengkap"}
                  tone={readyToFinalize ? "neutral" : "warning"}
                />
                <p className="text-support leading-relaxed text-on-surface-variant">
                  Rencana yang terkunci menjadi acuan pelaksanaan. Finalisasi tidak membuat
                  pembayaran atau gerakan stok.
                </p>
                {!setup.canFinalize && (
                  <p className="text-support text-on-surface-variant">
                    Menunggu pengguna dengan izin finalisasi RAP.
                  </p>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="compact"
                  fullWidth
                  disabled={
                    setup.isPending ||
                    !setup.canFinalize ||
                    !readyToFinalize ||
                    rap.setupStage !== "REVIEW"
                  }
                  onClick={setup.onFinalize}
                >
                  {setup.isPending ? "Memproses..." : "Finalisasi RAP"}
                </Button>
              </div>
            </GroupedSurface>
          </section>
        </div>
      )}
      {setup && active !== "REVIEW" && (
        <RapStageActions
          rap={rap}
          active={active}
          setup={setup}
          canEditRap={canEditRap}
          tukangPlanItems={tukangPlanItems}
          subconPlanItems={subconPlanItems}
        />
      )}
    </div>
  );
}

function RapStageActions({
  rap,
  active,
  setup,
  canEditRap,
  tukangPlanItems,
  subconPlanItems,
}: {
  readonly rap: RapView;
  readonly active: RapSetupStage;
  readonly setup: RapSetupControls;
  readonly canEditRap: boolean;
  readonly tukangPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly subconPlanItems: readonly ProjectCategoryPlanItemView[];
}): React.JSX.Element {
  const material = active === "MATERIAL";
  const category = active === "TUKANG" ? "TUKANG" : "SUBCON";
  const items = active === "TUKANG" ? tukangPlanItems : subconPlanItems;
  const skipped = active === "TUKANG" ? rap.tukangScopeSkipped : rap.subconScopeSkipped;
  const canEdit = material ? canEditRap : setup.canEditCategoryPlan;
  const ready = material ? rap.items.length > 0 : isPackageScopeReady({ skipped, items });
  const next = material ? "TUKANG" : active === "TUKANG" ? "SUBCON" : "REVIEW";
  const label = next === "REVIEW" ? "Tinjau & finalisasi" : next === "TUKANG" ? "Tukang" : "Subcon";
  return (
    <GroupedSurface
      variant="desktopPanel"
      className="flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <p className="min-w-0 flex-1 text-support text-on-surface-variant">
        {!canEdit
          ? "Akses baca. Perubahan tahap mengikuti izin RAP dan budget."
          : !ready
            ? material
              ? "Tambahkan material sebelum melanjutkan."
              : "Siapkan seluruh paket atau tandai lingkup ini tidak digunakan."
            : rap.setupStage !== active
              ? "Tahap ini sudah dilewati. Perubahan tetap mengikuti status item."
              : "Lingkup siap untuk dilanjutkan ke tahap berikutnya."}
      </p>
      <div className="flex flex-wrap gap-2">
        {!material && canEdit && (skipped || items.length === 0) && (
          <Button
            type="button"
            size="compact"
            variant="secondary"
            disabled={setup.isPending}
            onClick={(): void => setup.onScopeSkip(category, !skipped)}
          >
            {skipped ? "Gunakan lingkup ini" : "Lingkup tidak digunakan"}
          </Button>
        )}
        <Button
          type="button"
          size="compact"
          variant="primary"
          disabled={setup.isPending || !canEdit || !ready || rap.setupStage !== active}
          onClick={(): void => setup.onAdvance(next)}
        >
          Lanjut ke {label}
        </Button>
      </div>
    </GroupedSurface>
  );
}
