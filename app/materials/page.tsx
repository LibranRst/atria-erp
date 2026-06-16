import React from "react";
import { redirect } from "next/navigation";
import { getMaterialInventory, getMaterialShortages } from "@/app/actions/material/inventory";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";

function formatNumber(value: number): string {
  return value.toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export default async function MaterialsPage(): Promise<React.JSX.Element> {
  const [inventoryResult, shortageResult] = await Promise.all([
    getMaterialInventory(),
    getMaterialShortages(),
  ]);

  if (!inventoryResult.success) {
    if (inventoryResult.error.code === "UNAUTHORIZED") {
      redirect("/login");
    }

    return (
      <section className="py-16 text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-error-container/20 border border-error flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-[28px]">warning</span>
        </div>
        <h1 className="font-sans text-[20px] leading-[28px] font-semibold text-on-surface">Akses Material Ditolak</h1>
        <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">{inventoryResult.error.message}</p>
      </section>
    );
  }

  const inventory = inventoryResult.data;
  const shortages = shortageResult.success ? shortageResult.data.filter((item) => item.needToBuy > 0) : [];
  const totalStockValue = inventory.reduce((sum, item) => sum + item.currentStock * item.averageCost, 0);
  const totalReusableValue = inventory.reduce((sum, item) => sum + Math.max(0, item.availableStock) * item.averageCost, 0);
  const lowStockCount = inventory.filter((item) => item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK" || item.status === "RESERVED").length;

  // Resolve user role to show settings shortcut link
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });
  const roleName = session?.user ? await resolveRoleName((session.user as any).roleId) : null;
  const showSettingsShortcut = roleName === "OWNER" || roleName === "FINANCE_ADMIN" || roleName === "PURCHASING";

  return (
    <section className="space-y-lg select-none">
      <div className="space-y-base px-1">
        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Material Control</p>
        <h1 className="font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface">Material & Stock</h1>
        <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">
          Ringkasan stock, shortage, dan material reusable untuk proyek Dekoria.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <div className="premium-card p-md border border-outline-variant/30">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Nilai Stock</p>
          <p className="font-mono text-[16px] leading-[20px] font-medium text-primary font-bold financial-amount mt-1">
            {formatCurrency(totalStockValue)}
          </p>
        </div>
        <div className="premium-card p-md border border-outline-variant/30">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Reusable Available</p>
          <p className="font-mono text-[16px] leading-[20px] font-medium text-on-surface font-bold financial-amount mt-1">
            {formatCurrency(totalReusableValue)}
          </p>
        </div>
        <div className="premium-card p-md border border-outline-variant/30">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Low / Reserved</p>
          <p className="font-mono text-[16px] leading-[20px] font-medium text-secondary font-bold mt-1">{lowStockCount}</p>
        </div>
        <div className="premium-card p-md border border-outline-variant/30">
          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Need to Buy</p>
          <p className="font-mono text-[16px] leading-[20px] font-medium text-error font-bold mt-1">{shortages.length}</p>
        </div>
      </div>

      <section className="space-y-sm">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Material Shortage</h2>
          <Badge status={shortages.length > 0 ? "WARNING" : "HEALTHY"}>
            {shortages.length > 0 ? "Butuh Beli" : "Aman"}
          </Badge>
        </div>

        {shortages.length === 0 ? (
          <div className="premium-card p-md border border-outline-variant/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-success">check_circle</span>
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">Tidak ada shortage material dari RAP saat ini.</p>
          </div>
        ) : (
          <div className="space-y-sm">
            {shortages.slice(0, 5).map((item) => (
              <div key={item.projectRapItemId} className="premium-card p-md border border-secondary/30 space-y-sm">
                <div className="flex items-start justify-between gap-md">
                  <div className="min-w-0">
                    <h3 className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface truncate">{item.materialName}</h3>
                    <p className="text-[11px] text-on-surface-variant">{item.area}</p>
                  </div>
                  <Badge status="WARNING">{`Kurang ${formatNumber(item.needToBuy)}`}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-sm text-[10px] font-semibold text-on-surface">
                  <span>Total: {formatNumber(item.totalQuantity)}</span>
                  <span>Ready: {formatNumber(item.availableStock)}</span>
                  <span>Budget: {formatCurrency(item.estimatedTotalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-sm">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Inventory</h2>
          {showSettingsShortcut && (
            <Link
              href="/settings"
              className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-1 -mr-1"
              aria-label="Pengaturan Material"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </Link>
          )}
        </div>
        <div className="space-y-sm">
          {inventory.map((item) => (
            <div key={item.inventoryId} className="premium-card p-md border border-outline-variant/30 space-y-md">
              <div className="flex items-start justify-between gap-md">
                <div className="min-w-0 space-y-1">
                  <h3 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface truncate">{item.materialName}</h3>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {item.categoryName} • {item.locationName}
                  </p>
                </div>
                <Badge status={item.status === "AVAILABLE" ? "HEALTHY" : item.status === "LOW_STOCK" || item.status === "RESERVED" ? "WARNING" : "CRITICAL"}>
                  {item.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-sm text-center">
                <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Current</p>
                  <p className="font-bold text-on-surface">{formatNumber(item.currentStock)}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Reserved</p>
                  <p className="font-bold text-secondary">{formatNumber(item.reservedStock)}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Available</p>
                  <p className="font-bold text-primary">{formatNumber(item.availableStock)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-outline-variant/10 pt-sm text-[11px] font-semibold text-on-surface-variant">
                <span>Avg: {formatCurrency(item.averageCost)}</span>
                <span>Last: {formatCurrency(item.lastPurchasePrice)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
