"use client";

import React from "react";
import { toast } from "sonner";
import { createInventoryLocation } from "@/app/actions/material/warehouse";
import type { MaterialSettingRow } from "@/app/actions/settings/system";
import {
  AppIcon,
  COMMON_UNIT_OPTIONS,
  ConfirmationDialog,
  EmptyState,
  FilterSelect,
  FormRiskNotice,
  Button,
} from "@/components/ui";
import { InventoryLocationSheet } from "@/features/materials/components/sheets/inventory-location-sheet";
import { VendorCreateSheet } from "@/features/administration/components/forms/vendor-create-sheet";
import { SettingsFilterBar } from "../shared/settings-filter-bar";
import { MaterialImportSheet } from "./material-import-sheet";
import { MaterialCategoryComposerDialog } from "./material-category-composer-dialog";
import { MaterialDetailSheet } from "./material-detail-sheet";
import { MaterialEditorSheet } from "./material-editor-sheet";
import { MaterialInventoryDefaultSheet } from "./material-inventory-default-sheet";
import { MaterialSettingsList } from "./material-settings-list";
import { useMaterialSettingsMutations } from "../../hooks/use-material-settings-mutations";
import type {
  DetailNextAction,
  InventoryDraft,
  MaterialDraft,
  SettingsOption,
} from "../../types/material-types";
type MaterialSettingsManagerProps = {
  readonly initialMaterials: readonly MaterialSettingRow[];
  readonly initialCategories: readonly SettingsOption[];
  readonly vendors: readonly SettingsOption[];
  readonly locations: readonly SettingsOption[];
  readonly canManage: boolean;
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
  vendors: initialVendors,
  locations: initialLocations,
  canManage,
  presentation = "settings",
  onMutationComplete,
}: MaterialSettingsManagerProps): React.JSX.Element {
  const [materials, setMaterials] = React.useState(initialMaterials);
  const [categories, setCategories] = React.useState(initialCategories);
  const [addedVendors, setAddedVendors] = React.useState<readonly SettingsOption[]>([]);
  const [addedLocations, setAddedLocations] = React.useState<readonly SettingsOption[]>([]);
  const [showVendorComposer, setShowVendorComposer] = React.useState(false);
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
  const [showLocationComposer, setShowLocationComposer] = React.useState(false);
  const [showMaterialDetails, setShowMaterialDetails] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState("");
  const [newLocationName, setNewLocationName] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [vendorFilter, setVendorFilter] = React.useState("ALL");
  const [categoryFilterDraft, setCategoryFilterDraft] = React.useState("ALL");
  const [vendorFilterDraft, setVendorFilterDraft] = React.useState("ALL");
  const [status, setStatus] = React.useState("ACTIVE");
  const [message, setMessage] = React.useState<string | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [locationPending, startLocationTransition] = React.useTransition();

  const locations = React.useMemo(() => {
    const existingIds = new Set(initialLocations.map((loc) => loc.id));
    return [...initialLocations, ...addedLocations.filter((loc) => !existingIds.has(loc.id))];
  }, [initialLocations, addedLocations]);

  const vendors = React.useMemo(() => {
    const existingIds = new Set(initialVendors.map((vendor) => vendor.id));
    return [...initialVendors, ...addedVendors.filter((vendor) => !existingIds.has(vendor.id))];
  }, [initialVendors, addedVendors]);

  const unitOptions = React.useMemo(() => {
    const existingUnits = materials.map((m) => m.unit?.trim()).filter(Boolean);
    return Array.from(new Set([...COMMON_UNIT_OPTIONS, ...existingUnits]));
  }, [materials]);

  function handleAddLocation(): void {
    const trimmed = newLocationName.trim();
    if (trimmed.length < 3) return;

    startLocationTransition(async () => {
      const result = await createInventoryLocation({
        name: trimmed,
        description: null,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      setAddedLocations((current) => [...current, { id: result.data.id, name: result.data.name }]);
      if (draft) {
        setDraft((curr) => (curr ? { ...curr, locationId: result.data.id } : null));
      }
      setShowLocationComposer(false);
      setNewLocationName("");
      toast.success("Lokasi gudang baru berhasil ditambahkan.");
      onMutationComplete?.();
    });
  }
  const suspendedFiltersRef = React.useRef<{
    readonly category: string;
    readonly vendor: string;
    readonly status: string;
  } | null>(null);
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

  const { pending, saveMaterial, confirmToggle, saveInventory, addCategory } =
    useMaterialSettingsMutations({
      draft,
      inventoryEdit,
      confirmMaterial,
      categoryName,
      canSaveMaterial,
      onMutationComplete,
      setMaterials,
      setCategories,
      setDraft,
      setInventoryEdit,
      setInventoryOriginal,
      setDraftBaseline,
      setInventoryBaseline,
      setConfirmMaterial,
      setSelectedMaterial,
      setShowCategoryComposer,
      setCategoryName,
      setMessage,
    });
  return (
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-sm"}`}>
      {message && (
        <FormRiskNotice title="Status material" tone="success">
          {message}
        </FormRiskNotice>
      )}
      {presentation === "onboarding" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="block text-[13px] leading-5 font-bold text-on-surface">
              Material Master
            </span>
            <span className="block text-meta text-on-surface-variant">
              {materials.filter((row) => row.isActive).length} material aktif
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              onClick={() => setShowImport(true)}
              disabled={!canManage}
              className="relative min-h-10 rounded-full bg-accent/8 px-3 text-meta font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-40"
              variant="secondary"
              size="compact"
            >
              Import
            </Button>
            <Button
              type="button"
              onClick={() => openMaterial(blank())}
              disabled={!canManage}
              className="relative min-h-10 rounded-full bg-accent/8 px-3.5 text-meta font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-40"
              variant="secondary"
              size="compact"
            >
              Tambah
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
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
              onEnterSearch={() => {
                suspendedFiltersRef.current = {
                  category: categoryFilter,
                  vendor: vendorFilter,
                  status,
                };
                setCategoryFilter("ALL");
                setVendorFilter("ALL");
                setStatus("ALL");
              }}
              onExitSearch={() => {
                const suspended = suspendedFiltersRef.current;
                if (!suspended) return;
                setCategoryFilter(suspended.category);
                setVendorFilter(suspended.vendor);
                setStatus(suspended.status);
                suspendedFiltersRef.current = null;
              }}
              onOpenFilters={() => {
                setCategoryFilterDraft(categoryFilter);
                setVendorFilterDraft(vendorFilter);
              }}
              onApplyFilters={() => {
                setCategoryFilter(categoryFilterDraft);
                setVendorFilter(vendorFilterDraft);
              }}
              onResetFilterDraft={() => {
                setCategoryFilterDraft("ALL");
                setVendorFilterDraft("ALL");
              }}
            >
              <FilterSelect
                label="Kategori"
                value={categoryFilterDraft}
                options={categoryFilters}
                onChange={setCategoryFilterDraft}
              />
              <FilterSelect
                label="Vendor default"
                value={vendorFilterDraft}
                options={vendorFilters}
                onChange={setVendorFilterDraft}
              />
              {canManage ? (
                <div className="mt-2 border-t border-black/5.5 pt-3">
                  <Button
                    type="button"
                    onClick={() => setShowImport(true)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface hover:bg-surface-container-high"
                    variant="secondary"
                    size="compact"
                  >
                    <AppIcon name="upload_file" className="icon-sm" />
                    Import Material dari CSV
                  </Button>
                </div>
              ) : null}
            </SettingsFilterBar>
          </div>
          {canManage ? (
            <Button
              type="button"
              onClick={() => openMaterial(blank())}
              className="hover:bg-primary-hover flex h-12 shrink-0 items-center justify-center rounded-full bg-primary px-3.5 text-xs font-bold text-white shadow-control max-[420px]:w-12 max-[420px]:px-0"
              title="Tambah Material Baru"
              variant="primary"
            >
              <AppIcon name="add" className="icon-sm" />
              <span className="ml-1 max-[420px]:hidden">Tambah</span>
            </Button>
          ) : null}
        </div>
      )}
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
        <MaterialSettingsList materials={filtered} onSelect={setSelectedMaterial} />
      )}

      <MaterialDetailSheet
        material={selectedMaterial}
        canManage={canManage}
        onClose={() => setSelectedMaterial(null)}
        onExitComplete={() => {
          if (!detailNextAction) return;
          if (detailNextAction.kind === "EDIT_MATERIAL") openMaterial(detailNextAction.draft);
          else openInventory(detailNextAction.draft);
          setDetailNextAction(null);
        }}
        onNextAction={setDetailNextAction}
        onToggle={setConfirmMaterial}
      />
      <MaterialImportSheet open={showImport} onClose={() => setShowImport(false)} />

      <MaterialEditorSheet
        draft={draft}
        categories={categories}
        vendors={vendors}
        locations={locations}
        unitOptions={unitOptions}
        canManage={canManage}
        pending={pending}
        canSave={canSaveMaterial}
        disabledReason={materialDisabledReason}
        completion={[materialCompletedCount, materialCompletionTotal]}
        detailsOpen={showMaterialDetails}
        onClose={closeMaterial}
        onSubmit={saveMaterial}
        onDraftChange={(nextDraft) => setDraft(nextDraft)}
        onDetailsOpenChange={setShowMaterialDetails}
        onCreateCategory={() => setShowCategoryComposer(true)}
        onCreateLocation={() => setShowLocationComposer(true)}
        onCreateVendor={() => setShowVendorComposer(true)}
      />
      <MaterialCategoryComposerDialog
        open={showCategoryComposer}
        name={categoryName}
        pending={pending}
        onClose={() => {
          setShowCategoryComposer(false);
          setCategoryName("");
        }}
        onNameChange={setCategoryName}
        onSubmit={addCategory}
      />
      <InventoryLocationSheet
        open={showLocationComposer}
        pending={locationPending}
        name={newLocationName}
        activeMaterialCount={materials.filter((row) => row.isActive).length}
        onNameChange={setNewLocationName}
        onClose={() => {
          setShowLocationComposer(false);
          setNewLocationName("");
        }}
        onSubmit={handleAddLocation}
      />
      <VendorCreateSheet
        open={showVendorComposer}
        onClose={() => setShowVendorComposer(false)}
        onSuccess={(newVendor) => {
          setAddedVendors((curr) => [...curr, newVendor]);
          if (draft) {
            setDraft((curr) => (curr ? { ...curr, defaultVendorId: newVendor.id } : null));
          }
          setShowVendorComposer(false);
          onMutationComplete?.();
        }}
      />
      <MaterialInventoryDefaultSheet
        draft={inventoryEdit}
        original={inventoryOriginal}
        pending={pending}
        dirty={inventoryDirty}
        onClose={closeInventory}
        onDraftChange={setInventoryEdit}
        onSubmit={saveInventory}
      />
      <ConfirmationDialog
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
      <ConfirmationDialog
        open={pendingClose !== null}
        title="Buang perubahan yang belum disimpan?"
        description={
          pendingClose === "MATERIAL"
            ? "Perubahan identitas dan default material akan hilang."
            : "Perubahan minimum stok dan harga referensi akan hilang."
        }
        danger
        confirmLabel="Buang Perubahan"
        onConfirm={() => {
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
        onClose={() => setPendingClose(null)}
      />
    </section>
  );
}
