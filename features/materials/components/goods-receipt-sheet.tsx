"use client";

import React from "react";
import { ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { postGoodsReceipt } from "@/app/actions/material/goods-receipt";
import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  ConfirmationSheet,
  DatePickerField,
  FieldContextLine,
  FormField,
  FormRiskNotice,
  MoneyInput,
  QuantityStepper,
  SheetSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { MaterialSuccessSheet, StockImpactRow, type MaterialOperationSuccess } from "@/features/materials/components/material-form-patterns";
import {
  buildGoodsReceiptBillPrefill,
  type GoodsReceiptVendorBillOption,
} from "@/features/materials/lib/goods-receipt-prefill";
import { createClientId } from "@/lib/utils/client-id";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";

type RapOption = { readonly id: string; readonly materialId: string | null; readonly name: string; readonly area: string };
type ProjectOption = { readonly id: string; readonly name: string; readonly rapItems?: readonly RapOption[] };
type MaterialOption = { readonly id: string; readonly name: string; readonly unit?: string };
type Option = { readonly id: string; readonly name: string };
type ItemDraft = { readonly key: string; readonly materialId: string; readonly projectRapItemId: string; readonly quantity: number; readonly unitCost: number; readonly note: string };
type Props = {
  readonly projects: readonly ProjectOption[];
  readonly locations: readonly Option[];
  readonly materials: readonly MaterialOption[];
  readonly inventory: MaterialOperationsDashboard["inventory"];
  readonly vendorBills: readonly GoodsReceiptVendorBillOption[];
  readonly compact?: boolean;
  readonly showTrigger?: boolean;
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function newItem(): ItemDraft {
  return { key: createClientId("receipt-item"), materialId: "", projectRapItemId: "", quantity: 1, unitCost: 0, note: "" };
}

export function GoodsReceiptSheet({ projects, locations, materials, inventory, vendorBills, compact = false, showTrigger = true }: Props): React.JSX.Element {
  const router = useRouter();
  const urlAction = useUrlSearchParam("action");
  const showSheet = urlAction === "RECEIVE";
  const [open, setOpen] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [pendingProjectId, setPendingProjectId] = React.useState<string | null>(null);
  const [pendingVendorBillId, setPendingVendorBillId] = React.useState<string | null>(null);
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState("");
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [vendorBillId, setVendorBillId] = React.useState("");
  const [receiptNumber, setReceiptNumber] = React.useState(() => `GR/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`);
  const [receivedAt, setReceivedAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [items, setItems] = React.useState<readonly ItemDraft[]>([newItem()]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<MaterialOperationSuccess | null>(null);
  const [pending, startTransition] = React.useTransition();
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedVendorBill = vendorBills.find((bill) => bill.id === vendorBillId);
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const meaningfulItem = items.some((item) => item.materialId || item.unitCost > 0 || item.note.trim());
  const dirty = Boolean(projectId || vendorBillId || meaningfulItem || note.trim());
  const valid = Boolean(projectId && locationId && receiptNumber.trim().length >= 3 && items.length > 0 && items.every((item) => item.materialId && item.quantity > 0 && item.unitCost >= 0));
  const disabledReason = !projectId ? "Pilih project penerima material." : !locationId ? "Pilih lokasi inventori." : receiptNumber.trim().length < 3 ? "Nomor penerimaan minimal 3 karakter." : items.some((item) => !item.materialId || item.quantity <= 0 || item.unitCost < 0) ? "Lengkapi material, jumlah, dan harga setiap item." : undefined;
  const vendorBillOptions = [{ value: "", label: "Tanpa tagihan vendor", description: "Isi penerimaan secara manual." }, ...vendorBills.map((bill) => ({
    value: bill.id,
    label: bill.name,
    description: `${bill.vendorName} · ${money.format(bill.amount)}`,
    meta: bill.status === "PAID" ? "Lunas" : bill.status === "PARTIALLY_PAID" ? "Dibayar sebagian" : "Belum dibayar",
    group: bill.projectName,
  }))];
  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));
  const locationOptions = locations.map((location) => ({ value: location.id, label: location.name }));
  const materialOptions = materials.map((material) => ({ value: material.id, label: material.name, description: material.unit ? `Satuan ${material.unit}` : undefined }));
  const isSheetOpen = open || showSheet;

  function reset(): void {
    setProjectId("");
    setVendorBillId("");
    setLocationId(locations[0]?.id ?? "");
    setReceiptNumber(`GR/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`);
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setNote("");
    setItems([newItem()]);
    setMessage(null);
    setReviewing(false);
    setPendingVendorBillId(null);
  }

  const closeImmediately = React.useCallback((): void => {
    setOpen(false);
    if (new URLSearchParams(window.location.search).get("action") === "RECEIVE") updateUrlSearchParam("action", null, "push");
  }, []);

  function requestClose(): void {
    if (reviewing) { setReviewing(false); return; }
    if (dirty) { setConfirmClose(true); return; }
    closeImmediately();
  }

  function applyProject(nextProjectId: string): void {
    setProjectId(nextProjectId);
    setVendorBillId("");
    setItems([newItem()]);
    setEditingKey(null);
  }

  function changeProject(nextProjectId: string): void {
    if (projectId && projectId !== nextProjectId && meaningfulItem) { setPendingProjectId(nextProjectId); return; }
    applyProject(nextProjectId);
  }

  function applyVendorBill(bill: GoodsReceiptVendorBillOption): void {
    const prefill = buildGoodsReceiptBillPrefill(bill);
    const project = projects.find((row) => row.id === prefill.projectId);
    const rapLinkIsValid = Boolean(
      prefill.item.projectRapItemId &&
      project?.rapItems?.some((row) =>
        row.id === prefill.item.projectRapItemId &&
        row.materialId === prefill.item.materialId),
    );
    const item: ItemDraft = {
      key: createClientId("receipt-item"),
      ...prefill.item,
      projectRapItemId: rapLinkIsValid ? prefill.item.projectRapItemId : "",
    };
    setVendorBillId(bill.id);
    setProjectId(prefill.projectId);
    setItems([item]);
    setNote(prefill.receiptNote);
    setEditingKey(item.materialId ? null : item.key);
    setMessage(null);
  }

  function changeVendorBill(nextBillId: string): void {
    if (!nextBillId) {
      setVendorBillId("");
      return;
    }
    if (nextBillId === vendorBillId) return;
    const bill = vendorBills.find((row) => row.id === nextBillId);
    if (!bill) return;
    if (meaningfulItem || note.trim()) {
      setPendingVendorBillId(nextBillId);
      return;
    }
    applyVendorBill(bill);
  }

  function updateItem(key: string, patch: Partial<ItemDraft>): void {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function submit(): void {
    if (!valid) return;
    setReviewing(false);
    startTransition(async () => {
      const result = await postGoodsReceipt({
        vendorBillId: vendorBillId || null,
        projectId,
        inventoryLocationId: locationId,
        receiptNumber,
        receivedAt: new Date(receivedAt),
        note: note || null,
        items: items.map((item) => ({ materialId: item.materialId, projectRapItemId: item.projectRapItemId || null, quantity: item.quantity, unitCost: item.unitCost, note: item.note || null })),
      });
      if (!result.success) { setMessage(result.error.message); toast.error(result.error.message); setReviewing(false); return; }
      setSuccess({
        title: "Penerimaan barang berhasil",
        description: "Stok, harga rata-rata, movement, dan audit trail telah diperbarui dalam satu transaksi.",
        facts: [
          { label: "Nomor", value: receiptNumber },
          { label: "Material", value: `${items.length} item` },
          { label: "Total", value: money.format(total) },
          { label: "Status", value: "Sudah diposting" },
        ],
      });
      toast.success("Penerimaan barang berhasil diposting.");
      closeImmediately();
      router.refresh();
    });
  }

  function launch(): void { reset(); setOpen(true); }

  const impacts = Array.from(new Set(items.map((item) => item.materialId).filter(Boolean))).map((materialId) => {
    const row = inventory.find((item) => item.materialId === materialId && item.locationId === locationId);
    const quantity = items.filter((item) => item.materialId === materialId).reduce((sum, item) => sum + item.quantity, 0);
    return { materialId, row, quantity };
  });

  return (
    <>
      {showTrigger ? (
        <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={launch} className={compact ? "min-h-12 rounded-full bg-white px-4 text-xs font-bold text-primary ring-1 ring-primary/15" : "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary"}>
          {!compact ? <Plus className="h-4 w-4" aria-hidden="true" /> : null} Terima Barang
        </motion.button>
      ) : null}
      <WorkflowFormSheet
        open={isSheetOpen}
        title={reviewing ? "Tinjau Penerimaan Barang" : "Penerimaan Barang"}
        onClose={requestClose}
        primaryLabel={reviewing ? "Posting Penerimaan Barang" : "Tinjau Penerimaan"}
        secondaryLabel={reviewing ? "Kembali Mengedit" : undefined}
        pendingLabel="Memposting…"
        pending={pending}
        disabled={!valid}
        disabledReason={disabledReason}
        onPrimary={() => reviewing ? submit() : setReviewing(true)}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-md">
            <div className="rounded-2xl bg-primary/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Penerimaan</p>
              <p className="mt-1 text-sm font-bold">{selectedProject?.name}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">{locations.find((row) => row.id === locationId)?.name} · {receiptNumber}</p>
              {selectedVendorBill ? <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">Tagihan {selectedVendorBill.name} · {selectedVendorBill.vendorName}</p> : null}
              <p className="mt-2 text-xl font-bold tabular-nums">{money.format(total)}</p>
            </div>
            <div className="space-y-2">
              {impacts.map(({ materialId, row, quantity }) => <StockImpactRow key={materialId} label={row?.materialName ?? materials.find((item) => item.id === materialId)?.name ?? "Material"} before={row?.currentStock ?? 0} delta={quantity} after={(row?.currentStock ?? 0) + quantity} reserved={row?.reservedStock} unit={row?.unit} />)}
            </div>
            <FormRiskNotice title="Posting mengubah stok" tone="warning">Harga rata-rata bergerak dan stok fisik langsung bertambah. Setelah diposting, koreksi dilakukan melalui permintaan reversal, bukan edit langsung.</FormRiskNotice>
          </div>
        ) : (
          <div className="space-y-md">
            {message ? <p className="rounded-2xl bg-error-container/30 p-3 text-xs leading-5 text-error" role="alert">{message}</p> : null}
            <SheetSelect label="Tagihan vendor" optional value={vendorBillId} options={vendorBillOptions} onChange={changeVendorBill} placeholder="Tanpa tagihan vendor" searchPlaceholder="Cari nomor, vendor, atau project..." />
            {selectedVendorBill ? (
              <FieldContextLine tone={selectedVendorBill.materialId ? "success" : "warning"}>
                {selectedVendorBill.materialId
                  ? "Project, material, tautan RAP, nominal, dan catatan sudah diprefill dari tagihan."
                  : "Project, nominal, dan catatan sudah diprefill. Pilih material yang benar sebelum posting."}
              </FieldContextLine>
            ) : null}
            <SheetSelect label="Project" value={projectId} options={projectOptions} onChange={changeProject} placeholder="Pilih project" required />
            <SheetSelect label="Lokasi inventori" value={locationId} options={locationOptions} onChange={setLocationId} placeholder="Pilih lokasi" required />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormField label="Nomor penerimaan" required><TextInput value={receiptNumber} onChange={setReceiptNumber} /></FormField>
              <DatePickerField label="Tanggal diterima" value={receivedAt} onChange={setReceivedAt} required />
            </div>
            <section className="space-y-2">
              <div className="flex items-end justify-between gap-3 px-1">
                <div><p className="text-[10px] font-bold uppercase tracking-wide">Material diterima</p><p className="mt-0.5 text-[10px] text-on-surface-variant">Buka satu item untuk mengubah detail.</p></div>
                <p className="text-xs font-bold text-primary">{money.format(total)}</p>
              </div>
              {items.map((item, index) => {
                const material = materials.find((row) => row.id === item.materialId);
                const complete = Boolean(item.materialId && item.quantity > 0 && item.unitCost >= 0);
                return (
                  <div key={item.key} className="overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/10">
                    <button type="button" onClick={() => setEditingKey((current) => current === item.key ? null : item.key)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30" aria-expanded={editingKey === item.key}>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-primary" : "bg-warning"}`} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{material?.name ?? `Material ${index + 1}`}</span><span className="mt-0.5 block text-[10px] text-on-surface-variant">{complete ? `${item.quantity.toLocaleString("id-ID")} ${material?.unit ?? "unit"} × ${money.format(item.unitCost)}` : "Lengkapi material, jumlah, dan harga"}</span></span>
                      <span className="shrink-0 text-right"><span className="block text-xs font-bold tabular-nums">{money.format(item.quantity * item.unitCost)}</span><ChevronDown className={`ml-auto mt-1 h-3.5 w-3.5 text-on-surface-variant ${editingKey === item.key ? "rotate-180" : ""}`} aria-hidden="true" /></span>
                    </button>
                    {editingKey === item.key ? (
                      <div className="space-y-2 border-t border-outline-variant/15 bg-surface px-3 pb-3 pt-3">
                        <SheetSelect label="Material" value={item.materialId} options={materialOptions} onChange={(value) => updateItem(item.key, { materialId: value, projectRapItemId: "" })} placeholder="Pilih material" required />
                        <SheetSelect label="Tautan RAP" optional value={item.projectRapItemId} options={[{ value: "", label: "Tanpa tautan RAP" }, ...(selectedProject?.rapItems?.filter((row) => row.materialId === item.materialId).map((row) => ({ value: row.id, label: row.name, description: row.area })) ?? [])]} onChange={(value) => updateItem(item.key, { projectRapItemId: value })} placeholder="Tanpa tautan RAP" />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><FormField label={material?.unit ? `Jumlah (${material.unit})` : "Jumlah"}><QuantityStepper value={item.quantity} min={0} step={1} onChange={(value) => updateItem(item.key, { quantity: Number(value) })} /></FormField><FormField label="Harga per unit"><MoneyInput value={item.unitCost} showPreview={false} onChange={(value) => updateItem(item.key, { unitCost: Number(value) })} /></FormField></div>
                        <FormField label="Catatan item" optional><Textarea rows={2} value={item.note} onChange={(value) => updateItem(item.key, { note: value })} /></FormField>
                        <div className="grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { const copy = { ...item, key: createClientId("receipt-item") }; setItems((current) => [...current, copy]); setEditingKey(copy.key); }} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container text-xs font-bold"><Copy className="h-4 w-4" /> Duplikat</motion.button><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={items.length === 1} onClick={() => { setItems((current) => current.filter((row) => row.key !== item.key)); setEditingKey(null); }} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-error-container/25 text-xs font-bold text-error disabled:opacity-35"><Trash2 className="h-4 w-4" /> Hapus</motion.button></div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { const item = newItem(); setItems((current) => [...current, item]); setEditingKey(item.key); }} className="min-h-12 w-full rounded-full bg-white text-xs font-bold text-primary ring-1 ring-primary/15">Tambah Material</motion.button>
            </section>
            <FormField label="Catatan penerimaan" optional><Textarea rows={3} value={note} onChange={setNote} /></FormField>
          </div>
        )}
      </WorkflowFormSheet>
      <ConfirmationSheet open={confirmClose} title="Buang perubahan penerimaan?" description="Data yang belum diposting akan hilang." confirmLabel="Buang Perubahan" danger onClose={() => setConfirmClose(false)} onConfirm={() => { setConfirmClose(false); reset(); closeImmediately(); }} />
      <ConfirmationSheet open={Boolean(pendingProjectId)} title="Ganti project?" description="Tautan RAP dan item yang sudah diisi akan dikosongkan agar material tidak masuk ke project yang salah." confirmLabel="Ganti Project" danger onClose={() => setPendingProjectId(null)} onConfirm={() => { if (pendingProjectId) applyProject(pendingProjectId); setPendingProjectId(null); }} />
      <ConfirmationSheet
        open={Boolean(pendingVendorBillId)}
        title="Ganti tagihan vendor?"
        description="Project, material, tautan RAP, nominal, dan catatan yang sedang diisi akan diganti dengan data dari tagihan baru."
        confirmLabel="Ganti Tagihan"
        danger
        onClose={() => setPendingVendorBillId(null)}
        onConfirm={() => {
          const bill = vendorBills.find((row) => row.id === pendingVendorBillId);
          if (bill) applyVendorBill(bill);
          setPendingVendorBillId(null);
        }}
      />
      <MaterialSuccessSheet success={success} secondaryLabel="Terima Barang Lagi" onClose={() => setSuccess(null)} onSecondary={() => { setSuccess(null); launch(); }} />
    </>
  );
}
