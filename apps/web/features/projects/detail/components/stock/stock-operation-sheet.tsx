"use client";

import { useCan } from "@/components/auth/permissions-provider";
import { toast } from "sonner";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import {
  reserveMaterialForProject,
  returnMaterialFromProject,
  useMaterialForProject as recordMaterialUse,
  wasteMaterialForProject,
} from "@/app/actions/material/inventory";
import {
  ActionMenu,
  AppIcon,
  Button,
  MoneyValue,
  GroupedSurface,
  FactRow,
  ConfirmationDialog,
  FormField,
  FormRiskNotice,
  FormSection,
  type OperationSuccess,
  OperationSuccessDialog,
  QuantityStepper,
  SegmentedTabs,
  AdaptiveSelect,
  Textarea,
  WorkflowFormSheet,
} from "@/components/ui";
import { InventoryStockStatusCard } from "@/features/materials/components/shared/inventory-stock-status-card";
import { StockImpactRow } from "@/features/materials/components/shared/stock-impact-row";
import type { MaterialOption } from "../shared/rap-rab-manager";
import type { ProjectStockRap } from "./project-stock-types";
import { allowedProjectStockOperations } from "./project-stock-desktop-model";

type Operation = "RESERVE" | "USE" | "RETURN" | "WASTE";

const LABELS: Record<Operation, string> = {
  RESERVE: "Reservasi",
  USE: "Pakai",
  RETURN: "Kembalikan",
  WASTE: "Terbuang",
};
const CONTEXT_HELPERS: Record<Operation, string> = {
  RESERVE: "Pilih kebutuhan RAP dan lokasi stok yang akan disiapkan untuk proyek ini.",
  USE: "Pilih kebutuhan RAP dan lokasi asal material yang benar-benar dipakai.",
  RETURN: "Pilih kebutuhan RAP dan lokasi penerima sisa material proyek.",
  WASTE: "Pilih kebutuhan RAP dan lokasi stok material yang rusak atau tidak dapat digunakan.",
};
const DETAIL_HELPERS: Record<Operation, string> = {
  RESERVE: "Reservasi mengurangi stok tersedia tanpa mengubah stok fisik.",
  USE: "Pemakaian mengurangi stok fisik dan dicatat sebagai biaya proyek.",
  RETURN: "Pengembalian menambah stok fisik dan membalik biaya pemakaian terkait.",
  WASTE: "Stok fisik berkurang permanen dan alasan disimpan pada audit trail.",
};

export function StockOperationSheet({
  projectId,
  rap,
  materials,
  onWorkflowActiveChange,
}: {
  readonly projectId: string;
  readonly rap: ProjectStockRap | null;
  readonly materials: readonly MaterialOption[];
  readonly onWorkflowActiveChange?: (active: boolean) => void;
}): React.JSX.Element | null {
  const can = useCan();
  const desktop = useWorkspacePresentation() === "desktop";
  const router = useRouter();
  const [operation, setOperation] = useState<Operation | null>(null);
  const [rapItemId, setRapItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmWaste, setConfirmWaste] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [success, setSuccess] = useState<OperationSuccess | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [pending, startTransition] = useTransition();
  const allowedOperations = allowedProjectStockOperations(can);
  const canOperate = allowedOperations.length > 0;
  const rapItem = rap?.items.find((item) => item.id === rapItemId) ?? null;
  const material = materials.find((item) => item.id === rapItem?.materialId) ?? null;
  const inventories = material?.inventories ?? [];
  const inventory = inventories.find((item) => item.locationId === locationId) ?? null;
  const estimatedImpact = (Number(quantity) || 0) * (inventory?.averageCost ?? 0);
  const valid = Boolean(
    operation &&
    rapItem?.materialId &&
    inventory &&
    Number(quantity) > 0 &&
    note.trim().length >= (operation === "WASTE" ? 10 : 3),
  );
  const disabledReason = !rapItem?.materialId
    ? "Pilih RAP material agar pergerakan stok masuk ke kebutuhan proyek yang benar."
    : !inventory
      ? "Pilih lokasi inventori agar stok tidak berubah dari lokasi yang salah."
      : Number(quantity) <= 0
        ? "Isi jumlah material lebih dari 0."
        : note.trim().length < (operation === "WASTE" ? 10 : 3)
          ? operation === "WASTE"
            ? "Alasan material terbuang minimal 10 karakter."
            : "Tambahkan catatan singkat minimal 3 karakter."
          : undefined;
  const money = useMemo(
    () =>
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }),
    [],
  );
  const rapOptions =
    rap?.items
      .filter((item) => item.materialId)
      .map((item) => ({
        value: item.id,
        label: `${item.name}`,
        description: item.area,
        meta: `${item.totalQuantity} ${item.unit}`,
      })) ?? [];
  const inventoryOptions = inventories.map((row) => ({
    value: row.locationId,
    label: row.locationName,
    description: `Tersedia ${row.availableStock.toLocaleString("id-ID")}`,
    meta: `Avg ${money.format(row.averageCost)}`,
  }));
  useEffect((): void => {
    onWorkflowActiveChange?.(
      Boolean(operation || confirmWaste || confirmClose || success || pending),
    );
  }, [operation, confirmWaste, confirmClose, success, pending, onWorkflowActiveChange]);
  useEffect(() => (): void => onWorkflowActiveChange?.(false), [onWorkflowActiveChange]);
  if (!canOperate) return null;

  function open(next: Operation): void {
    if (pending || !allowedOperations.includes(next)) return;
    const defaultRapItemId = rapOptions.length === 1 ? (rapOptions[0]?.value ?? "") : "";
    const defaultRapItem = rap?.items.find((item) => item.id === defaultRapItemId) ?? null;
    const defaultMaterial =
      materials.find((item) => item.id === defaultRapItem?.materialId) ?? null;
    const defaultLocationId =
      defaultMaterial?.inventories.length === 1
        ? (defaultMaterial.inventories[0]?.locationId ?? "")
        : "";
    setOperation(next);
    setRapItemId(defaultRapItemId);
    setLocationId(defaultLocationId);
    setQuantity("");
    setNote("");
    setMessage(null);
    setReviewing(false);
  }
  function close(): void {
    if (pending) return;
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (quantity || note) {
      setConfirmClose(true);
      return;
    }
    setOperation(null);
  }
  function submit(): void {
    if (
      pending ||
      !operation ||
      !allowedOperations.includes(operation) ||
      !rapItem?.materialId ||
      !inventory ||
      !valid
    )
      return;
    if (operation === "WASTE" && !confirmWaste) {
      setConfirmWaste(true);
      return;
    }
    const materialId = rapItem.materialId;
    startTransition(async () => {
      const input = {
        projectId,
        materialId,
        projectRapItemId: rapItem.id,
        inventoryLocationId: inventory.locationId,
        quantity: Number(quantity),
        note: note.trim(),
      };
      const result =
        operation === "RESERVE"
          ? await reserveMaterialForProject(input)
          : operation === "USE"
            ? await recordMaterialUse(input)
            : operation === "RETURN"
              ? await returnMaterialFromProject(input)
              : await wasteMaterialForProject(input);
      setConfirmWaste(false);
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      const label = LABELS[operation];
      toast.success(`${label} berhasil dicatat.`);
      setSuccess({
        title: `${label} berhasil dicatat`,
        description: "Pergerakan stok dan audit trail telah dibuat dalam satu transaksi.",
        facts: [
          { label: "Material", value: material?.name ?? "Material" },
          { label: "Jumlah", value: `${Number(quantity).toLocaleString("id-ID")} ${rapItem.unit}` },
          { label: "Status", value: "Sudah diposting" },
        ],
      });
      setOperation(null);
      setReviewing(false);
      router.refresh();
    });
  }

  return (
    <>
      {desktop ? (
        <ActionMenu
          label="Operasi stok proyek"
          trigger={
            <Button
              type="button"
              size="compact"
              variant="secondary"
              disabled={!rapOptions.length || pending}
              trailingIcon={<AppIcon name="expand_more" />}
            >
              Operasi stok
            </Button>
          }
          items={allowedOperations.map((key) => ({
            id: key,
            label: LABELS[key],
            tone: key === "WASTE" ? "critical" : "default",
            onSelect: (): void => open(key),
          }))}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
          {allowedOperations.map((key) => (
            <button
              key={key}
              type="button"
              disabled={!rapOptions.length || pending}
              onClick={() => open(key)}
              className={`rounded-full px-3 py-3 text-xs font-bold ${key === "WASTE" ? "bg-error-container/10 text-error ring-1 ring-white/15" : "bg-white/10 text-white ring-1 ring-white/15"}`}
            >
              {LABELS[key]}
            </button>
          ))}
        </div>
      )}
      <WorkflowFormSheet
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <div className="space-y-3">
            <div className="px-1">
              <h3 className="text-support font-semibold text-on-surface">Ringkasan operasi stok</h3>
              <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
                {rapItem?.name ?? "Pilih material RAP"}
              </p>
            </div>
            <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Operasi"
                  value={operation ? LABELS[operation] : "Belum dipilih"}
                />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Lokasi"
                  value={inventory?.locationName ?? "Belum dipilih"}
                />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Jumlah"
                  value={`${quantity || 0} ${rapItem?.unit ?? material?.unit ?? "unit"}`}
                />
                {inventory && (
                  <FactRow
                    layout="stacked"
                    wrapLabel
                    label={operation === "RESERVE" ? "Stok tersedia" : "Stok fisik"}
                    value={`${(operation === "RESERVE" ? inventory.availableStock : inventory.currentStock).toLocaleString("id-ID")} ${rapItem?.unit ?? material?.unit ?? "unit"}`}
                  />
                )}
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Nilai dampak"
                  value={
                    inventory ? (
                      <MoneyValue
                        fractionDigits={Number.isInteger(estimatedImpact) ? 0 : 2}
                        amount={estimatedImpact}
                        variant="fullDynamic"
                        size="sm"
                        align="right"
                      />
                    ) : (
                      "Pilih lokasi untuk melihat nilai"
                    )
                  }
                />
              </div>
            </GroupedSurface>
            <p className="px-1 text-support text-on-surface-variant">
              {operation
                ? DETAIL_HELPERS[operation]
                : "Pilih operasi stok untuk melihat dampaknya."}{" "}
              Pembayaran tetap memakai alur kas.
            </p>
          </div>
        }
        dismissal={{ mode: "managed" }}
        open={Boolean(operation)}
        title={
          reviewing
            ? `Tinjau ${operation ? LABELS[operation] : "Operasi"}`
            : operation
              ? LABELS[operation]
              : "Operasi Material"
        }
        onClose={close}
        pending={pending}
        disabled={!valid}
        disabledReason={disabledReason}
        danger={operation === "WASTE" && reviewing}
        primaryLabel={reviewing ? "Catat" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Memproses…"
        onPrimary={() => (reviewing ? submit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-md">
            <FormSection
              title="Tinjau operasi material"
              helper="Periksa kebutuhan proyek, lokasi, dan jumlah sebelum mencatat."
            >
              <ReviewFact label="RAP material" value={rapItem?.name ?? "–"} />
              <ReviewFact label="Lokasi" value={inventory?.locationName ?? "–"} />
              <ReviewFact
                label="Jumlah"
                value={`${Number(quantity).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${rapItem?.unit ?? material?.unit ?? "unit"}`}
              />
              {note.trim() ? <ReviewFact label="Catatan" value={note} /> : null}
            </FormSection>
            <StockImpactRow
              label={operation === "RESERVE" ? "Stok tersedia" : "Stok fisik"}
              before={
                operation === "RESERVE"
                  ? (inventory?.availableStock ?? 0)
                  : (inventory?.currentStock ?? 0)
              }
              delta={operation === "RETURN" ? Number(quantity) : -Number(quantity)}
              after={
                (operation === "RESERVE"
                  ? (inventory?.availableStock ?? 0)
                  : (inventory?.currentStock ?? 0)) +
                (operation === "RETURN" ? Number(quantity) : -Number(quantity))
              }
              reserved={operation === "RESERVE" ? undefined : inventory?.reservedStock}
              unit={rapItem?.unit ?? material?.unit}
            />
            <FormRiskNotice
              title={
                operation === "WASTE"
                  ? "Material terbuang tercatat permanen"
                  : "Perubahan siap dicatat"
              }
              tone={operation === "WASTE" ? "danger" : operation === "USE" ? "warning" : "default"}
            >
              Nilai dampak {money.format(estimatedImpact)}. Pastikan jumlah, lokasi, dan RAP sudah
              benar.
            </FormRiskNotice>
          </div>
        ) : (
          <div className="space-y-md">
            {message && (
              <p className="rounded-2xl bg-error-container/30 p-3 text-xs leading-5 text-error">
                {message}
              </p>
            )}
            <SegmentedTabs
              value={operation ?? "RESERVE"}
              onChange={(key) => {
                setOperation(key);
                setMessage(null);
              }}
              ariaLabel="Operasi stok"
              options={allowedOperations.map((key) => ({
                value: key,
                label: LABELS[key],
              }))}
            />
            <FormSection
              title="Material proyek"
              helper={operation ? CONTEXT_HELPERS[operation] : "Pilih konteks operasi material."}
            >
              <AdaptiveSelect
                label="RAP material"
                value={rapItemId}
                onChange={(value) => {
                  setRapItemId(value);
                  setLocationId("");
                }}
                options={rapOptions}
                placeholder="Pilih kebutuhan material"
                required
              />
              <AdaptiveSelect
                label="Lokasi inventori"
                value={locationId}
                disabled={!material}
                onChange={setLocationId}
                options={inventoryOptions}
                placeholder={material ? "Pilih lokasi" : "Pilih RAP material lebih dulu"}
                required
              />
            </FormSection>
            {inventory && (
              <InventoryStockStatusCard
                locationName={inventory.locationName}
                currentStock={inventory.currentStock}
                reservedStock={inventory.reservedStock}
                availableStock={inventory.availableStock}
                unit={rapItem?.unit ?? material?.unit}
              />
            )}
            {operation === "USE" || operation === "WASTE" ? (
              <FormRiskNotice
                title={
                  operation === "WASTE"
                    ? "Material terbuang mengunci audit trail"
                    : "Pemakaian mengurangi stok tersedia"
                }
                tone={operation === "WASTE" ? "danger" : "warning"}
              >
                Pastikan jumlah dan lokasi benar agar stok tidak berkurang dari tempat yang salah
                dan biaya proyek tidak tampak bocor.
              </FormRiskNotice>
            ) : null}
            <FormSection
              title="Jumlah dan catatan"
              helper={
                operation ? DETAIL_HELPERS[operation] : "Lengkapi jumlah dan catatan operasi."
              }
            >
              <FormField label="Jumlah" required>
                <QuantityStepper
                  value={quantity}
                  unit={rapItem?.unit ?? material?.unit}
                  min={0}
                  step={1}
                  onChange={setQuantity}
                />
              </FormField>
              <FormField
                label={
                  operation === "WASTE"
                    ? "Alasan material terbuang"
                    : operation === "RETURN"
                      ? "Catatan pengembalian"
                      : operation === "USE"
                        ? "Catatan pemakaian"
                        : "Catatan reservasi"
                }
                helper={
                  operation === "WASTE"
                    ? "Wajib spesifik, minimal 10 karakter."
                    : "Wajib, minimal 3 karakter."
                }
                required
              >
                <Textarea
                  rows={3}
                  value={note}
                  onChange={setNote}
                  placeholder={
                    operation === "WASTE"
                      ? "Jelaskan penyebab, kondisi, dan lokasi material terbuang"
                      : "Jelaskan tujuan atau konteks operasi material"
                  }
                  required
                />
              </FormField>
            </FormSection>
          </div>
        )}
      </WorkflowFormSheet>
      <ConfirmationDialog
        open={confirmWaste}
        title="Konfirmasi material terbuang"
        description={`Stok akan berkurang dan ${money.format(estimatedImpact)} tetap menjadi biaya proyek. Aksi ini tercatat di audit log.`}
        confirmLabel="Catat Material Terbuang"
        danger
        pending={pending}
        onClose={() => setConfirmWaste(false)}
        onConfirm={submit}
      />
      <ConfirmationDialog
        open={confirmClose}
        title="Buang perubahan operasi material?"
        description="Data yang belum dicatat akan hilang."
        confirmLabel="Buang Perubahan"
        danger
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          setOperation(null);
        }}
      />
      <OperationSuccessDialog success={success} onClose={() => setSuccess(null)} />
    </>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
