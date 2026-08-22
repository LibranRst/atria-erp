"use client";

import React from "react";
import { motion } from "framer-motion";
import type { ExpenseCategorySettingRow } from "@/app/actions/settings/system";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import {
  ConfirmationDialog,
  EmptyState,
  FilterSelect,
  WorkspaceModuleHeader,
} from "@/components/ui";
import { SettingsHeader } from "../shared/settings-ui";
import { createClientId } from "@atria/core/utils/client-id";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { SettingsFilterBar } from "../shared/settings-filter-bar";
import { LibraryCostComponentSheet } from "./library-cost-component-sheet";
import { LibraryTemplateEditorSheet } from "./library-template-editor-sheet";
import { LibraryTemplateList } from "./library-template-list";
import { useLibraryTemplateMutations } from "../../hooks/use-library-template-mutations";
import type {
  ComponentType,
  CostComponentDraft,
  Draft,
  ItemType,
  MaterialOption,
  VendorOption,
} from "../../types/library-types";
type Props = {
  readonly initialItems: readonly PricingTemplateRow[];
  readonly categories: readonly ExpenseCategorySettingRow[];
  readonly materials: readonly MaterialOption[];
  readonly vendors: readonly VendorOption[];
  readonly roleName: string;
  readonly canManage: boolean;
  readonly hideHeader?: boolean;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
};

const TYPE_FILTERS = [
  { value: "ALL", label: "Semua tipe" },
  { value: "MATERIAL_ITEM", label: "Material" },
  { value: "WORK_PACKAGE", label: "Tukang" },
  { value: "SUBCON_PACKAGE", label: "Subcon" },
  { value: "CLIENT_LINE", label: "Baris klien" },
] as const;
const STATUS_FILTERS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Arsip" },
  { value: "ALL", label: "Semua" },
] as const;
function newComponent(): CostComponentDraft {
  return {
    key: createClientId("cost-component"),
    vendorId: null,
    componentType: "OTHER",
    label: "",
    quantity: 1,
    unit: "ls",
    unitCost: 0,
    note: "",
  };
}
function emptyDraft(categoryId: string): Draft {
  return {
    expenseCategoryId: categoryId,
    materialId: null,
    defaultVendorId: null,
    code: "",
    itemType: "CLIENT_LINE",
    itemCategory: "General",
    name: "",
    description: "",
    unit: "ls",
    pricingMode: "MARGIN_BASED",
    targetGrossPercentage: 0.4,
    fixedClientPrice: 0,
    priceSourceType: "COST_BREAKDOWN",
    sourceNote: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    isActive: true,
    components: [newComponent()],
  };
}
function toDraft(item: PricingTemplateRow): Draft {
  return {
    id: item.id,
    expenseCategoryId: item.expenseCategoryId,
    materialId: item.materialId,
    defaultVendorId: item.defaultVendorId,
    code: item.code ?? "",
    itemType: item.itemType as ItemType,
    itemCategory: item.itemCategory,
    name: item.name,
    description: item.description ?? "",
    unit: item.unit,
    pricingMode: item.pricingMode as Draft["pricingMode"],
    targetGrossPercentage: item.targetGrossPercentage,
    fixedClientPrice: item.defaultClientPrice,
    priceSourceType: item.priceSourceType as Draft["priceSourceType"],
    sourceNote: item.sourceNote ?? "",
    effectiveFrom: item.effectiveFrom.toString().slice(0, 10),
    isActive: item.isActive,
    components: item.components.map((component) => ({
      key: component.id,
      vendorId: component.vendorId,
      componentType: component.componentType as ComponentType,
      label: component.label,
      quantity: component.quantity,
      unit: component.unit,
      unitCost: component.unitCost,
      note: component.note ?? "",
    })),
  };
}

export function LibrarySettingsManager({
  initialItems,
  categories,
  materials,
  vendors,
  roleName,
  canManage,
  hideHeader = false,
  presentation = "settings",
  onMutationComplete,
}: Props): React.JSX.Element {
  const [items, setItems] = React.useState(initialItems);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [draftBaseline, setDraftBaseline] = React.useState("");
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [confirmItem, setConfirmItem] = React.useState<PricingTemplateRow | null>(null);
  const [componentEditor, setComponentEditor] = React.useState<CostComponentDraft | null>(null);
  const [componentEditorBaseline, setComponentEditorBaseline] = React.useState("");
  const [confirmComponentClose, setConfirmComponentClose] = React.useState(false);
  const [nameTouched, setNameTouched] = React.useState(false);
  const [sourceNoteTouched, setSourceNoteTouched] = React.useState(false);
  const [componentNameTouched, setComponentNameTouched] = React.useState(false);
  const [showSourceDetails, setShowSourceDetails] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("ALL");
  const [status, setStatus] = React.useState("ACTIVE");
  const [categoryId, setCategoryId] = React.useState("ALL");
  const [typeDraft, setTypeDraft] = React.useState("ALL");
  const [categoryIdDraft, setCategoryIdDraft] = React.useState("ALL");
  const [message, setMessage] = React.useState<string | null>(null);
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
  const filtered = items.filter(
    (item) =>
      `${item.name} ${item.itemCategory} ${item.code ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (type === "ALL" || item.itemType === type) &&
      (categoryId === "ALL" || item.expenseCategoryId === categoryId) &&
      (status === "ALL" || (status === "ACTIVE" ? item.isActive : !item.isActive)),
  );
  const internalCost =
    draft?.components.reduce(
      (sum, component) => sum + component.quantity * component.unitCost,
      0,
    ) ?? 0;
  const clientPrice = draft
    ? draft.pricingMode === "MARGIN_BASED"
      ? draft.targetGrossPercentage < 1
        ? internalCost / (1 - draft.targetGrossPercentage)
        : 0
      : draft.fixedClientPrice
    : 0;
  const grossMargin = clientPrice > 0 ? ((clientPrice - internalCost) / clientPrice) * 100 : 0;
  const draftDirty = Boolean(draft && JSON.stringify(draft) !== draftBaseline);
  const activeFilterCount = Number(type !== "ALL") + Number(categoryId !== "ALL");
  const draftCompletionItems = draft
    ? [
        draft.expenseCategoryId &&
          categories.some((category) => category.id === draft.expenseCategoryId),
        draft.name.trim().length >= 2,
        draft.itemCategory.trim().length >= 2,
        draft.unit.trim().length > 0,
        draft.effectiveFrom.trim().length > 0 &&
          !Number.isNaN(new Date(draft.effectiveFrom).getTime()),
        draft.sourceNote.trim().length >= 3,
        draft.pricingMode === "MARGIN_BASED" || draft.fixedClientPrice > 0,
        draft.components.length > 0,
        ...draft.components.flatMap((component) => [
          component.label.trim().length >= 2,
          Number(component.quantity) > 0,
          component.unit.trim().length > 0,
          Number(component.unitCost) >= 0,
        ]),
      ]
    : [];
  const draftCompletedCount = draftCompletionItems.filter(Boolean).length;
  const draftCompletionTotal = draftCompletionItems.length || 1;
  const canSaveDraft = Boolean(draft && draftCompletedCount === draftCompletionTotal);
  const componentEditorValid = Boolean(
    componentEditor &&
    componentEditor.label.trim().length >= 2 &&
    componentEditor.quantity > 0 &&
    componentEditor.unit.trim() &&
    componentEditor.unitCost >= 0,
  );
  const componentEditorDirty = Boolean(
    componentEditor && JSON.stringify(componentEditor) !== componentEditorBaseline,
  );
  const draftDisabledReason = !draft
    ? undefined
    : !draft.expenseCategoryId ||
        !categories.some((category) => category.id === draft.expenseCategoryId)
      ? "Pilih kategori pengeluaran yang valid."
      : draft.name.trim().length < 2
        ? "Isi nama template minimal 2 karakter."
        : draft.itemCategory.trim().length < 2
          ? "Isi kategori item minimal 2 karakter."
          : !draft.unit.trim()
            ? "Isi satuan."
            : !draft.effectiveFrom.trim() || Number.isNaN(new Date(draft.effectiveFrom).getTime())
              ? "Isi tanggal berlaku yang valid."
              : draft.sourceNote.trim().length < 3
                ? "Isi catatan sumber harga minimal 3 karakter."
                : draft.pricingMode === "FIXED_CLIENT_PRICE" && draft.fixedClientPrice <= 0
                  ? "Harga tetap untuk klien harus lebih dari 0."
                  : draft.components.some(
                        (component) =>
                          component.label.trim().length < 2 ||
                          Number(component.quantity) <= 0 ||
                          !component.unit.trim() ||
                          Number(component.unitCost) < 0,
                      )
                    ? "Lengkapi nama minimal 2 karakter, jumlah, satuan, dan biaya satuan di setiap komponen."
                    : undefined;

  function openDraft(next: Draft): void {
    setDraft(next);
    setDraftBaseline(JSON.stringify(next));
    setNameTouched(false);
    setSourceNoteTouched(false);
    setComponentEditor(null);
    setShowSourceDetails(Boolean(!next.id || next.sourceNote || next.description));
  }
  function requestClose(): void {
    if (draft && JSON.stringify(draft) !== draftBaseline) setConfirmClose(true);
    else setDraft(null);
  }

  function changeType(nextType: ItemType): void {
    if (!draft) return;
    const required =
      nextType === "MATERIAL_ITEM"
        ? "MATERIAL"
        : nextType === "WORK_PACKAGE"
          ? "TUKANG"
          : nextType === "SUBCON_PACKAGE"
            ? "SUBCON"
            : null;
    const category = required ? categories.find((row) => row.code === required) : null;
    const defaultMargin =
      nextType === "MATERIAL_ITEM" ? 0.3 : nextType === "CLIENT_LINE" ? 0.4 : 0.2;
    setDraft({
      ...draft,
      itemType: nextType,
      targetGrossPercentage: defaultMargin,
      expenseCategoryId: category?.id ?? draft.expenseCategoryId,
      materialId: nextType === "MATERIAL_ITEM" ? draft.materialId : null,
    });
  }
  function openComponent(component: CostComponentDraft): void {
    setComponentEditor({ ...component });
    setComponentEditorBaseline(JSON.stringify(component));
    setComponentNameTouched(false);
  }
  function patchComponent(update: Partial<CostComponentDraft>): void {
    setComponentEditor((current) => (current ? { ...current, ...update } : current));
  }
  function addComponent(): void {
    const component = newComponent();
    setComponentEditor(component);
    setComponentEditorBaseline(JSON.stringify(component));
    setComponentNameTouched(false);
  }
  function requestComponentClose(): void {
    if (componentEditorDirty) setConfirmComponentClose(true);
    else setComponentEditor(null);
  }
  function saveComponent(): void {
    if (!draft || !componentEditor || !componentEditorValid) return;
    const exists = draft.components.some((component) => component.key === componentEditor.key);
    setDraft({
      ...draft,
      components: exists
        ? draft.components.map((component) =>
            component.key === componentEditor.key ? componentEditor : component,
          )
        : [...draft.components, componentEditor],
    });
    setComponentEditor(null);
    setComponentEditorBaseline("");
  }
  function deleteComponent(): void {
    if (!draft || !componentEditor || draft.components.length <= 1) return;
    setDraft({
      ...draft,
      components: draft.components.filter((component) => component.key !== componentEditor.key),
    });
    setComponentEditor(null);
    setComponentEditorBaseline("");
  }
  const { pending, save, confirmToggle } = useLibraryTemplateMutations({
    draft,
    confirmItem,
    canSave: canSaveDraft,
    onMutationComplete,
    setItems,
    setDraft,
    setBaseline: setDraftBaseline,
    setConfirmItem,
    setMessage,
  });
  return (
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-sm"}`}>
      {presentation === "onboarding" ? null : hideHeader ? (
        <WorkspaceModuleHeader
          eyebrow="Template proyek berulang"
          title="Library Item & Harga"
          description="Biaya internal, harga klien, paket kerja, dan baris RAB yang dapat digunakan kembali."
          actionLabel="Tambah"
          actionDisabled={!canManage}
          onAction={() => openDraft(emptyDraft(categories[0]?.id ?? ""))}
        />
      ) : (
        <SettingsHeader
          eyebrow="Template proyek berulang"
          title="Library Item & Harga"
          description="Template untuk RAP, paket kerja, Subcon, dan baris RAB."
          role={roleName}
          canManage={canManage}
        />
      )}
      {presentation === "settings" ? (
        <p className="text-[10px] leading-[1.35] text-on-surface-variant">
          <strong className="font-bold text-on-surface">Harga tersimpan sebagai snapshot.</strong>{" "}
          Perubahan Library tidak mengubah RAB lama secara diam-diam.
        </p>
      ) : null}
      {message && (
        <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-support text-primary ring-1 ring-primary/15">
          {message}
        </p>
      )}
      {presentation === "onboarding" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 px-1">
          <span className="min-w-0">
            <span className="block text-[13px] leading-5 font-bold text-on-surface">
              Template tersimpan
            </span>
            <span className="block text-[9px] leading-4 text-on-surface-variant">
              {items.filter((row) => row.isActive).length} template aktif
            </span>
          </span>
          <button
            type="button"
            onClick={() => openDraft(emptyDraft(categories[0]?.id ?? ""))}
            disabled={!canManage}
            className="relative min-h-10 shrink-0 rounded-full bg-accent/8 px-3.5 text-meta font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-40"
          >
            Tambah
          </button>
        </div>
      ) : (
        <SettingsFilterBar
          status={status}
          statusOptions={STATUS_FILTERS}
          search={search}
          filterCount={activeFilterCount}
          searchPlaceholder="Cari template, kode, kategori"
          searchAriaLabel="Cari template harga"
          layoutPrefix="settings-library"
          filterTitle="Filter template"
          onStatusChange={setStatus}
          onSearchChange={setSearch}
          onClearFilters={() => {
            setType("ALL");
            setCategoryId("ALL");
            setStatus("ALL");
          }}
          onOpenFilters={() => {
            setTypeDraft(type);
            setCategoryIdDraft(categoryId);
          }}
          onApplyFilters={() => {
            setType(typeDraft);
            setCategoryId(categoryIdDraft);
          }}
          onResetFilterDraft={() => {
            setTypeDraft("ALL");
            setCategoryIdDraft("ALL");
          }}
        >
          <FilterSelect
            label="Tipe"
            value={typeDraft}
            options={TYPE_FILTERS}
            onChange={setTypeDraft}
            presentation="dialog"
          />
          <FilterSelect
            label="Kategori"
            value={categoryIdDraft}
            options={categoryFilters}
            onChange={setCategoryIdDraft}
            presentation="dialog"
          />
        </SettingsFilterBar>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Belum ada template" : "Template tidak ditemukan"}
          description={
            items.length === 0
              ? "Tambahkan template pertama untuk mempercepat setup proyek."
              : "Ubah kata pencarian atau reset filter."
          }
        />
      ) : (
        <LibraryTemplateList
          items={filtered}
          presentation={presentation}
          onOpen={(item) => openDraft(toDraft(item))}
        />
      )}

      <LibraryTemplateEditorSheet
        draft={draft}
        categories={categories}
        materials={materials}
        vendors={vendors}
        canManage={canManage}
        pending={pending}
        canSave={canSaveDraft}
        disabledReason={draftDisabledReason}
        internalCost={internalCost}
        clientPrice={clientPrice}
        grossMargin={grossMargin}
        dirty={draftDirty}
        nameTouched={nameTouched}
        sourceTouched={sourceNoteTouched}
        sourceOpen={showSourceDetails}
        onClose={requestClose}
        onSubmit={save}
        onDraftChange={setDraft}
        onItemTypeChange={changeType}
        onAddComponent={addComponent}
        onOpenComponent={openComponent}
        onNameTouched={() => setNameTouched(true)}
        onSourceTouched={() => setSourceNoteTouched(true)}
        onSourceOpenChange={setShowSourceDetails}
        onRequestToggle={() => {
          if (!draft?.id) return;
          const item = items.find((row) => row.id === draft.id);
          if (item) setConfirmItem(item);
        }}
      />
      <LibraryCostComponentSheet
        componentEditor={componentEditor}
        onRequestClose={requestComponentClose}
        onSubmit={saveComponent}
        patchComponent={patchComponent}
        deleteComponent={deleteComponent}
        componentEditorValid={componentEditorValid}
        componentNameTouched={componentNameTouched}
        setComponentNameTouched={setComponentNameTouched}
        isExistingComponent={Boolean(
          componentEditor &&
          draft?.components.some((component) => component.key === componentEditor.key),
        )}
        canDelete={(draft?.components.length ?? 0) > 1}
      />
      <ConfirmationDialog
        open={Boolean(confirmItem)}
        title={confirmItem?.isActive ? "Arsipkan template?" : "Aktifkan kembali template?"}
        description={
          confirmItem
            ? `${confirmItem.name} ${confirmItem.isActive ? "tidak akan muncul sebagai pilihan aktif." : "akan kembali tersedia sebagai pilihan."}`
            : ""
        }
        confirmLabel={confirmItem?.isActive ? "Arsipkan" : "Aktifkan"}
        danger={Boolean(confirmItem?.isActive)}
        pending={pending}
        onClose={() => setConfirmItem(null)}
        onConfirm={confirmToggle}
      />
      <ConfirmationDialog
        open={confirmClose}
        title="Buang perubahan template?"
        description="Rincian biaya, harga klien, dan catatan yang belum disimpan akan hilang."
        tone="danger"
        onClose={() => setConfirmClose(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setConfirmClose(false)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold"
            >
              Lanjut Mengedit
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                setDraft(null);
                setDraftBaseline("");
                setConfirmClose(false);
              }}
              className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white"
            >
              Buang Perubahan
            </motion.button>
          </div>
        }
      />
      <ConfirmationDialog
        open={confirmComponentClose}
        title="Buang perubahan komponen?"
        description="Isian komponen ini belum diterapkan ke template harga."
        tone="danger"
        onClose={() => setConfirmComponentClose(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setConfirmComponentClose(false)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold"
            >
              Lanjut Mengedit
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                setComponentEditor(null);
                setComponentEditorBaseline("");
                setConfirmComponentClose(false);
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
