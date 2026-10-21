"use client";

import { usePathname } from "next/navigation";

export default function AdminLoading(): React.JSX.Element {
  const pathname = usePathname();
  const overview = pathname.endsWith("/ledger") || pathname === "/admin";
  const editor =
    pathname.includes("/settings") ||
    pathname.includes("/onboarding") ||
    /\/projects\/[^/]+$/.test(pathname) ||
    pathname.endsWith("/new");
  return (
    <section role="status" aria-label="Memuat workspace" className="space-y-lg">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-full bg-surface-container" />
        <div className="h-4 w-64 max-w-full rounded-full bg-surface-container-low" />
      </div>
      <div className="h-12 max-w-160 rounded-full bg-surface-container-low" />
      {overview ? (
        <div className="grid gap-lg xl:grid-cols-[2fr_1fr]">
          <div className="h-60 rounded-owner bg-surface-inverse shadow-inverse" />
          <div className="h-60 rounded-owner bg-surface-container-lowest shadow-surface" />
        </div>
      ) : null}
      <div className={`grid gap-lg ${editor ? "xl:grid-cols-2" : "xl:grid-cols-[2fr_1fr]"}`}>
        <div className="overflow-hidden rounded-owner bg-surface-container-lowest shadow-surface">
          <div className="h-14 border-b border-outline-variant/25 bg-surface-container-low" />
          {Array.from({ length: editor ? 4 : 6 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-16 gap-4 border-b border-outline-variant/25 px-5 py-5"
            >
              <div className="h-4 flex-1 rounded-full bg-surface-container-low" />
              <div className="h-4 w-24 rounded-full bg-surface-container-low" />
            </div>
          ))}
        </div>
        <div className="space-y-5 rounded-owner bg-surface-container-lowest p-5 shadow-surface">
          <div className="h-5 w-36 rounded-full bg-surface-container" />
          <div className="h-24 rounded-inset bg-surface-container-low" />
          <div className="h-4 rounded-full bg-surface-container-low" />
          <div className="h-4 w-3/4 rounded-full bg-surface-container-low" />
        </div>
      </div>
      <span className="sr-only">Data dan tindakan workspace sedang disiapkan.</span>
    </section>
  );
}
