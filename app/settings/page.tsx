import React from "react";
import { redirect } from "next/navigation";

import { getSettingsOverview } from "@/app/actions/settings/system";
import { SettingsManager } from "@/components/settings/settings-manager";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const overview = await getSettingsOverview();

  if (!overview.success) {
    if (overview.error.code === "UNAUTHORIZED") {
      redirect("/login");
    }

    return (
      <section className="py-16 text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-error-container/20 border border-error flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-[28px]">lock</span>
        </div>
        <h1 className="font-sans text-[20px] leading-[28px] font-semibold text-on-surface">Settings Tidak Tersedia</h1>
        <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">{overview.error.message}</p>
      </section>
    );
  }

  return (
    <section className="space-y-lg select-none">
      <div className="space-y-base px-1">
        <div className="flex items-start justify-between gap-md">
          <div className="space-y-base min-w-0">
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">System Settings</p>
            <h1 className="font-sans text-[24px] leading-[32px] tracking-tight font-semibold text-on-surface">ERP Source of Truth</h1>
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">
              Atur default budget, kategori biaya, item library, dan master material untuk workflow proyek Dekoria.
            </p>
          </div>
          <Badge status="PRIMARY">{overview.data.roleName}</Badge>
        </div>
      </div>

      <SettingsManager initialOverview={overview.data} />
    </section>
  );
}
