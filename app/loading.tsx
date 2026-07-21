import React from "react";

export default function AppLoading(): React.JSX.Element {
  return (
    <div className="space-y-md" role="status" aria-label="Memuat halaman">
      <div className="h-16 rounded-3xl bg-surface-container" />
      <div className="h-11 rounded-full bg-surface-container" />
      <div className="rounded-[28px] bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.04)]">
        <div className="h-3 w-24 rounded-full bg-surface-container" />
        <div className="mt-4 h-9 w-4/5 rounded-full bg-surface-container" />
        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="h-20 rounded-2xl bg-surface-container-low" />
          <div className="h-20 rounded-2xl bg-surface-container-low" />
        </div>
      </div>
      <span className="sr-only">Memuat data operasional…</span>
    </div>
  );
}
