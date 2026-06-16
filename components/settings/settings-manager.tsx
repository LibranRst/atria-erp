"use client";

import React from "react";

import {
  archiveItemPriceLibraryItem,
  archiveMaterial,
  createItemPriceLibraryItem,
  updateBudgetAllocationCategoryRatio,
  updateBudgetAllocationSetting,
  updateExpenseCategorySetting,
  updateMaterialInventoryDefaults,
  type ExpenseCategorySettingRow,
  type ItemPriceLibraryRow,
  type MaterialSettingRow,
  type SettingsOverview,
} from "@/app/actions/settings/system";
import { Badge } from "@/components/ui/badge";

type SettingsManagerProps = {
  readonly initialOverview: SettingsOverview;
};

type Notice = {
  readonly type: "success" | "error";
  readonly message: string;
};

const inputClass = "min-h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm font-medium text-on-surface outline-none focus:border-primary";
const labelClass = "space-y-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant";

function formatPercent(value: number): string {
  return (value * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function formatCurrency(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function parsePercent(value: string): number {
  const normalized = Number(value.replace(",", "."));
  if (Number.isNaN(normalized)) return 0;
  return normalized / 100;
}

function parseMoney(value: FormDataEntryValue | null): number {
  const normalized = String(value ?? "0").replaceAll(".", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function categoryBadgeStatus(used: boolean): "HEALTHY" | "DRAFT" {
  return used ? "HEALTHY" : "DRAFT";
}

export function SettingsManager({ initialOverview }: SettingsManagerProps): React.JSX.Element {
  const [overview, setOverview] = React.useState<SettingsOverview>(initialOverview);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const setting = overview.budgetAllocationSetting;
  const permissions = overview.permissions;

  function showNotice(type: Notice["type"], message: string): void {
    setNotice({ type, message });
  }

  function handleBudgetSettingSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!setting) return;
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBudgetAllocationSetting({
        budgetAllocationSettingId: setting.id,
        name: String(formData.get("name") ?? ""),
        budgetCapRatio: parsePercent(String(formData.get("budgetCapRatio") ?? "0")),
        notes: String(formData.get("notes") ?? ""),
      });

      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({ ...current, budgetAllocationSetting: result.data }));
      showNotice("success", "Budget Allocation berhasil diperbarui.");
    });
  }

  function handleBudgetCategorySubmit(event: React.FormEvent<HTMLFormElement>, categoryId: string): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateBudgetAllocationCategoryRatio({
        budgetAllocationSettingCategoryId: categoryId,
        ratioPercentage: parsePercent(String(formData.get("ratioPercentage") ?? "0")),
        isEnabled: formData.get("isEnabled") === "on",
      });

      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({
        ...current,
        budgetAllocationSetting: current.budgetAllocationSetting
          ? {
              ...current.budgetAllocationSetting,
              categories: current.budgetAllocationSetting.categories.map((category) =>
                category.id === result.data.id ? result.data : category
              ),
            }
          : null,
        expenseCategories: current.expenseCategories.map((category) =>
          category.id === result.data.expenseCategoryId
            ? { ...category, defaultRatio: result.data.ratioPercentage, isActive: result.data.isEnabled }
            : category
        ),
      }));
      showNotice("success", `${result.data.name} ratio berhasil diperbarui.`);
    });
  }

  function handleExpenseCategorySubmit(event: React.FormEvent<HTMLFormElement>, category: ExpenseCategorySettingRow): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateExpenseCategorySetting({
        expenseCategoryId: category.id,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        defaultRatio: parsePercent(String(formData.get("defaultRatio") ?? "0")),
        isActive: formData.get("isActive") === "on",
      });

      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({
        ...current,
        expenseCategories: current.expenseCategories.map((item) => item.id === result.data.id ? result.data : item),
      }));
      showNotice("success", `${result.data.name} berhasil diperbarui.`);
    });
  }

  function handleCreateItem(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createItemPriceLibraryItem({
        expenseCategoryId: String(formData.get("expenseCategoryId") ?? ""),
        materialId: String(formData.get("materialId") || "") || null,
        code: String(formData.get("code") ?? ""),
        itemType: String(formData.get("itemType") ?? "CLIENT_LINE") as "MATERIAL_ITEM" | "WORK_PACKAGE" | "SUBCON_PACKAGE" | "CLIENT_LINE",
        itemCategory: String(formData.get("itemCategory") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        defaultClientPrice: parseMoney(formData.get("defaultClientPrice")),
        defaultInternalCost: parseMoney(formData.get("defaultInternalCost")),
      });

      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({ ...current, itemLibrary: [result.data, ...current.itemLibrary] }));
      form.reset();
      showNotice("success", "Item library berhasil ditambahkan.");
    });
  }

  function handleArchiveItem(item: ItemPriceLibraryRow): void {
    startTransition(async () => {
      const result = await archiveItemPriceLibraryItem({ itemPriceLibraryId: item.id });
      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({
        ...current,
        itemLibrary: current.itemLibrary.map((row) => row.id === item.id ? { ...row, isActive: false } : row),
      }));
      showNotice("success", `${item.name} diarsipkan dari pilihan baru.`);
    });
  }

  function handleInventoryDefaultsSubmit(event: React.FormEvent<HTMLFormElement>, inventoryId: string): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateMaterialInventoryDefaults({
        materialInventoryId: inventoryId,
        minimumStock: Number(formData.get("minimumStock") ?? 0),
        averageCost: parseMoney(formData.get("averageCost")),
        lastPurchasePrice: parseMoney(formData.get("lastPurchasePrice")),
      });

      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({
        ...current,
        materials: current.materials.map((material) => ({
          ...material,
          inventory: material.inventory.map((inventory) => inventory.id === result.data.id ? result.data : inventory),
        })),
      }));
      showNotice("success", "Default inventory material berhasil diperbarui.");
    });
  }

  function handleArchiveMaterial(material: MaterialSettingRow): void {
    startTransition(async () => {
      const result = await archiveMaterial({ materialId: material.id });
      if (!result.success) {
        showNotice("error", result.error.message);
        return;
      }

      setOverview((current) => ({
        ...current,
        materials: current.materials.map((row) => row.id === material.id ? { ...row, isActive: false } : row),
      }));
      showNotice("success", `${material.name} dinonaktifkan dari pilihan material baru.`);
    });
  }

  return (
    <div className="space-y-lg">
      {notice ? (
        <div className={`premium-card p-md border ${notice.type === "success" ? "border-success/30" : "border-error/30"} flex items-start gap-3`}>
          <span className={`material-symbols-outlined ${notice.type === "success" ? "text-success" : "text-error"}`}>
            {notice.type === "success" ? "check_circle" : "error"}
          </span>
          <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface">{notice.message}</p>
        </div>
      ) : null}

      <section className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="flex items-start justify-between gap-md">
          <div className="space-y-1">
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Budget Allocation</p>
            <h2 className="font-headline-sm text-on-surface">Default Project Budget</h2>
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">Dipakai saat membuat Project Budget baru. Per project tetap bisa override.</p>
          </div>
          <Badge status={permissions.canManageBudgetSettings ? "PRIMARY" : "DRAFT"}>
            {permissions.canManageBudgetSettings ? "Editable" : "Read Only"}
          </Badge>
        </div>

        {setting ? (
          <>
            <form onSubmit={handleBudgetSettingSubmit} className="grid gap-sm">
              <label className={labelClass}>
                Nama default
                <input className={inputClass} name="name" defaultValue={setting.name} disabled={!permissions.canManageBudgetSettings || isPending} />
              </label>
              <label className={labelClass}>
                Internal budget cap %
                <input className={inputClass} name="budgetCapRatio" inputMode="decimal" defaultValue={formatPercent(setting.budgetCapRatio)} disabled={!permissions.canManageBudgetSettings || isPending} />
              </label>
              <label className={labelClass}>
                Catatan
                <textarea className={`${inputClass} min-h-20 resize-none`} name="notes" defaultValue={setting.notes ?? ""} disabled={!permissions.canManageBudgetSettings || isPending} />
              </label>
              {permissions.canManageBudgetSettings ? (
                <button className="min-h-11 rounded-2xl bg-primary px-4 font-bold text-on-primary active:scale-[0.99]" disabled={isPending} type="submit">
                  Save Budget Default
                </button>
              ) : null}
            </form>

            <div className="grid gap-sm">
              {setting.categories.map((category) => (
                <form key={category.id} onSubmit={(event) => handleBudgetCategorySubmit(event, category.id)} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-sm space-y-sm">
                  <div className="flex items-center justify-between gap-sm">
                    <div>
                      <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface">{category.name}</p>
                      <p className="text-[10px] font-semibold text-on-surface-variant">{category.code}</p>
                    </div>
                    <Badge status={categoryBadgeStatus(category.isEnabled)}>{category.isEnabled ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-sm items-end">
                    <label className={labelClass}>
                      Ratio %
                      <input className={inputClass} name="ratioPercentage" inputMode="decimal" defaultValue={formatPercent(category.ratioPercentage)} disabled={!permissions.canManageBudgetSettings || isPending} />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-outline-variant/20 px-3 text-xs font-bold text-on-surface">
                      <input name="isEnabled" type="checkbox" defaultChecked={category.isEnabled} disabled={!permissions.canManageBudgetSettings || isPending} />
                      On
                    </label>
                  </div>
                  {permissions.canManageBudgetSettings ? (
                    <button className="min-h-10 w-full rounded-2xl bg-surface border border-outline-variant/30 font-bold text-primary" disabled={isPending} type="submit">
                      Update {category.name}
                    </button>
                  ) : null}
                </form>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-warning/30 bg-warning-light p-md text-sm font-semibold text-warning">
            Budget Allocation default belum tersedia. Jalankan migration/seed Settings terlebih dahulu.
          </div>
        )}
      </section>

      <section className="space-y-sm">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Expense Categories</h2>
          <Badge status={permissions.canManageExpenseCategories ? "PRIMARY" : "DRAFT"}>
            {permissions.canManageExpenseCategories ? "Managed" : "Locked"}
          </Badge>
        </div>
        <div className="space-y-sm">
          {overview.expenseCategories.map((category) => (
            <form key={category.id} onSubmit={(event) => handleExpenseCategorySubmit(event, category)} className="premium-card p-md border border-outline-variant/30 space-y-sm">
              <div className="flex items-center justify-between gap-sm">
                <div>
                  <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface">{category.name}</p>
                  <p className="text-[10px] font-semibold text-on-surface-variant">{category.code} • Default {formatPercent(category.defaultRatio)}%</p>
                </div>
                <Badge status={category.isActive ? "HEALTHY" : "DRAFT"}>{category.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <label className={labelClass}>
                Nama kategori
                <input className={inputClass} name="name" defaultValue={category.name} disabled={!permissions.canManageExpenseCategories || isPending} />
              </label>
              <label className={labelClass}>
                Deskripsi
                <input className={inputClass} name="description" defaultValue={category.description ?? ""} disabled={!permissions.canManageExpenseCategories || isPending} />
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-sm items-end">
                <label className={labelClass}>
                  Default ratio %
                  <input className={inputClass} name="defaultRatio" defaultValue={formatPercent(category.defaultRatio)} disabled={!permissions.canManageExpenseCategories || isPending} />
                </label>
                <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-outline-variant/20 px-3 text-xs font-bold text-on-surface">
                  <input name="isActive" type="checkbox" defaultChecked={category.isActive} disabled={!permissions.canManageExpenseCategories || isPending} />
                  On
                </label>
              </div>
              {permissions.canManageExpenseCategories ? (
                <button className="min-h-10 w-full rounded-2xl bg-surface border border-outline-variant/30 font-bold text-primary" disabled={isPending} type="submit">
                  Save Category
                </button>
              ) : null}
            </form>
          ))}
        </div>
      </section>

      <section className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="flex items-start justify-between gap-md">
          <div className="space-y-1">
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Item & Price Library</p>
            <h2 className="font-headline-sm text-on-surface">Reusable Estimate Items</h2>
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">Referensi harga dan scope untuk RAP, package, dan quotation.</p>
          </div>
          <Badge status={permissions.canManageItemLibrary ? "PRIMARY" : "DRAFT"}>
            {`${overview.itemLibrary.filter((item) => item.isActive).length} Active`}
          </Badge>
        </div>

        {permissions.canManageItemLibrary ? (
          <form onSubmit={handleCreateItem} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-sm space-y-sm">
            <div className="grid gap-sm">
              <label className={labelClass}>
                Nama item
                <input className={inputClass} name="name" placeholder="Cabinet package" required disabled={isPending} />
              </label>
              <div className="grid grid-cols-2 gap-sm">
                <label className={labelClass}>
                  Type
                  <select className={inputClass} name="itemType" defaultValue="CLIENT_LINE" disabled={isPending}>
                    <option value="MATERIAL_ITEM">Material Item</option>
                    <option value="WORK_PACKAGE">Work Package</option>
                    <option value="SUBCON_PACKAGE">Subcon Package</option>
                    <option value="CLIENT_LINE">Client Line</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Unit
                  <input className={inputClass} name="unit" placeholder="ls" required disabled={isPending} />
                </label>
              </div>
              <label className={labelClass}>
                Item category
                <input className={inputClass} name="itemCategory" placeholder="Kitchen accessories" required disabled={isPending} />
              </label>
              <div className="grid grid-cols-2 gap-sm">
                <label className={labelClass}>
                  Expense category
                  <select className={inputClass} name="expenseCategoryId" disabled={isPending}>
                    {overview.expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Material link
                  <select className={inputClass} name="materialId" disabled={isPending}>
                    <option value="">None</option>
                    {overview.materials.map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-sm">
                <label className={labelClass}>
                  Client price
                  <input className={inputClass} name="defaultClientPrice" inputMode="numeric" placeholder="0" disabled={isPending} />
                </label>
                <label className={labelClass}>
                  Internal cost
                  <input className={inputClass} name="defaultInternalCost" inputMode="numeric" placeholder="0" disabled={isPending} />
                </label>
              </div>
              <input className={inputClass} name="code" placeholder="Optional code" disabled={isPending} />
              <textarea className={`${inputClass} min-h-20 resize-none`} name="description" placeholder="Specification or scope description" disabled={isPending} />
            </div>
            <button className="min-h-11 w-full rounded-2xl bg-primary px-4 font-bold text-on-primary active:scale-[0.99]" disabled={isPending} type="submit">
              Add Library Item
            </button>
          </form>
        ) : null}

        <div className="space-y-sm">
          {overview.itemLibrary.map((item) => (
            <div key={item.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-sm space-y-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface truncate">{item.name}</p>
                  <p className="text-[10px] font-semibold text-on-surface-variant">{item.itemType} • {item.expenseCategoryCode}</p>
                </div>
                <Badge status={item.isActive ? "HEALTHY" : "DRAFT"}>{item.isActive ? "Active" : "Archived"}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-sm text-xs font-semibold text-on-surface">
                <span>Client: {formatCurrency(item.defaultClientPrice)}</span>
                <span>Internal: {formatCurrency(item.defaultInternalCost)}</span>
              </div>
              {permissions.canManageItemLibrary && item.isActive ? (
                <button className="min-h-10 w-full rounded-2xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant" disabled={isPending} onClick={() => handleArchiveItem(item)} type="button">
                  Archive Item
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-sm">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Material Master</h2>
          <Badge status={permissions.canManageMaterialSettings ? "PRIMARY" : "DRAFT"}>
            {permissions.canManageMaterialSettings ? "Editable" : "Read Only"}
          </Badge>
        </div>
        <div className="space-y-sm">
          {overview.materials.map((material) => (
            <div key={material.id} className="premium-card p-md border border-outline-variant/30 space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div className="min-w-0">
                  <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface truncate">{material.name}</p>
                  <p className="text-[10px] font-semibold text-on-surface-variant truncate">
                    {material.categoryName} • {material.unit} • {material.defaultVendorName ?? "No vendor"}
                  </p>
                </div>
                <Badge status={material.isActive ? "HEALTHY" : "DRAFT"}>{material.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              {material.inventory.map((inventory) => (
                <form key={inventory.id} onSubmit={(event) => handleInventoryDefaultsSubmit(event, inventory.id)} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-sm space-y-sm">
                  <p className="text-[11px] font-bold text-on-surface">{inventory.locationName}</p>
                  <div className="grid grid-cols-3 gap-sm text-center text-[10px] font-semibold text-on-surface-variant">
                    <span>Current {inventory.currentStock}</span>
                    <span>Reserved {inventory.reservedStock}</span>
                    <span>Min {inventory.minimumStock}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-sm">
                    <label className={labelClass}>
                      Min
                      <input className={inputClass} name="minimumStock" type="number" step="0.01" defaultValue={inventory.minimumStock} disabled={!permissions.canManageMaterialSettings || isPending} />
                    </label>
                    <label className={labelClass}>
                      Avg cost
                      <input className={inputClass} name="averageCost" inputMode="numeric" defaultValue={inventory.averageCost} disabled={!permissions.canManageMaterialSettings || isPending} />
                    </label>
                    <label className={labelClass}>
                      Last price
                      <input className={inputClass} name="lastPurchasePrice" inputMode="numeric" defaultValue={inventory.lastPurchasePrice} disabled={!permissions.canManageMaterialSettings || isPending} />
                    </label>
                  </div>
                  {permissions.canManageMaterialSettings ? (
                    <button className="min-h-10 w-full rounded-2xl bg-surface border border-outline-variant/30 font-bold text-primary" disabled={isPending} type="submit">
                      Save Inventory Defaults
                    </button>
                  ) : null}
                </form>
              ))}
              {permissions.canManageMaterialSettings && material.isActive ? (
                <button className="min-h-10 w-full rounded-2xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant" disabled={isPending} onClick={() => handleArchiveMaterial(material)} type="button">
                  Deactivate Material
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
