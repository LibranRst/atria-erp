"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { toast } from "sonner";

import { postGoodsReceipt } from "@/app/actions/material/goods-receipt";
import {
  AppIcon,
  ConfirmationDialog,
  DatePickerField,
  FactRow,
  FormField,
  FormRiskNotice,
  FormSection,
  GroupedSurface,
  MoneyValue,
  OperationSuccessDialog,
  type OperationSuccess,
  AdaptiveSelect,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { InventoryLocationSheet } from "@/features/materials/components/sheets/inventory-location-sheet";
import { StockImpactRow } from "@/features/materials/components/shared/stock-impact-row";
import { GoodsReceiptItemsSection } from "@/features/materials/components/sheets/goods-receipt-items-section";
import {
  goodsReceiptMoney as money,
  newGoodsReceiptItem as newItem,
  type GoodsReceiptItemDraft as ItemDraft,
  type GoodsReceiptSheetProps as Props,
} from "@/features/materials/components/sheets/goods-receipt-types";
import {
  buildGoodsReceiptBillPrefill,
  type GoodsReceiptVendorBillOption,
} from "@/features/materials/utils/goods-receipt-prefill";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { useUrlSearchParam } from "@/lib/utils/use-url-search-param";
export function GoodsReceiptSheet({
  projects,
  locations,
  materials,
  inventory,
  vendorBills,
  compact = false,
  showTrigger = true,
}: Props): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const reduceMotion = useReducedMotion();

  const router = useRouter();
  const urlAction = useUrlSearchParam("action");
  const showSheet = urlAction === "RECEIVE";
  const [open, setOpen] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [pendingProjectId, setPendingProjectId] = React.useState<string | null>(null);
  const [pendingVendorBillId, setPendingVendorBillId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState("");
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [vendorBillId, setVendorBillId] = React.useState("");
  const defaultReceiptNumber = React.useId().replaceAll(":", "").slice(0, 6).toUpperCase();
  const [customReceiptNumber, setCustomReceiptNumber] = React.useState<string | null>(null);
  const receiptNumber = customReceiptNumber ?? `GR-${defaultReceiptNumber}`;
  const setReceiptNumber = (value: string) => setCustomReceiptNumber(value);
  const [receivedAt, setReceivedAt] = React.useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [items, setItems] = React.useState<readonly ItemDraft[]>([newItem()]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<OperationSuccess | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [addedLocations, setAddedLocations] = React.useState<
    readonly { readonly id: string; readonly name: string }[]
  >([]);
  const [showLocationComposer, setShowLocationComposer] = React.useState(false);
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedVendorBill = vendorBills.find((bill) => bill.id === vendorBillId);
  const total = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
    0,
  );
  const meaningfulItem = items.some(
    (item) => item.materialId || Number(item.unitCost || 0) > 0 || item.note.trim(),
  );
  const dirty = Boolean(projectId || vendorBillId || meaningfulItem || note.trim());
  const valid = Boolean(
    projectId &&
    locationId &&
    receiptNumber.trim().length >= 3 &&
    items.length > 0 &&
    items.every(
      (item) =>
        item.materialId &&
        Number(item.quantity) > 0 &&
        !Number.isNaN(Number(item.quantity)) &&
        Number(item.unitCost) >= 0 &&
        !Number.isNaN(Number(item.unitCost)),
    ),
  );
  const disabledReason = !projectId
    ? "Pilih project penerima material."
    : !locationId
      ? "Pilih lokasi inventori."
      : receiptNumber.trim().length < 3
        ? "Nomor penerimaan minimal 3 karakter."
        : items.some(
              (item) =>
                !item.materialId ||
                Number(item.quantity) <= 0 ||
                Number.isNaN(Number(item.quantity)) ||
                Number(item.unitCost) < 0 ||
                Number.isNaN(Number(item.unitCost)),
            )
          ? "Lengkapi material, jumlah, dan harga setiap item."
          : undefined;
  const vendorBillOptions = [
    { value: "", label: "Tanpa tagihan vendor", description: "Isi penerimaan secara manual." },
    ...vendorBills.map((bill) => ({
      value: bill.id,
      label: bill.name,
      description: `${bill.vendorName} · ${money.format(bill.amount)}`,
      meta:
        bill.status === "PAID"
          ? "Lunas"
          : bill.status === "PARTIALLY_PAID"
            ? "Sebagian"
            : "Belum bayar",
      group: bill.projectName,
    })),
  ];
  const allLocations = React.useMemo(() => {
    const existingIds = new Set(locations.map((loc) => loc.id));
    return [...locations, ...addedLocations.filter((loc) => !existingIds.has(loc.id))];
  }, [locations, addedLocations]);
  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));
  const locationOptions = allLocations.map((location) => ({
    value: location.id,
    label: location.name,
  }));
  const isSheetOpen = open || showSheet;

  const reset = React.useCallback((): void => {
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
  }, [locations]);

  const closeImmediately = React.useCallback((): void => {
    reset();
    setOpen(false);
    if (new URLSearchParams(window.location.search).get("action") === "RECEIVE") {
      const params = new URLSearchParams(window.location.search);
      params.delete("action");
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, [reset, router]);

  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    closeImmediately();
  }

  function applyProject(nextProjectId: string): void {
    setProjectId(nextProjectId);
    setVendorBillId("");
    setItems([newItem()]);
  }

  function changeProject(nextProjectId: string): void {
    if (projectId && projectId !== nextProjectId && meaningfulItem) {
      setPendingProjectId(nextProjectId);
      return;
    }
    applyProject(nextProjectId);
  }

  function applyVendorBill(bill: GoodsReceiptVendorBillOption): void {
    const prefill = buildGoodsReceiptBillPrefill(bill);
    const project = projects.find((row) => row.id === prefill.projectId);
    const rapLinkIsValid = Boolean(
      prefill.item.projectRapItemId &&
      project?.rapItems?.some(
        (row) =>
          row.id === prefill.item.projectRapItemId && row.materialId === prefill.item.materialId,
      ),
    );
    const item = newItem({
      ...prefill.item,
      projectRapItemId: rapLinkIsValid ? prefill.item.projectRapItemId : "",
    });
    setVendorBillId(bill.id);
    setProjectId(prefill.projectId);
    setItems([item]);
    setNote(prefill.receiptNote);
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
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
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
        items: items.map((item) => ({
          materialId: item.materialId,
          projectRapItemId: item.projectRapItemId || null,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          note: item.note || null,
        })),
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        setReviewing(false);
        return;
      }
      setSuccess({
        title: "Penerimaan barang berhasil",
        description:
          "Stok, harga rata-rata, movement, dan audit trail telah diperbarui dalam satu transaksi.",
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

  function launch(): void {
    reset();
    setOpen(true);
  }

  const impacts = Array.from(new Set(items.map((item) => item.materialId).filter(Boolean))).map(
    (materialId) => {
      const row = inventory.find(
        (item) => item.materialId === materialId && item.locationId === locationId,
      );
      const quantity = items
        .filter((item) => item.materialId === materialId)
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return { materialId, row, quantity };
    },
  );

  return (
    <>
      {showTrigger ? (
        <motion.button
          type="button"
          whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
          transition={transitionSpringSnappy}
          onClick={launch}
          className={
            compact
              ? "min-h-12 rounded-full bg-white px-4 text-xs font-bold text-primary ring-1 ring-primary/15"
              : "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary"
          }
        >
          {!compact ? <AppIcon name="add" className="icon-sm" /> : null} Terima Barang
        </motion.button>
      ) : null}
      <WorkflowFormSheet
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <div className="space-y-4">
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  layout="stacked"
                  label="Proyek"
                  wrapLabel
                  value={selectedProject?.name ?? "Belum dipilih"}
                />
                <FactRow
                  layout="stacked"
                  label="Lokasi"
                  wrapLabel
                  value={allLocations.find((row) => row.id === locationId)?.name ?? "Belum dipilih"}
                />
                <FactRow
                  layout="stacked"
                  label="Penerimaan"
                  wrapLabel
                  value={receiptNumber || "Belum diisi"}
                />
                <FactRow
                  layout="stacked"
                  label="Sumber tagihan"
                  wrapLabel
                  value={
                    vendorBillId
                      ? (selectedVendorBill?.name ?? "Tagihan tidak tersedia")
                      : "Isi manual"
                  }
                />
                <FactRow layout="stacked" label="Baris material" wrapLabel value={items.length} />
                <FactRow
                  layout="stacked"
                  label="Nilai draft"
                  wrapLabel
                  value={
                    <MoneyValue
                      fractionDigits={Number.isInteger(total) ? 0 : 2}
                      amount={total}
                      variant="fullDynamic"
                      size="sm"
                    />
                  }
                />
              </div>
            </GroupedSurface>
            <p className="text-support leading-relaxed text-on-surface-variant">
              Posting menambah stok fisik dan memperbarui harga rata-rata. Pembayaran tagihan
              dicatat terpisah.
            </p>
          </div>
        }
        dismissal={{ mode: "managed" }}
        open={isSheetOpen}
        title={reviewing ? "Tinjau Penerimaan Barang" : "Penerimaan Barang"}
        onClose={requestClose}
        primaryLabel={reviewing ? "Posting" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Memposting…"
        pending={pending}
        disabled={!valid}
        disabledReason={disabledReason}
        onPrimary={() => (reviewing ? submit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-md">
            <div className={desktop ? "hidden" : "rounded-2xl bg-primary/5 px-4 py-3"}>
              <p className="text-meta font-bold tracking-wide text-primary uppercase">Penerimaan</p>
              <p className="mt-1 text-sm font-bold">{selectedProject?.name}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {locations.find((row) => row.id === locationId)?.name} · {receiptNumber}
              </p>
              {selectedVendorBill ? (
                <p className="mt-1 text-meta font-semibold text-on-surface-variant">
                  Tagihan {selectedVendorBill.name} · {selectedVendorBill.vendorName}
                </p>
              ) : null}
              <p className="mt-2 text-xl font-bold tabular-nums">{money.format(total)}</p>
            </div>
            <div className="space-y-2">
              {impacts.map(({ materialId, row, quantity }) => (
                <StockImpactRow
                  key={materialId}
                  label={
                    row?.materialName ??
                    materials.find((item) => item.id === materialId)?.name ??
                    "Material"
                  }
                  before={row?.currentStock ?? 0}
                  delta={quantity}
                  after={(row?.currentStock ?? 0) + quantity}
                  reserved={row?.reservedStock}
                  unit={row?.unit}
                />
              ))}
            </div>
            <FormRiskNotice title="Posting mengubah stok" tone="warning">
              Harga rata-rata bergerak dan stok fisik langsung bertambah. Setelah diposting, koreksi
              dilakukan melalui permintaan reversal, bukan edit langsung.
            </FormRiskNotice>
          </div>
        ) : (
          <div className="space-y-md">
            {message ? (
              <p
                className="rounded-2xl bg-error-container/30 p-3 text-xs leading-5 text-error"
                role="alert"
              >
                {message}
              </p>
            ) : null}

            <FormSection
              title="Sumber & Lokasi"
              helper="Koneksikan ke tagihan vendor atau project untuk alokasi stok."
            >
              <AdaptiveSelect
                label="Tagihan vendor"
                optional
                value={vendorBillId}
                options={vendorBillOptions}
                onChange={changeVendorBill}
                placeholder="Tanpa tagihan vendor"
                searchPlaceholder="Cari nomor, vendor, atau project..."
              />
              <AdaptiveSelect
                label="Project"
                value={projectId}
                options={projectOptions}
                onChange={changeProject}
                placeholder="Pilih project"
                required
              />
              <AdaptiveSelect
                label="Lokasi inventori"
                value={locationId}
                options={locationOptions}
                onChange={setLocationId}
                placeholder="Pilih lokasi"
                createActionLabel="Buat lokasi baru"
                createActionDescription="Tambahkan lokasi gudang atau workshop baru."
                onCreateAction={() => setShowLocationComposer(true)}
                required
              />
            </FormSection>

            {selectedVendorBill ? (
              <div
                className={`flex items-start gap-3 rounded-2xl p-3.5 text-xs font-medium ring-1 ${
                  selectedVendorBill.materialId
                    ? "bg-primary/5 text-primary ring-primary/20"
                    : "bg-warning/10 text-warning ring-warning/20"
                }`}
              >
                <AppIcon
                  name={selectedVendorBill.materialId ? "check-circle" : "warning"}
                  className="icon-md shrink-0"
                />
                <div className="min-w-0 flex-1 leading-relaxed">
                  <p className="font-bold">
                    {selectedVendorBill.materialId
                      ? "Data Tagihan Berhasil Diisi Otomatis"
                      : "Verifikasi Pilihan Material"}
                  </p>
                  <p className="mt-0.5 text-meta opacity-90">
                    {selectedVendorBill.materialId
                      ? "Project, material, tautan RAP, nominal, dan catatan sudah diprefill dari tagihan vendor."
                      : "Project, nominal, dan catatan sudah diprefill. Pilih material yang benar sebelum posting penerimaan."}
                  </p>
                </div>
              </div>
            ) : null}

            <FormSection
              title="Dokumen Penerimaan"
              helper="Nomor dan tanggal pencatatan penerimaan fisik."
            >
              <FormField label="Nomor penerimaan" required>
                <TextInput value={receiptNumber} onChange={setReceiptNumber} />
              </FormField>
              <DatePickerField
                label="Tanggal diterima"
                value={receivedAt}
                onChange={setReceivedAt}
                required
              />
              <FormField label="Catatan penerimaan" optional>
                <Textarea rows={3} value={note} onChange={setNote} />
              </FormField>
            </FormSection>

            <GoodsReceiptItemsSection
              items={items}
              materials={materials}
              selectedProject={selectedProject}
              onItemsChange={(change) => setItems((current) => change(current))}
              onUpdateItem={updateItem}
            />
          </div>
        )}
      </WorkflowFormSheet>
      <ConfirmationDialog
        open={confirmClose}
        title="Buang perubahan penerimaan?"
        description="Data yang belum diposting akan hilang."
        confirmLabel="Buang Perubahan"
        danger
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          reset();
          closeImmediately();
        }}
      />
      <ConfirmationDialog
        open={Boolean(pendingProjectId)}
        title="Ganti project?"
        description="Tautan RAP dan item yang sudah diisi akan dikosongkan agar material tidak masuk ke project yang salah."
        confirmLabel="Ganti Project"
        danger
        onClose={() => setPendingProjectId(null)}
        onConfirm={() => {
          if (pendingProjectId) applyProject(pendingProjectId);
          setPendingProjectId(null);
        }}
      />
      <ConfirmationDialog
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
      <OperationSuccessDialog
        success={success}
        secondaryLabel="Tambah"
        onClose={() => setSuccess(null)}
        onSecondary={() => {
          setSuccess(null);
          launch();
        }}
      />
      <InventoryLocationSheet
        open={showLocationComposer}
        onClose={() => setShowLocationComposer(false)}
        onSuccess={(newLocation) => {
          setAddedLocations((curr) => [...curr, newLocation]);
          setLocationId(newLocation.id);
          setShowLocationComposer(false);
        }}
      />
    </>
  );
}
