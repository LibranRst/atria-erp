import React from "react";

export default function AppLoading(): React.JSX.Element {
  return (
    <div className="space-y-md" role="status" aria-label="Memuat halaman">
      <div className="bg-surface-container h-16 rounded-[24px]" />
      <div className="bg-surface-container h-11 rounded-full" />
      <div className="p-md rounded-[28px] bg-white shadow-[0_14px_34px_rgba(17,17,17,0.04)]">
        <div className="bg-surface-container h-3 w-24 rounded-full" />
        <div className="bg-surface-container mt-4 h-9 w-4/5 rounded-full" />
        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="bg-surface-container-low h-20 rounded-2xl" />
          <div className="bg-surface-container-low h-20 rounded-2xl" />
        </div>
      </div>
      <span className="sr-only">Memuat data operasional…</span>
    </div>
  );
}
