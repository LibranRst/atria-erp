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
        <p className="bg-primary/5 text-primary ring-primary/15 rounded-2xl px-3 py-2.5 text-[11px] leading-4 ring-1">
          {message}
        </p>
      )}
      {presentation === "onboarding" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="text-on-surface block text-[13px] leading-5 font-bold">
              Material Master
            </span>
            <span className="text-on-surface-variant block text-[9px] leading-4">
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
                className="focus-visible:bg-surface-container-low active:bg-surface-container-low/75 flex min-h-[88px] w-full items-center gap-3 px-3.5 py-3 text-left outline-none"
              >
                <span className="bg-surface-container-low text-on-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]">
                  <Warehouse className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-on-surface truncate text-[13px] leading-5 font-bold">
                      {material.name}
                    </span>
                  </span>
                  <span className="text-on-surface-variant mt-1 block truncate text-[10px] leading-4">
                    {[material.brand, material.code, material.color, material.unit]
                      .filter(Boolean)
                      .join(" · ") || "Detail material belum dilengkapi"}
                  </span>
                  <span className="text-on-surface-variant flex min-w-0 items-center gap-2 text-[9px] leading-4">
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
                className="bg-primary focus-visible:ring-primary/30 flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold text-white outline-none focus-visible:ring-2"
              >
                <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Edit identitas</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => setConfirmMaterial(selectedMaterial)}
                className="text-error focus-visible:ring-error/20 flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold outline-none focus-visible:ring-2"
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
            <section className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] shadow-[0_10px_28px_rgba(17,17,17,0.04)] ring-1">
              <div className="p-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="text-on-surface-variant truncate text-[9px] font-bold tracking-widest uppercase">
                      {selectedMaterial.categoryName}
                    </p>
                    <SettingsStatusLabel
                      label={selectedMaterial.isActive ? "Aktif" : "Diarsipkan"}
                      tone={selectedMaterial.isActive ? "positive" : "inactive"}
                    />
                  </div>
                  <h3 className="text-on-surface mt-1.5 text-[17px] leading-[1.12] font-bold tracking-[-0.015em]">
                    {selectedMaterial.name}
                  </h3>
                  <p className="text-on-surface-variant mt-1 text-[10px] leading-[1.3]">
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
                <div className="divide-outline-variant/15 border-outline-variant/15 divide-y border-t">
                  {selectedMaterial.specification ? (
                    <div className="grid min-h-12 grid-cols-[5.25rem_minmax(0,1fr)] items-start gap-3 px-4 py-3">
                      <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
                        Spesifikasi
                      </p>
                      <p className="text-on-surface line-clamp-2 text-right text-[10px] leading-[1.35]">
                        {selectedMaterial.specification}
                      </p>
                    </div>
                  ) : null}
                  {selectedMaterial.defaultVendorName ? (
                    <div className="grid min-h-12 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
                        Vendor
                      </p>
                      <p className="text-on-surface truncate text-right text-[10px] font-semibold">
                        {selectedMaterial.defaultVendorName}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="space-y-2.5">
              <div>
                <h3 className="text-on-surface text-[10px] font-bold tracking-[0.11em] uppercase">
                  Default inventori
                </h3>
                <p className="text-on-surface-variant mt-0.5 text-[10px] leading-4">
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
                      className="focus-visible:bg-surface-container-low flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left outline-none disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-on-surface block truncate text-xs leading-[1.15] font-bold">
                          {inventory.locationName}
                        </span>
                        <span className="text-on-surface-variant mt-1 block text-[10px] leading-[1.2]">
                          Minimum {inventory.minimumStock.toLocaleString("id-ID")} · Harga acuan Rp{" "}
                          {inventory.lastPurchasePrice.toLocaleString("id-ID")}
                        </span>
                        <span className="text-on-surface-variant/70 mt-1 block text-[9px] leading-[1.2]">
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
              <p className="text-on-surface-variant px-1 text-[10px] leading-[1.35]">
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
                    className="text-on-surface-variant h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-on-surface truncate text-sm font-bold">
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
              <div className="bg-surface-container-lowest ring-outline-variant/15 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[20px] px-3.5 py-3 ring-1">
                <div>
                  <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
                    Sebelum
                  </p>
                  <p className="mt-1 text-[11px] font-bold tabular-nums">
                    Min. {inventoryOriginal.minimumStock.toLocaleString("id-ID")}
                  </p>
                  <p className="text-on-surface-variant mt-0.5 truncate text-[9px] tabular-nums">
                    Rp {inventoryOriginal.lastPurchasePrice.toLocaleString("id-ID")}
                  </p>
                </div>
                <span
                  className="material-symbols-outlined text-on-surface-variant text-[18px] leading-none"
                  aria-hidden="true"
                >
                  arrow_forward
                </span>
                <div className="text-right">
                  <p className="text-primary text-[9px] font-bold tracking-wide uppercase">
                    Sesudah
                  </p>
                  <p className="text-primary mt-1 text-[11px] font-bold tabular-nums">
                    Min. {inventoryEdit.minimumStock.toLocaleString("id-ID")}
                  </p>
                  <p className="text-primary mt-0.5 truncate text-[9px] tabular-nums">
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
              className="bg-surface-container min-h-12 rounded-full px-4 text-xs font-bold"
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
              className="bg-error min-h-12 rounded-full px-4 text-xs font-bold text-white"
            >
              Buang Perubahan
            </motion.button>
          </div>
        }
      />
    </section>
  );
}
