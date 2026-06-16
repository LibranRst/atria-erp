"use client";

import React, { Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlobalExpenseDrawer } from "@/components/expense/global-drawer";

type MobileShellProps = Readonly<{
  children: React.ReactNode;
}>;

function getPageTitle(pathname: string): string {
  if (pathname === "/ledger") return "Dashboard";
  if (pathname === "/projects") return "Proyek";
  if (pathname.startsWith("/projects/")) return "Detail Proyek";
  if (pathname === "/expenses") return "Kas & Tagihan";
  if (pathname === "/expenses/new") return "Biaya Lapangan";
  if (pathname === "/materials") return "Material & Stok";
  if (pathname === "/profile") return "Profil Saya";
  if (pathname === "/settings") return "Pengaturan ERP";
  if (pathname === "/approvals") return "Persetujuan";
  return "Finance ERP";
}

function MobileHeader({
  isRootRoute,
  onOpenSidebar,
}: {
  readonly isRootRoute: boolean;
  readonly onOpenSidebar: () => void;
}): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const pageTitle = React.useMemo(() => {
    if (pathname === "/ledger" && searchParams.get("brief") === "true") {
      return "AI CFO Briefing";
    }
    return getPageTitle(pathname);
  }, [pathname, searchParams]);

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center h-14 bg-surface select-none border-b border-outline-variant/10">
      <div className="max-w-md mx-auto w-full px-margin-mobile flex justify-between items-center h-full">
        {/* Left Button: Sidebar Menu trigger or Back button */}
        <div className="w-10 h-10 flex items-center justify-start">
          {isRootRoute ? (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors active:scale-95 duration-200 text-on-surface-variant cursor-pointer"
              aria-label="Open navigation menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors active:scale-95 duration-200 text-on-surface-variant cursor-pointer"
              aria-label="Go back"
            >
              <span className="material-symbols-outlined text-[28px]">chevron_left</span>
            </button>
          )}
        </div>

        {/* Centered Page Title */}
        <h1 className="font-display text-on-surface text-[14px] font-semibold tracking-tight text-center flex-1 truncate px-2">
          {pageTitle}
        </h1>

        {/* Right Button: User Avatar Shortcut */}
        <div className="w-10 h-10 flex items-center justify-end">
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant active:scale-95 transition-transform shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuADXAgU9ZnQpX6SfXgQYugUs6zX_n5ZV1XzT3Xc0d3G0yfv06OjXLk-TGGlBYiXk8tf9MdiMQcVbLDEq93hiTESrINtDyGHnL4pjx1XN8uwqX5MOijHuYwCpcbc-cqQkVqpYi45yqRRYmD8h3RIOeurq-84cqZ33gtgCs8vmsCbbFt9gvEUp9BKLVNN4g7EdQ7I6Y_5rx_5-58PaiB0aya8NlPT0fvzxtPrvTspuv_czI9U5EpCRvLlY8x_tNrPwgtNZqeO_bLNxXjy"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MobileShell({ children }: MobileShellProps): React.JSX.Element {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(false);

  const isLoginPage = pathname === "/login";

  // Check if current route is a root-level tab route
  const isRootRoute = React.useMemo(() => {
    return ["/ledger", "/projects", "/materials", "/expenses", "/profile", "/settings", "/approvals"].includes(pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      {/* Top AppBar - Fixed, contents centered to match page width */}
      {!isLoginPage && (
        <Suspense fallback={<div className="h-14 bg-surface border-b border-outline-variant/10" />}>
          <MobileHeader isRootRoute={isRootRoute} onOpenSidebar={() => setIsSidebarOpen(true)} />
        </Suspense>
      )}

      {/* Screen Content - Space-y-lg handles margins between widgets automatically */}
      <main
        className={`mx-auto max-w-md w-full px-margin-mobile ${
          isLoginPage
            ? "pt-6 pb-6 min-h-screen flex flex-col justify-center"
            : "pt-20 pb-40 space-y-lg"
        }`}
      >
        {children}
      </main>

      {/* Sidebar Drawer component wrapped in Suspense */}
      {!isLoginPage && (
        <Suspense fallback={null}>
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </Suspense>
      )}

      {/* Bottom Navigation wrapped in Suspense */}
      {!isLoginPage && (
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      )}

      {/* Global Expense Drawer wrapped in Suspense */}
      {!isLoginPage && (
        <Suspense fallback={null}>
          <GlobalExpenseDrawer />
        </Suspense>
      )}
    </div>
  );
}
