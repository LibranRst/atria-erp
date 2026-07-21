"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Archive, Pencil, RotateCcw, SlidersHorizontal, Warehouse } from "lucide-react";
import {
  createMaterialCategorySetting,
  createMaterialWithInventoryDefaults,
  setMaterialActive,
  updateMaterial,
  updateMaterialSettingDefaults,
  type MaterialSettingRow,
} from "@/app/actions/settings/system";
import { BottomSheet, ConfirmationSheet, EmptyState, SettingsHeader } from "./settings-ui";
import {
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  ConfirmationModal,
  FilterSelect,
  FormDisclosure,
  FormField,
  FormSection,
  OperationalFormSheet,
  MoneyInput,
  NumericInput,
  SheetSelect,
  Textarea,
  TextInput,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { SettingsFilterBar } from "./settings-filter-bar";
import {
  SettingsGroupSurface,
  SettingsModuleHeader,
  SettingsRowChevron,
  SettingsStatusLabel,
} from "./settings-primitives";
import { MaterialImportSheet } from "./material-import-sheet";

type Option = { readonly id: string; readonly name: string };
type MaterialDraft = {
  readonly id?: string;
  readonly categoryId: string;
  readonly defaultVendorId: string | null;
  readonly name: string;
  readonly specification: string;
  readonly brand: string;
  readonly code: string;
  readonly color: string;
  readonly unit: string;
  readonly isActive: boolean;
  readonly locationId: string;
  readonly minimumStock: number;
  readonly lastPurchasePrice: number;
};
type InventoryDraft = {
  readonly materialId: string;
  readonly id: string;
  readonly locationName: string;
  readonly minimumStock: number;
  readonly lastPurchasePrice: number;
};
type DetailNextAction =
  | { readonly kind: "EDIT_MATERIAL"; readonly draft: MaterialDraft }
  | { readonly kind: "EDIT_INVENTORY"; readonly draft: InventoryDraft };
type MaterialSettingsManagerProps = {
  readonly initialMaterials: readonly MaterialSettingRow[];
  readonly initialCategories: readonly Option[];
  readonly vendors: readonly Option[];
  readonly locations: readonly Option[];
  readonly roleName: string;
  readonly canManage: boolean;
  readonly hideHeader?: boolean;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
};

const STATUS_FILTERS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Arsip" },
  { value: "ALL", label: "Semua" },
] as const;

export function MaterialSettingsManager({
  initialMaterials,
  initialCategories,
  vendors,
  locations,
  roleName,
  canManage,
  hideHeader = false,
  presentation = "settings",
  onMutationComplete,
}: MaterialSettingsManagerProps): React.JSX.Element {
  const [materials, setMaterials] = React.useState(initialMaterials);
  const [categories, setCategories] = React.useState(initialCategories);
  const [draft, setDraft] = React.useState<MaterialDraft | null>(null);
  const [inventoryEdit, setInventoryEdit] = React.useState<InventoryDraft | null>(null);
  const [draftBaseline, setDraftBaseline] = React.useState("");
  const [inventoryBaseline, setInventoryBaseline] = React.useState("");
  const [inventoryOriginal, setInventoryOriginal] = React.useState<InventoryDraft | null>(null);
  const [pendingClose, setPendingClose] = React.useState<"MATERIAL" | "INVENTORY" | null>(null);
  const [confirmMaterial, setConfirmMaterial] = React.useState<MaterialSettingRow | null>(null);
  const [selectedMaterial, setSelectedMaterial] = React.useState<MaterialSettingRow | null>(null);
  const [detailNextAction, setDetailNextAction] = React.useState<DetailNextAction | null>(null);
  const [showCategoryComposer, setShowCategoryComposer] = React.useState(false);
  const [showMaterialDetails, setShowMaterialDetails] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [vendorFilter, setVendorFilter] = React.useState("ALL");
  const [status, setStatus] = React.useState("ACTIVE");
  const [message, setMessage] = React.useState<string | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const categoryFilters = React.useMemo(
    () => [
      { value: "ALL", label: "Semua kategori" },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories],
  );
  const vendorFilters = React.useMemo(
    () => [
      { value: "ALL", label: "Semua vendor" },
      ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
    ],
    [vendors],
  );
  const filtered = materials.filter(
    (material) =>
      (material.name + (material.code ?? "") + (material.brand ?? ""))
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (categoryFilter === "ALL" || material.categoryId === categoryFilter) &&
      (vendorFilter === "ALL" || material.defaultVendorId === vendorFilter) &&
      (status === "ALL" || (status === "ACTIVE" ? material.isActive : !material.isActive)),
  );
  const activeFilterCount = Number(categoryFilter !== "ALL") + Number(vendorFilter !== "ALL");
  const materialCompletionItems = draft
    ? [
        draft.categoryId && categories.some((category) => category.id === draft.categoryId),
        draft.name.trim().length > 0,
        draft.unit.trim().length > 0,
        Boolean(draft.id) ||
          (draft.locationId && locations.some((location) => location.id === draft.locationId)),
      ]
    : [];
  const materialCompletedCount = materialCompletionItems.filter(Boolean).length;
  const materialCompletionTotal = materialCompletionItems.length || 1;
  const canSaveMaterial = Boolean(draft && materialCompletedCount === materialCompletionTotal);
  const materialDisabledReason = !draft
    ? undefined
    : !draft.categoryId || !categories.some((category) => category.id === draft.categoryId)
      ? "Pilih kategori material yang valid."
      : !draft.name.trim()
        ? "Isi nama material."
        : !draft.unit.trim()
          ? "Isi unit material."
          : !draft.id &&
              (!draft.locationId || !locations.some((location) => location.id === draft.locationId))
            ? "Pilih lokasi awal agar default inventory tidak salah tempat."
            : undefined;
  const inventoryDirty = Boolean(
    inventoryEdit && JSON.stringify(inventoryEdit) !== inventoryBaseline,
  );

  function blank(): MaterialDraft {
    return {
      categoryId: categories[0]?.id ?? "",
      defaultVendorId: null,
      name: "",
      specification: "",
      brand: "",
      code: "",
      color: "",
      unit: "unit",
      isActive: true,
      locationId: locations[0]?.id ?? "",
      minimumStock: 0,
      lastPurchasePrice: 0,
    };
  }
  function openMaterial(next: MaterialDraft): void {
    setDraft(next);
    setDraftBaseline(JSON.stringify(next));
    setShowMaterialDetails(
      Boolean(
        next.id ||
        next.brand ||
        next.code ||
        next.color ||
        next.specification ||
        next.defaultVendorId,
      ),
    );
  }
  function openInventory(next: InventoryDraft): void {
    setInventoryEdit(next);
    setInventoryOriginal(next);
    setInventoryBaseline(JSON.stringify(next));
  }
  function closeMaterial(): void {
    if (draft && JSON.stringify(draft) !== draftBaseline) setPendingClose("MATERIAL");
    else {
      setDraft(null);
      setShowCategoryComposer(false);
    }
  }
  function closeInventory(): void {
    if (inventoryEdit && JSON.stringify(inventoryEdit) !== inventoryBaseline)
      setPendingClose("INVENTORY");
    else {
      setInventoryEdit(null);
      setInventoryOriginal(null);
    }
  }

  function saveMaterial(): void {
    if (!draft || !canSaveMaterial) return;
    startTransition(async () => {
      if (draft.id) {
        const result = await updateMaterial({
          materialId: draft.id,
          categoryId: draft.categoryId,
          defaultVendorId: draft.defaultVendorId,
          name: draft.name,
          specification: draft.specification,
          brand: draft.brand,
          code: draft.code,
          color: draft.color,
          unit: draft.unit,
          isActive: draft.isActive,
        });
        if (result.success) {
          setMaterials((current) =>
            current.map((row) => (row.id === result.data.id ? result.data : row)),
          );
          setDraft(null);
          setDraftBaseline("");
          setMessage("Material berhasil diperbarui.");
          toast.success("Material berhasil diperbarui.");
          onMutationComplete?.();
        } else {
          setMessage(result.error.message);
          toast.error(result.error.message);
        }
      } else {
        const result = await createMaterialWithInventoryDefaults({
          categoryId: draft.categoryId,
          defaultVendorId: draft.defaultVendorId,
          name: draft.name,
          specification: draft.specification,
          brand: draft.brand,
          code: draft.code,
          color: draft.color,
          unit: draft.unit,
          inventoryDefaults: [
            {
              inventoryLocationId: draft.locationId,
              minimumStock: draft.minimumStock,
              lastPurchasePrice: draft.lastPurchasePrice,
            },
          ],
        });
        if (result.success) {
          toast.success("Material baru berhasil ditambahkan.");
          setDraft(null);
          setDraftBaseline("");
          onMutationComplete?.();
        } else {
          setMessage(result.error.message);
          toast.error(result.error.message);
        }
      }
    });
  }

  function confirmToggle(): void {
    if (!confirmMaterial) return;
    const target = confirmMaterial;
    startTransition(async () => {
      const result = await setMaterialActive({
        materialId: target.id,
        isActive: !target.isActive,
      });
      if (result.success) {
        setMaterials((current) =>
          current.map((row) =>
            row.id === target.id ? { ...row, isActive: result.data.isActive } : row,
          ),
        );
        setSelectedMaterial(null);
        setConfirmMaterial(null);
        toast.success("Material berhasil diperbarui.");
        onMutationComplete?.();
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  function saveInventory(): void {
    if (!inventoryEdit) return;
    startTransition(async () => {
      const result = await updateMaterialSettingDefaults({
        materialInventoryId: inventoryEdit.id,
        minimumStock: inventoryEdit.minimumStock,
        lastPurchasePrice: inventoryEdit.lastPurchasePrice,
      });
      if (result.success) {
        setMaterials((current) =>
          current.map((material) =>
            material.id === inventoryEdit.materialId
              ? {
                  ...material,
                  inventory: material.inventory.map((row) =>
                    row.id === result.data.id ? result.data : row,
                  ),
                }
              : material,
          ),
        );
        setInventoryEdit(null);
        setInventoryOriginal(null);
        setInventoryBaseline("");
        setMessage("Default inventory diperbarui.");
        toast.success("Default inventory diperbarui.");
        onMutationComplete?.();
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  function addCategory(): void {
    const name = categoryName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createMaterialCategorySetting({
        name,
        description: null,
      });
      if (result.success) {
        setCategories((current) =>
          [...current, result.data].sort((a, b) => a.name.localeCompare(b.name)),
        );
        if (draft) setDraft({ ...draft, categoryId: result.data.id });
        setCategoryName("");
        setShowCategoryComposer(false);
        toast.success("Kategori baru berhasil ditambahkan.");
        onMutationComplete?.();
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-lg"}`}>
      {presentation === "onboarding" ? null : hideHeader ? (
        <SettingsModuleHeader
          eyebrow="Identitas dan default"
          title="Material Master"
          description="Kelola identitas material dan default inventori tanpa mencampur operasi stok."
          actionLabel="Tambah"
          actionDisabled={!canManage}
          onAction={() => openMaterial(blank())}
        />
      ) : (
        <SettingsHeader
          eyebrow="Identitas dan default material"
          title="Material Master"
          description="Identitas material dan default inventori. Pergerakan stok tetap dilakukan di Material & Stok."
          role={roleName}
          canManage={canManage}
        />
      )}
      {message && (
        <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-primary ring-1 ring-primary/15">
          {message}
        </p>
      )}
      {presentation === "onboarding" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="block text-[13px] leading-5 font-bold text-on-surface">
              Material Master
            </span>
            <span className="block text-[9px] leading-4 text-on-surface-variant">
              {materials.filter((row) => row.isActive).length} material aktif
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              disabled={!canManage}
              className="relative min-h-10 rounded-full px-3 text-[10px] font-bold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-40"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => openMaterial(blank())}
              disabled={!canManage}
              className="relative min-h-10 rounded-full bg-[#007AFF]/8 px-3.5 text-[10px] font-bold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-40"
            >
              Tambah
            </button>
          </span>
        </div>
      ) : canManage ? (
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-[10px] font-bold text-[#007AFF] shadow-sm ring-1 ring-black/4"
        >
          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
            upload_file
          </span>
          Import CSV
        </button>
      ) : null}
      {presentation === "settings" ? (
        <SettingsFilterBar
          status={status}
          statusOptions={STATUS_FILTERS}
          search={search}
          filterCount={activeFilterCount}
          searchPlaceholder="Cari material, kode, merek"
          searchAriaLabel="Cari material master"
          layoutPrefix="settings-material"
          filterTitle="Filter material"
          onStatusChange={setStatus}
          onSearchChange={setSearch}
          onResetFilters={() => {
            setCategoryFilter("ALL");
            setVendorFilter("ALL");
            setStatus("ALL");
          }}
        >
          <FilterSelect
            label="Kategori"
            value={categoryFilter}
            options={categoryFilters}
            onChange={setCategoryFilter}
          />
          <FilterSelect
            label="Vendor"
            value={vendorFilter}
            options={vendorFilters}
            onChange={setVendorFilter}
          />
        </SettingsFilterBar>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState
          title={materials.length === 0 ? "Belum ada material" : "Material tidak ditemukan"}
          description={
            materials.length === 0
              ? "Tambahkan Material Master pertama untuk menyiapkan default inventori."
              : "Ubah kata pencarian atau reset filter."
          }
        />
      ) : (
        <SettingsGroupSurface>
          <div className="divide-y divide-black/5.5">
            {filtered.map((material) => (
              <button
                type="button"
                key={material.id}
                onClick={() => setSelectedMaterial(material)}
                className="flex min-h-22 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface">
                  <Warehouse className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] leading-5 font-bold text-on-surface">
                      {material.name}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[10px] leading-4 text-on-surface-variant">
                    {[material.brand, material.code, material.color, material.unit]
                      .filter(Boolean)
                      .join(" · ") || "Detail material belum dilengkapi"}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-[9px] leading-4 text-on-surface-variant">
                    <span className="truncate">{material.inventory.length} lokasi default</span>
                    {material.defaultVendorName ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{material.defaultVendorName}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <SettingsStatusLabel
                    label={material.isActive ? material.categoryName : "Diarsipkan"}
                    tone={material.isActive ? "neutral" : "inactive"}
                  />
                  <SettingsRowChevron />
                </div>
              </button>
            ))}
          </div>
        </SettingsGroupSurface>
      )}

      <BottomSheet
        open={Boolean(selectedMaterial)}
        title="Detail Material"
        onClose={() => setSelectedMaterial(null)}
        onExitComplete={() => {
          if (!detailNextAction) return;
          if (detailNextAction.kind === "EDIT_MATERIAL") {
            openMaterial(detailNextAction.draft);
          } else {
            openInventory(detailNextAction.draft);
          }
          setDetailNextAction(null);
        }}
        footer={
          selectedMaterial && canManage ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => {
                  const material = selectedMaterial;
                  setDetailNextAction({
                    kind: "EDIT_MATERIAL",
                    draft: {
                      id: material.id,
                      categoryId: material.categoryId,
                      defaultVendorId: material.defaultVendorId,
                      name: material.name,
                      specification: material.specification ?? "",
                      brand: material.brand ?? "",
                      code: material.code ?? "",
                      color: material.color ?? "",
                      unit: material.unit,
                      isActive: material.isActive,
                      locationId: "",
                      minimumStock: 0,
                      lastPurchasePrice: 0,
                    },
                  });
                  setSelectedMaterial(null);
                }}
                className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Edit identitas</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => setConfirmMaterial(selectedMaterial)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold text-error outline-none focus-visible:ring-2 focus-visible:ring-error/20"
              >
                {selectedMaterial.isActive ? (
                  <Archive className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{selectedMaterial.isActive ? "Arsipkan" : "Aktifkan"}</span>
              </motion.button>
            </div>
          ) : undefined
        }
      >
        {selectedMaterial ? (
          <div className="space-y-lg">
            <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1 ring-outline-variant/15">
              <div className="p-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="truncate text-[9px] font-bold tracking-widest text-on-surface-variant uppercase">
                      {selectedMaterial.categoryName}
                    </p>
                    <SettingsStatusLabel
                      label={selectedMaterial.isActive ? "Aktif" : "Diarsipkan"}
                      tone={selectedMaterial.isActive ? "positive" : "inactive"}
                    />
                  </div>
                  <h3 className="mt-1.5 text-[17px] leading-[1.12] font-bold tracking-[-0.015em] text-on-surface">
                    {selectedMaterial.name}
                  </h3>
                  <p className="mt-1 text-[10px] leading-[1.3] text-on-surface-variant">
                    {[
                      selectedMaterial.brand,
                      selectedMaterial.code,
                      selectedMaterial.color,
                      selectedMaterial.unit,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Identitas tambahan belum diisi"}
                  </p>
                </div>
              </div>

              {selectedMaterial.specification || selectedMaterial.defaultVendorName ? (
                <div className="divide-y divide-outline-variant/15 border-t border-outline-variant/15">
                  {selectedMaterial.specification ? (
                    <div className="grid min-h-12 grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-3 px-4 py-3">
                      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                        Spesifikasi
                      </p>
                      <p className="line-clamp-2 text-right text-[10px] leading-[1.35] text-on-surface">
                        {selectedMaterial.specification}
                      </p>
                    </div>
                  ) : null}
                  {selectedMaterial.defaultVendorName ? (
                    <div className="grid min-h-12 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                        Vendor
                      </p>
                      <p className="truncate text-right text-[10px] font-semibold text-on-surface">
                        {selectedMaterial.defaultVendorName}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="space-y-2.5">
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.11em] text-on-surface uppercase">
                  Default inventori
                </h3>
                <p className="mt-0.5 text-[10px] leading-4 text-on-surface-variant">
                  Batas stok dan harga referensi per lokasi.
                </p>
              </div>
              <SettingsGroupSurface>
                <div className="divide-y divide-black/5.5">
                  {selectedMaterial.inventory.map((inventory) => (
                    <button
                      type="button"
                      key={inventory.id}
                      disabled={!canManage}
                      onClick={() => {
                        setDetailNextAction({
                          kind: "EDIT_INVENTORY",
                          draft: {
                            materialId: selectedMaterial.id,
                            id: inventory.id,
                            locationName: inventory.locationName,
                            minimumStock: inventory.minimumStock,
                            lastPurchasePrice: inventory.lastPurchasePrice,
                          },
                        });
                        setSelectedMaterial(null);
                      }}
                      className="flex min-h-19 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs leading-[1.15] font-bold text-on-surface">
                          {inventory.locationName}
                        </span>
                        <span className="mt-1 block text-[10px] leading-[1.2] text-on-surface-variant">
                          Minimum {inventory.minimumStock.toLocaleString("id-ID")} · Harga acuan Rp{" "}
                          {inventory.lastPurchasePrice.toLocaleString("id-ID")}
                        </span>
                        <span className="mt-1 block text-[9px] leading-[1.2] text-on-surface-variant/70">
                          Stok {inventory.currentStock.toLocaleString("id-ID")} · Reservasi{" "}
                          {inventory.reservedStock.toLocaleString("id-ID")}
                        </span>
                      </span>
                      {canManage ? <SettingsRowChevron /> : null}
                    </button>
                  ))}
                </div>
              </SettingsGroupSurface>
            </section>

            {!canManage ? (
              <p className="px-1 text-[10px] leading-[1.35] text-on-surface-variant">
                Akun ini hanya dapat melihat default Material Master.
              </p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <MaterialImportSheet open={showImport} onClose={() => setShowImport(false)} />

      <OperationalFormSheet
        actionPlacement="header"
        open={Boolean(draft)}
        title={draft?.id ? "Edit Material" : "Tambah Material"}
        onClose={closeMaterial}
        pending={pending}
        disabled={!canManage || !canSaveMaterial}
        disabledReason={materialDisabledReason}
        submitLabel="Simpan"
        submittingLabel="Menyimpan…"
        onSubmit={saveMaterial}
        statusText={
          draft
            ? `${materialCompletedCount} dari ${materialCompletionTotal} data wajib lengkap${draft.name.trim() ? ` · ${draft.name.trim()}` : ""}`
            : undefined
        }
        statusTone={canSaveMaterial ? "success" : "warning"}
      >
        {draft ? (
          <div className="space-y-md">
            <FormSection
              title="Identitas utama"
              helper="Nama, kategori, dan satuan dipakai di RAP, stok, dan transaksi."
            >
              <SheetSelect
                label="Kategori material"
                value={draft.categoryId}
                onChange={(value) => setDraft({ ...draft, categoryId: value })}
                options={categories.map((row) => ({
                  value: row.id,
                  label: row.name,
                }))}
                createActionLabel="Buat kategori material"
                createActionDescription="Tambahkan kategori baru ke daftar pilihan."
                onCreateAction={canManage ? () => setShowCategoryComposer(true) : undefined}
              />
              <FormField
                label="Nama material"
                required
                error={!draft.name.trim() ? "Nama material wajib diisi." : undefined}
              >
                <TextInput
                  value={draft.name}
                  onChange={(value) => setDraft({ ...draft, name: value })}
                  aria-invalid={!draft.name.trim()}
                />
              </FormField>
              <ComboboxField
                label="Satuan"
                value={draft.unit}
                onChange={(value) => setDraft({ ...draft, unit: value })}
                options={COMMON_UNIT_OPTIONS}
                error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined}
              />
            </FormSection>

            <FormDisclosure
              variant="compact"
              title="Detail material"
              description="Merek, kode, warna, vendor, dan spesifikasi"
              summary={
                [
                  draft.brand,
                  draft.code,
                  draft.color,
                  draft.defaultVendorId,
                  draft.specification,
                ].filter(Boolean).length > 0
                  ? `${[draft.brand, draft.code, draft.color, draft.defaultVendorId, draft.specification].filter(Boolean).length} terisi`
                  : "Opsional"
              }
              icon={<SlidersHorizontal className="h-4 w-4" />}
              expanded={showMaterialDetails}
              onToggle={() => setShowMaterialDetails((current) => !current)}
            >
              <FormSection
                title="Informasi pembelian"
                helper="Isi hanya data yang membantu pencarian atau pembelian berulang."
              >
                <FormField label="Merek" optional>
                  <TextInput
                    value={draft.brand}
                    onChange={(value) => setDraft({ ...draft, brand: value })}
                  />
                </FormField>
                <FormField label="Kode" optional>
                  <TextInput
                    value={draft.code}
                    onChange={(value) => setDraft({ ...draft, code: value })}
                  />
                </FormField>
                <FormField label="Warna" optional>
                  <TextInput
                    value={draft.color}
                    onChange={(value) => setDraft({ ...draft, color: value })}
                  />
                </FormField>
                <SheetSelect
                  label="Vendor default"
                  value={draft.defaultVendorId ?? ""}
                  onChange={(value) => setDraft({ ...draft, defaultVendorId: value || null })}
                  options={[
                    { value: "", label: "Tanpa vendor default" },
                    ...vendors.map((row) => ({
                      value: row.id,
                      label: row.name,
                    })),
                  ]}
                />
                <FormField label="Spesifikasi" optional>
                  <Textarea
                    value={draft.specification}
                    onChange={(value) => setDraft({ ...draft, specification: value })}
                    rows={2}
                  />
                </FormField>
              </FormSection>
            </FormDisclosure>

            {!draft.id ? (
              <FormSection
                title="Default inventori awal"
                helper="Pilih lokasi; stok minimum dan harga acuan boleh tetap nol."
              >
                <SheetSelect
                  label="Lokasi"
                  value={draft.locationId}
                  onChange={(value) => setDraft({ ...draft, locationId: value })}
                  options={locations.map((row) => ({
                    value: row.id,
                    label: row.name,
                  }))}
                  error={
                    !draft.locationId
                      ? "Lokasi awal wajib dipilih agar stok tidak masuk tempat yang salah."
                      : undefined
                  }
                />
                <FormField label="Stok minimum">
                  <NumericInput
                    min={0}
                    value={draft.minimumStock}
                    onChange={(value) => setDraft({ ...draft, minimumStock: Number(value || 0) })}
                  />
                </FormField>
                <FormField label="Harga acuan">
                  <MoneyInput
                    value={draft.lastPurchasePrice}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        lastPurchasePrice: Number(value || 0),
                      })
                    }
                  />
                </FormField>
              </FormSection>
            ) : null}
          </div>
        ) : null}
      </OperationalFormSheet>

      <OperationalFormSheet
        actionPlacement="header"
        open={showCategoryComposer}
        title="Kategori Material Baru"
        onClose={() => {
          setShowCategoryComposer(false);
          setCategoryName("");
        }}
        pending={pending}
        disabled={!categoryName.trim()}
        disabledReason={!categoryName.trim() ? "Isi nama kategori material." : undefined}
        submitLabel="Tambah"
        submittingLabel="Menambahkan…"
        onSubmit={addCategory}
        statusText={
          categoryName.trim()
            ? `${categoryName.trim()} · Siap ditambahkan`
            : "Nama kategori belum diisi"
        }
        statusTone={categoryName.trim() ? "success" : "warning"}
      >
        <FormSection
          title="Nama kategori"
          helper="Kategori baru langsung dipilih pada Material yang sedang dibuat."
        >
          <FormField label="Nama kategori material" required>
            <TextInput
              autoFocus
              value={categoryName}
              onChange={setCategoryName}
              placeholder="Contoh: Hardware"
            />
          </FormField>
        </FormSection>
      </OperationalFormSheet>

      <OperationalFormSheet
        open={Boolean(inventoryEdit)}
        title="Default Inventori"
        onClose={closeInventory}
        pending={pending}
        disabled={!inventoryDirty}
        disabledReason={!inventoryDirty ? "Belum ada perubahan untuk disimpan." : undefined}
        submitLabel="Simpan"
        submittingLabel="Menyimpan…"
        onSubmit={saveInventory}
        statusText={inventoryDirty ? "Perubahan default siap disimpan." : undefined}
        statusTone={inventoryDirty ? "success" : "default"}
      >
        {inventoryEdit && (
          <div className="space-y-md">
            <FormSection
              title="Default lokasi"
              helper="Atur batas minimum dan harga referensi tanpa mengubah stok saat ini."
            >
              <FormField label="Lokasi inventori" readOnly>
                <div className="flex min-h-8 items-center gap-2.5">
                  <Warehouse
                    className="h-4 w-4 shrink-0 text-on-surface-variant"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-bold text-on-surface">
                    {inventoryEdit.locationName}
                  </span>
                </div>
              </FormField>
              <FormField label="Stok minimum">
                <NumericInput
                  min={0}
                  value={inventoryEdit.minimumStock}
                  onChange={(value) =>
                    setInventoryEdit({
                      ...inventoryEdit,
                      minimumStock: Number(value || 0),
                    })
                  }
                />
              </FormField>
              <FormField label="Harga pembelian acuan">
                <MoneyInput
                  value={inventoryEdit.lastPurchasePrice}
                  onChange={(value) =>
                    setInventoryEdit({
                      ...inventoryEdit,
                      lastPurchasePrice: Number(value || 0),
                    })
                  }
                />
              </FormField>
            </FormSection>
            {inventoryOriginal && inventoryDirty ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[20px] bg-surface-container-lowest px-3.5 py-3 ring-1 ring-outline-variant/15">
                <div>
                  <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                    Sebelum
                  </p>
                  <p className="mt-1 text-[11px] font-bold tabular-nums">
                    Min. {inventoryOriginal.minimumStock.toLocaleString("id-ID")}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-on-surface-variant tabular-nums">
                    Rp {inventoryOriginal.lastPurchasePrice.toLocaleString("id-ID")}
                  </p>
                </div>
                <span
                  className="material-symbols-outlined text-[18px] leading-none text-on-surface-variant"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
                <div className="text-right">
                  <p className="text-[9px] font-bold tracking-wide text-primary uppercase">
                    Sesudah
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-primary tabular-nums">
                    Min. {inventoryEdit.minimumStock.toLocaleString("id-ID")}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-primary tabular-nums">
                    Rp {inventoryEdit.lastPurchasePrice.toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </OperationalFormSheet>
      <ConfirmationSheet
        open={Boolean(confirmMaterial)}
        title={confirmMaterial?.isActive ? "Arsipkan material?" : "Aktifkan kembali material?"}
        description={
          confirmMaterial
            ? `${confirmMaterial.name} ${confirmMaterial.isActive ? "tidak akan muncul sebagai pilihan aktif." : "akan kembali tersedia sebagai pilihan."}`
            : ""
        }
        confirmLabel={confirmMaterial?.isActive ? "Arsipkan" : "Aktifkan"}
        danger={Boolean(confirmMaterial?.isActive)}
        pending={pending}
        onClose={() => setConfirmMaterial(null)}
        onConfirm={confirmToggle}
      />
      <ConfirmationModal
        open={pendingClose !== null}
        title="Buang perubahan yang belum disimpan?"
        description={
          pendingClose === "MATERIAL"
            ? "Perubahan identitas dan default material akan hilang."
            : "Perubahan minimum stok dan harga referensi akan hilang."
        }
        tone="danger"
        onClose={() => setPendingClose(null)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setPendingClose(null)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold"
            >
              Lanjut Mengedit
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                if (pendingClose === "MATERIAL") {
                  setDraft(null);
                  setDraftBaseline("");
                  setShowCategoryComposer(false);
                } else {
                  setInventoryEdit(null);
                  setInventoryOriginal(null);
                  setInventoryBaseline("");
                }
                setPendingClose(null);
              }}
              className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white"
            >
              Buang Perubahan
            </motion.button>
          </div>
        }
      />
    </section>
  );
}
