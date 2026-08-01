"use client";

import { toast } from "sonner";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  reserveMaterialForProject,
  returnMaterialFromProject,
  useMaterialForProject as recordMaterialUse,
  wasteMaterialForProject,
} from "@/app/actions/material/inventory";
import {
  ConfirmationSheet,
  FieldContextLine,
  FormRiskNotice,
  FormSection,
  WorkflowFormSheet,
} from "@/components/ui";
import { FormField, QuantityStepper, SheetSelect, Textarea } from "@/components/ui";
import { OperationSuccessSheet, type OperationSuccess } from "@/components/ui";
import { StockImpactRow } from "@/features/materials/components/shared/stock-impact-row";
import { SegmentedTabs } from "@/components/ui/navigation/segmented-tabs";
import type { MaterialOption, RapView } from "../shared/rap-rab-manager";

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
  userRole,
}: {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly materials: readonly MaterialOption[];
  readonly userRole: string;
}): React.JSX.Element | null {
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
  const canOperate =
    userRole === "OWNER" || userRole === "FINANCE_ADMIN" || userRole === "PURCHASING";
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
  if (!canOperate) return null;

  function open(next: Operation): void {
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
    if (!operation || !rapItem?.materialId || !inventory || !valid) return;
    if (operation === "WASTE" && !confirmWaste) {
      setConfirmWaste(true);
      return;
    }
    startTransition(async () => {
      const input = {
        projectId,
        materialId: rapItem.materialId as string,
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
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        {(Object.keys(LABELS) as Operation[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => open(key)}
            className={`rounded-full px-3 py-3 text-xs font-bold ${key === "WASTE" ? "bg-error-container/10 text-error ring-1 ring-white/15" : "bg-white/10 text-white ring-1 ring-white/15"}`}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <WorkflowFormSheet
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
              options={(Object.keys(LABELS) as Operation[]).map((key) => ({
                value: key,
                label: LABELS[key],
              }))}
            />
            <FormSection
              title="Material proyek"
              helper={operation ? CONTEXT_HELPERS[operation] : "Pilih konteks operasi material."}
            >
              <SheetSelect
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
              <SheetSelect
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
              <FieldContextLine tone={inventory.availableStock <= 0 ? "danger" : "success"}>
                Fisik {inventory.currentStock.toLocaleString("id-ID")} · Reservasi{" "}
                {inventory.reservedStock.toLocaleString("id-ID")} · Tersedia{" "}
                {inventory.availableStock.toLocaleString("id-ID")}
              </FieldContextLine>
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
              <FormField
                label={
                  (rapItem?.unit ?? material?.unit)
                    ? `Jumlah (${rapItem?.unit ?? material?.unit})`
                    : "Jumlah"
                }
                required
              >
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
      <ConfirmationSheet
        open={confirmWaste}
        title="Konfirmasi material terbuang"
        description={`Stok akan berkurang dan ${money.format(estimatedImpact)} tetap menjadi biaya proyek. Aksi ini tercatat di audit log.`}
        confirmLabel="Catat Material Terbuang"
        danger
        pending={pending}
        onClose={() => setConfirmWaste(false)}
        onConfirm={submit}
      />
      <ConfirmationSheet
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
      <OperationSuccessSheet success={success} onClose={() => setSuccess(null)} />
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
