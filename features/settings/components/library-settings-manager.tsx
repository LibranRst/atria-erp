"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CirclePlus, FileSearch, Trash2 } from "lucide-react";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";

import {
  setItemPriceLibraryItemActive,
  type ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import {
  upsertPricingTemplate,
  type PricingTemplateRow,
} from "@/app/actions/settings/pricing-library";
import { ConfirmationSheet, EmptyState, SettingsHeader } from "./settings-ui";
import {
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  ConfirmationModal,
  DatePickerField,
  FilterSelect,
  FormDisclosure,
  FormField,
  FormRiskNotice,
  FormSection,
  OperationalFormSheet,
  MoneyInput,
  NumericInput,
  SheetSelect,
  Textarea,
  TextInput,
  ValuePreviewStrip,
} from "@/components/ui";
import { createClientId } from "@/lib/utils/client-id";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { MoneyValue } from "@/components/ui/page-primitives";
import { SettingsFilterBar } from "./settings-filter-bar";
import {
  SettingsGroupSurface,
  SettingsModuleHeader,
  SettingsRowChevron,
  SettingsStatusLabel,
} from "./settings-primitives";

type ItemType = "MATERIAL_ITEM" | "WORK_PACKAGE" | "SUBCON_PACKAGE" | "CLIENT_LINE";
type ComponentType = "LABOR" | "MATERIAL" | "EQUIPMENT" | "LOGISTICS" | "OVERHEAD" | "OTHER";
type CostComponentDraft = {
  readonly key: string;
  readonly vendorId: string | null;
  readonly componentType: ComponentType;
  readonly label: string;
  readonly quantity: number;
  readonly unit: string;
  readonly unitCost: number;
  readonly note: string;
};
type Draft = {
  readonly id?: string;
  readonly expenseCategoryId: string;
  readonly materialId: string | null;
  readonly defaultVendorId: string | null;
  readonly code: string;
  readonly itemType: ItemType;
  readonly itemCategory: string;
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly pricingMode: "MARGIN_BASED" | "FIXED_CLIENT_PRICE";
  readonly targetGrossPercentage: number;
  readonly fixedClientPrice: number;
  readonly priceSourceType: "COST_BREAKDOWN" | "VENDOR_QUOTE" | "HISTORICAL" | "LEGACY_BACKFILL";
  readonly sourceNote: string;
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly components: readonly CostComponentDraft[];
};
type MaterialOption = {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
};
type VendorOption = { readonly id: string; readonly name: string };
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
const COMPONENT_TYPES: readonly ComponentType[] = [
  "LABOR",
  "MATERIAL",
  "EQUIPMENT",
  "LOGISTICS",
  "OVERHEAD",
  "OTHER",
];
const COMPONENT_TYPE_LABELS: Readonly<Record<ComponentType, string>> = {
  LABOR: "Tenaga kerja",
  MATERIAL: "Material",
  EQUIPMENT: "Peralatan",
  LOGISTICS: "Logistik",
  OVERHEAD: "Overhead",
  OTHER: "Lainnya",
};
const ITEM_TYPE_LABELS: Readonly<Record<ItemType, string>> = {
  CLIENT_LINE: "Baris klien",
  MATERIAL_ITEM: "Material",
  WORK_PACKAGE: "Paket Tukang",
  SUBCON_PACKAGE: "Paket Subcon",
};
const PRICE_SOURCE_LABELS: Readonly<Record<Draft["priceSourceType"], string>> = {
  COST_BREAKDOWN: "Rincian biaya",
  VENDOR_QUOTE: "Penawaran vendor",
  HISTORICAL: "Riwayat harga",
  LEGACY_BACKFILL: "Data lama",
};
function itemTypeLabel(value: string): string {
  if (value === "CLIENT_LINE") return ITEM_TYPE_LABELS.CLIENT_LINE;
  if (value === "MATERIAL_ITEM") return ITEM_TYPE_LABELS.MATERIAL_ITEM;
  if (value === "WORK_PACKAGE") return ITEM_TYPE_LABELS.WORK_PACKAGE;
  if (value === "SUBCON_PACKAGE") return ITEM_TYPE_LABELS.SUBCON_PACKAGE;
  return formatBusinessLabel(value);
}
function priceSourceLabel(value: string): string {
  if (value === "COST_BREAKDOWN") return PRICE_SOURCE_LABELS.COST_BREAKDOWN;
  if (value === "VENDOR_QUOTE") return PRICE_SOURCE_LABELS.VENDOR_QUOTE;
  if (value === "HISTORICAL") return PRICE_SOURCE_LABELS.HISTORICAL;
  if (value === "LEGACY_BACKFILL") return PRICE_SOURCE_LABELS.LEGACY_BACKFILL;
  return formatBusinessLabel(value);
}
const fullMoney = (value: number): string => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
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
  const [message, setMessage] = React.useState<string | null>(null);
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
  function save(): void {
    if (!draft || !canSaveDraft) return;
    startTransition(async () => {
      const result = await upsertPricingTemplate({
        itemPriceLibraryId: draft.id,
        expenseCategoryId: draft.expenseCategoryId,
        materialId: draft.materialId,
        defaultVendorId: draft.defaultVendorId,
        code: draft.code || null,
        itemType: draft.itemType,
        itemCategory: draft.itemCategory,
        name: draft.name,
        description: draft.description || null,
        unit: draft.unit,
        pricingMode: draft.pricingMode,
        targetGrossPercentage: draft.targetGrossPercentage,
        fixedClientPrice:
          draft.pricingMode === "FIXED_CLIENT_PRICE" ? draft.fixedClientPrice : undefined,
        priceSourceType: draft.priceSourceType,
        sourceNote: draft.sourceNote,
        effectiveFrom: new Date(draft.effectiveFrom),
        isActive: draft.isActive,
        components: draft.components.map((component, index) => ({
          vendorId: component.vendorId,
          componentType: component.componentType,
          label: component.label,
          quantity: component.quantity,
          unit: component.unit,
          unitCost: component.unitCost,
          note: component.note || null,
          displayOrder: index,
        })),
      });
      if (result.success) {
        setItems((current) =>
          draft.id
            ? current.map((item) => (item.id === result.data.id ? result.data : item))
            : [result.data, ...current],
        );
        setDraft(null);
        setDraftBaseline("");
        setMessage("Template dan breakdown harga berhasil disimpan.");
        toast.success("Template dan breakdown harga berhasil disimpan.");
        onMutationComplete?.();
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }
  function confirmToggle(): void {
    if (!confirmItem) return;
    const target = confirmItem;
    startTransition(async () => {
      const result = await setItemPriceLibraryItemActive({
        itemPriceLibraryId: target.id,
        isActive: !target.isActive,
      });
      if (result.success) {
        setItems((current) =>
          current.map((item) =>
            item.id === target.id ? { ...item, isActive: result.data.isActive } : item,
          ),
        );
        if (draft?.id === target.id) {
          setDraft(null);
          setDraftBaseline("");
        }
        setConfirmItem(null);
        toast.success("Item berhasil diperbarui.");
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
        <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-primary ring-1 ring-primary/15">
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
            className="relative min-h-10 shrink-0 rounded-full bg-[#007AFF]/8 px-3.5 text-[10px] font-bold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] disabled:opacity-40"
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
          onResetFilters={() => {
            setType("ALL");
            setCategoryId("ALL");
            setStatus("ALL");
          }}
        >
          <FilterSelect label="Tipe" value={type} options={TYPE_FILTERS} onChange={setType} />
          <FilterSelect
            label="Kategori"
            value={categoryId}
            options={categoryFilters}
            onChange={setCategoryId}
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
        <SettingsGroupSurface>
          <div className="divide-y divide-black/5.5">
            {filtered.map((item) => {
              const margin =
                item.defaultClientPrice > 0
                  ? ((item.defaultClientPrice - item.defaultInternalCost) /
                      item.defaultClientPrice) *
                    100
                  : 0;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openDraft(toDraft(item))}
                  className={`flex w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75 ${presentation === "onboarding" ? "min-h-19" : "min-h-26"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] leading-5 font-bold text-on-surface">
                        {item.name}
                      </span>
                    </span>
                    <span className="block truncate text-[10px] leading-4 text-on-surface-variant">
                      {item.itemCategory} · {item.unit}
                      {item.code ? ` · ${item.code}` : ""}
                    </span>
                    {presentation === "settings" ? (
                      <span className="mt-2 grid grid-cols-2 gap-3">
                        <span className="min-w-0">
                          <span className="block text-[8px] font-bold tracking-wide text-on-surface-variant/60 uppercase">
                            Harga klien
                          </span>
                          <MoneyValue
                            amount={item.defaultClientPrice}
                            variant="compactWithFull"
                            size="xs"
                            tone="primary"
                            className="mt-1"
                          />
                        </span>
                        <span className="min-w-0 text-right">
                          <span className="block text-[8px] font-bold tracking-wide text-on-surface-variant/60 uppercase">
                            Biaya internal
                          </span>
                          <MoneyValue
                            amount={item.defaultInternalCost}
                            variant="compactWithFull"
                            size="xs"
                            align="right"
                            className="mt-1"
                          />
                        </span>
                      </span>
                    ) : (
                      <MoneyValue
                        amount={item.defaultClientPrice}
                        variant="compactWithFull"
                        size="xs"
                        tone="primary"
                        className="mt-1.5"
                      />
                    )}
                    {presentation === "settings" ? (
                      <span className="mt-2 flex justify-between gap-3 text-[9px] text-on-surface-variant">
                        <span className="truncate">
                          {item.components.length} komponen ·{" "}
                          {priceSourceLabel(item.priceSourceType)}
                        </span>
                        <span className="shrink-0 font-bold text-primary">
                          Margin{" "}
                          {margin.toLocaleString("id-ID", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <div className="flex flex-row items-center gap-2">
                    <SettingsStatusLabel
                      label={item.isActive ? itemTypeLabel(item.itemType) : "Diarsipkan"}
                      tone={item.isActive ? "neutral" : "inactive"}
                    />
                    <SettingsRowChevron />
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsGroupSurface>
      )}

      <OperationalFormSheet
        actionPlacement="header"
        open={Boolean(draft)}
        title={draft?.id ? "Edit Template Harga" : "Tambah Template Harga"}
        onClose={requestClose}
        pending={pending}
        disabled={!canManage || !canSaveDraft}
        disabledReason={draftDisabledReason}
        submitLabel="Simpan"
        submittingLabel="Menyimpan..."
        onSubmit={save}
        statusText={
          draft
            ? `${draft.components.length} komponen · ${fullMoney(internalCost)} · Margin ${grossMargin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
            : undefined
        }
        statusTone={!canSaveDraft ? "warning" : grossMargin < 0 ? "danger" : "success"}
      >
        {draft ? (
          <div className="space-y-md">
            <FormSection
              title="Identitas template"
              helper="Tipe menentukan konteks dan kategori budget yang digunakan."
            >
              <SheetSelect
                label="Tipe item"
                value={draft.itemType}
                onChange={(value) => changeType(value as ItemType)}
                options={[
                  { value: "CLIENT_LINE", label: "Baris Klien" },
                  { value: "MATERIAL_ITEM", label: "Material" },
                  { value: "WORK_PACKAGE", label: "Paket Tukang" },
                  { value: "SUBCON_PACKAGE", label: "Paket Subcon" },
                ]}
              />
              <SheetSelect
                label="Kategori pengeluaran"
                readOnly={draft.itemType !== "CLIENT_LINE"}
                value={draft.expenseCategoryId}
                onChange={(value) => setDraft({ ...draft, expenseCategoryId: value })}
                options={categories.map((row) => ({
                  value: row.id,
                  label: row.name,
                  description: row.code,
                }))}
              />
              <FormField
                label="Nama template"
                required
                error={
                  nameTouched && draft.name.trim().length < 2
                    ? "Nama template minimal 2 karakter."
                    : undefined
                }
              >
                <TextInput
                  value={draft.name}
                  onChange={(value) => {
                    setNameTouched(true);
                    setDraft({ ...draft, name: value });
                  }}
                  aria-invalid={nameTouched && draft.name.trim().length < 2}
                />
              </FormField>
              <FormField
                label="Kategori item"
                required
                error={
                  draft.itemCategory.trim().length < 2
                    ? "Kategori item minimal 2 karakter."
                    : undefined
                }
              >
                <TextInput
                  value={draft.itemCategory}
                  onChange={(value) => setDraft({ ...draft, itemCategory: value })}
                  aria-invalid={draft.itemCategory.trim().length < 2}
                />
              </FormField>
              <ComboboxField
                label="Satuan"
                value={draft.unit}
                onChange={(value) => setDraft({ ...draft, unit: value })}
                options={COMMON_UNIT_OPTIONS}
                error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined}
              />
              {draft.itemType === "MATERIAL_ITEM" ? (
                <SheetSelect
                  label="Tautan Material Master"
                  value={draft.materialId ?? ""}
                  onChange={(value) => setDraft({ ...draft, materialId: value || null })}
                  options={[
                    { value: "", label: "Tanpa tautan material" },
                    ...materials
                      .filter((row) => row.isActive)
                      .map((row) => ({ value: row.id, label: row.name })),
                  ]}
                />
              ) : null}
            </FormSection>

            <FormSection
              title="Rincian biaya"
              helper={`${draft.components.length} komponen membentuk biaya internal.`}
              action={
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={transitionSpringSnappy}
                  onClick={addComponent}
                  className="flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold text-[#007AFF] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/25"
                >
                  <CirclePlus className="h-4 w-4" aria-hidden="true" /> Tambah
                </motion.button>
              }
            >
              {draft.components.map((component, index) => {
                const complete = Boolean(
                  component.label.trim().length >= 2 &&
                  component.quantity > 0 &&
                  component.unit.trim(),
                );
                return (
                  <motion.button
                    key={component.key}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    transition={transitionSpringSnappy}
                    onClick={() => openComponent(component)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:bg-surface-container-low"
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-primary" : "bg-warning"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs leading-[1.15] font-bold text-on-surface">
                        {component.label.trim() || `Komponen ${index + 1}`}
                      </span>
                      <span className="mt-1 block truncate text-[10px] leading-[1.2] text-on-surface-variant">
                        {component.quantity} {component.unit} ·{" "}
                        {COMPONENT_TYPE_LABELS[component.componentType]} ·{" "}
                        {complete ? "Lengkap" : "Perlu diperiksa"}
                      </span>
                    </span>
                    <span className="max-w-[32%] shrink-0 truncate text-right text-xs font-bold text-on-surface tabular-nums">
                      {fullMoney(component.quantity * component.unitCost)}
                    </span>
                    <span
                      className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant"
                      aria-hidden="true"
                    >
                      chevron_right
                    </span>
                  </motion.button>
                );
              })}
            </FormSection>

            <FormSection
              title="Harga untuk klien"
              helper="Rekomendasi harga dan margin dihitung dari total komponen."
            >
              <SheetSelect
                label="Metode harga"
                value={draft.pricingMode}
                onChange={(pricingMode) =>
                  setDraft({
                    ...draft,
                    pricingMode: pricingMode as Draft["pricingMode"],
                  })
                }
                options={[
                  {
                    value: "MARGIN_BASED",
                    label: "Berdasarkan margin",
                    description: "Harga klien mengikuti target margin.",
                  },
                  {
                    value: "FIXED_CLIENT_PRICE",
                    label: "Harga tetap",
                    description: "Masukkan nominal jual secara langsung.",
                  },
                ]}
              />
              {draft.pricingMode === "MARGIN_BASED" ? (
                <FormField label="Target margin kotor (%)">
                  <NumericInput
                    min={0}
                    max={95}
                    value={draft.targetGrossPercentage * 100}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        targetGrossPercentage: Number(value || 0) / 100,
                      })
                    }
                    suffix="%"
                  />
                </FormField>
              ) : (
                <FormField label="Harga tetap untuk klien">
                  <MoneyInput
                    value={draft.fixedClientPrice}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        fixedClientPrice: Number(value || 0),
                      })
                    }
                  />
                </FormField>
              )}
              <div className="p-3">
                <div className="overflow-hidden rounded-[20px] bg-surface-container-low ring-1 ring-outline-variant/10">
                  <div className="grid grid-cols-2 divide-x divide-outline-variant/20">
                    <div className="min-w-0 p-3">
                      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                        Biaya internal
                      </p>
                      <MoneyValue
                        amount={internalCost}
                        variant="compactWithFull"
                        size="sm"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="min-w-0 p-3">
                      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                        Harga klien
                      </p>
                      <MoneyValue
                        amount={clientPrice}
                        variant="compactWithFull"
                        size="sm"
                        tone="primary"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex min-h-11 items-center justify-between gap-3 border-t border-outline-variant/20 px-3 py-2.5">
                    <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                      Margin kotor
                    </p>
                    <p
                      className={`shrink-0 text-sm font-bold tabular-nums ${grossMargin < 0 ? "text-error" : "text-primary"}`}
                    >
                      {grossMargin.toLocaleString("id-ID", {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </p>
                  </div>
                </div>
              </div>
              {grossMargin < 0 ? (
                <FormRiskNotice title="Harga di bawah biaya" tone="danger">
                  Naikkan harga klien atau periksa kembali rincian biaya sebelum menyimpan.
                </FormRiskNotice>
              ) : null}
            </FormSection>

            <FormDisclosure
              variant="compact"
              title="Sumber harga & detail"
              description="Tanggal dan catatan sumber wajib; detail lain opsional"
              summary={
                draft.sourceNote.trim().length >= 3
                  ? `${priceSourceLabel(draft.priceSourceType)} · sumber terisi`
                  : "Catatan sumber belum lengkap"
              }
              icon={<FileSearch className="h-4 w-4" />}
              expanded={showSourceDetails}
              onToggle={() => setShowSourceDetails((current) => !current)}
            >
              <FormSection
                title="Sumber & detail"
                helper="Data pendukung untuk audit dan penggunaan ulang template."
              >
                <FormField label="Kode" optional>
                  <TextInput
                    value={draft.code}
                    onChange={(value) => setDraft({ ...draft, code: value })}
                  />
                </FormField>
                <DatePickerField
                  label="Berlaku mulai"
                  value={draft.effectiveFrom}
                  onChange={(value) => setDraft({ ...draft, effectiveFrom: value })}
                />
                <SheetSelect
                  label="Vendor default"
                  value={draft.defaultVendorId ?? ""}
                  onChange={(value) => setDraft({ ...draft, defaultVendorId: value || null })}
                  options={[
                    { value: "", label: "Tanpa vendor default" },
                    ...vendors.map((vendor) => ({
                      value: vendor.id,
                      label: vendor.name,
                    })),
                  ]}
                />
                <SheetSelect
                  label="Sumber harga"
                  value={draft.priceSourceType}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      priceSourceType: value as Draft["priceSourceType"],
                    })
                  }
                  options={[
                    { value: "COST_BREAKDOWN", label: "Rincian biaya" },
                    { value: "VENDOR_QUOTE", label: "Penawaran vendor" },
                    { value: "HISTORICAL", label: "Riwayat harga" },
                    ...(draft.priceSourceType === "LEGACY_BACKFILL"
                      ? [
                          {
                            value: "LEGACY_BACKFILL",
                            label: "Data lama (kompatibilitas)",
                          },
                        ]
                      : []),
                  ]}
                />
                <FormField
                  label="Catatan sumber"
                  required
                  error={
                    sourceNoteTouched && draft.sourceNote.trim().length < 3
                      ? "Catatan sumber minimal 3 karakter."
                      : undefined
                  }
                >
                  <Textarea
                    value={draft.sourceNote}
                    onChange={(value) => {
                      setSourceNoteTouched(true);
                      setDraft({ ...draft, sourceNote: value });
                    }}
                    placeholder="Penawaran, referensi, tanggal, dan asumsi harga"
                    rows={2}
                    aria-invalid={sourceNoteTouched && draft.sourceNote.trim().length < 3}
                  />
                </FormField>
                <FormField label="Deskripsi" optional>
                  <Textarea
                    value={draft.description}
                    onChange={(value) => setDraft({ ...draft, description: value })}
                    rows={2}
                  />
                </FormField>
              </FormSection>
            </FormDisclosure>
            {draft.id ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                disabled={!canManage || pending || draftDirty}
                onClick={() => {
                  const item = items.find((row) => row.id === draft.id);
                  if (item) setConfirmItem(item);
                }}
                className="min-h-12 w-full rounded-full bg-error-container/20 px-5 text-xs font-bold text-error disabled:opacity-35"
              >
                {draft.isActive ? "Arsipkan template" : "Aktifkan kembali"}
              </motion.button>
            ) : null}
          </div>
        ) : null}
      </OperationalFormSheet>
      <OperationalFormSheet
        actionPlacement="header"
        open={Boolean(componentEditor)}
        title={
          componentEditor &&
          draft?.components.some((component) => component.key === componentEditor.key)
            ? "Edit Komponen Biaya"
            : "Tambah Komponen Biaya"
        }
        onClose={requestComponentClose}
        disabled={!componentEditorValid}
        disabledReason={
          !componentEditorValid
            ? "Lengkapi nama minimal 2 karakter, jumlah, satuan, dan biaya satuan."
            : undefined
        }
        submitLabel="Simpan"
        onSubmit={saveComponent}
        statusText={
          componentEditor
            ? `${componentEditor.label.trim() || "Komponen belum diisi"} · ${fullMoney(componentEditor.quantity * componentEditor.unitCost)}`
            : undefined
        }
        statusTone={componentEditorValid ? "success" : "warning"}
      >
        {componentEditor ? (
          <div className="space-y-md">
            <FormSection
              title="Jenis & nama biaya"
              helper="Satu komponen mewakili satu sumber biaya yang dapat digunakan kembali."
            >
              <SheetSelect
                label="Tipe komponen"
                value={componentEditor.componentType}
                onChange={(value) => patchComponent({ componentType: value as ComponentType })}
                options={COMPONENT_TYPES.map((value) => ({
                  value,
                  label: COMPONENT_TYPE_LABELS[value],
                }))}
              />
              <FormField
                label="Nama biaya"
                required
                error={
                  componentNameTouched && componentEditor.label.trim().length < 2
                    ? "Nama biaya minimal 2 karakter."
                    : undefined
                }
              >
                <TextInput
                  autoFocus
                  placeholder="Contoh: Material utama"
                  value={componentEditor.label}
                  onChange={(value) => {
                    setComponentNameTouched(true);
                    patchComponent({ label: value });
                  }}
                  aria-invalid={componentNameTouched && componentEditor.label.trim().length < 2}
                />
              </FormField>
            </FormSection>
            <FormSection
              title="Jumlah & biaya"
              helper="Subtotal diperbarui langsung sebelum komponen disimpan."
            >
              <FormField label="Jumlah">
                <NumericInput
                  min={0.01}
                  value={componentEditor.quantity}
                  onChange={(value) => patchComponent({ quantity: Number(value || 0) })}
                />
              </FormField>
              <ComboboxField
                label="Satuan"
                value={componentEditor.unit}
                onChange={(value) => patchComponent({ unit: value })}
                options={COMMON_UNIT_OPTIONS}
                error={!componentEditor.unit.trim() ? "Satuan wajib diisi." : undefined}
              />
              <FormField label="Biaya satuan">
                <MoneyInput
                  value={componentEditor.unitCost}
                  showPreview={false}
                  onChange={(value) => patchComponent({ unitCost: Number(value || 0) })}
                />
              </FormField>
              <div className="p-3">
                <ValuePreviewStrip
                  items={[
                    {
                      label: "Subtotal komponen",
                      amount: componentEditor.quantity * componentEditor.unitCost,
                      tone: "success",
                    },
                  ]}
                />
              </div>
            </FormSection>
            {draft?.components.some((component) => component.key === componentEditor.key) ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                disabled={(draft?.components.length ?? 0) <= 1}
                onClick={deleteComponent}
                className="min-h-12 w-full rounded-full bg-error-container/20 px-5 text-xs font-bold text-error disabled:opacity-35"
              >
                <Trash2 className="mr-1.5 inline h-4 w-4" /> Hapus Komponen
              </motion.button>
            ) : null}
          </div>
        ) : null}
      </OperationalFormSheet>
      <ConfirmationSheet
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
      <ConfirmationModal
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
      <ConfirmationModal
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
