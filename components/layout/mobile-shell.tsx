"use client";

import React, { Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { HeaderMorphMenu } from "@/components/layout/header-morph-menu";
import { getHeaderMenuItems, getPageTitle } from "@/components/layout/header-menu-config";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { GlobalExpenseDrawer } from "@/features/expenses/components/sheets/global-drawer";
import { GlobalProjectDrawer } from "@/features/projects/list/components/drawers/global-project-drawer";
import { GlobalVendorBillDrawer } from "@/features/expenses/components/sheets/global-vendor-bill-drawer";
import { GlobalInvoiceDrawer } from "@/features/projects/detail/components/invoices/global-invoice-drawer";
import { ProjectStateProvider } from "@/features/projects/detail/components/shared/project-state-context";
import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME } from "@/lib/auth/permissions";
import { transitionSpringBouncy, transitionSpringSmooth } from "@/lib/utils/motion";
import { AppIcon, ConnectivityBanner } from "@/components/ui";
import { DeveloperSimulationBanner } from "@/features/profile/components/developer/developer-simulation-banner";
import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";
type MobileShellProps = Readonly<{
  children: React.ReactNode;
}>;

type SessionUserWithRole = {
  readonly roleId?: unknown;
};

function getRoleName(user: unknown): string | null {
  if (typeof user !== "object" || user === null || !("roleId" in user)) {
    return null;
  }

  const roleId = (user as SessionUserWithRole).roleId;
  return typeof roleId === "string" ? (ROLE_ID_TO_NAME[roleId] ?? null) : null;
}

function MobileHeader({ isRootRoute }: { readonly isRootRoute: boolean }): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [openRouteKey, setOpenRouteKey] = React.useState<string | null>(null);
  const isMenuOpen = openRouteKey === routeKey;
  const hasBackButton = !isRootRoute;

  const pageTitle = React.useMemo(() => getPageTitle(pathname), [pathname]);
  const roleName = React.useMemo(() => getRoleName(session?.user ?? null), [session?.user]);
  const menuItems = React.useMemo(() => getHeaderMenuItems(roleName), [roleName]);

  return (
    <header
      className={`fixed top-0 left-0 flex h-14 w-full items-center select-none ${
        isMenuOpen ? "z-90" : "z-50"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-md items-center justify-between px-margin-mobile">
        <div className="relative h-10 w-22 shrink-0">
          <AnimatePresence>
            {hasBackButton && (
              <motion.button
                key="header-back-button"
                type="button"
                onClick={() => router.back()}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={hasBackButton ? transitionSpringBouncy : transitionSpringSmooth}
                className="absolute top-0 left-0 z-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-outline-variant/15 bg-white text-on-surface-variant shadow-raised transition-colors duration-200 hover:bg-surface-container-low active:scale-95"
                aria-label="Go back"
              >
                <AppIcon name="chevron_left" className="icon-2xl" />
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={() => toast("AI Chat segera hadir.")}
            animate={{ x: hasBackButton ? 46 : 0 }}
            transition={hasBackButton ? transitionSpringBouncy : transitionSpringSmooth}
            className="absolute top-0 left-0 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-outline-variant/15 bg-white text-on-surface-variant shadow-raised transition-colors duration-200 hover:bg-surface-container-low active:scale-95"
            aria-label="AI Chat segera hadir"
          >
            <MessageCircle aria-hidden="true" className="h-5 w-5" />
          </motion.button>
        </div>

        <HeaderMorphMenu
          isOpen={isMenuOpen}
          items={menuItems}
          pathname={pathname}
          searchParams={searchParams}
          title={pageTitle}
          onToggle={() => setOpenRouteKey((current) => (current === routeKey ? null : routeKey))}
          onClose={() => setOpenRouteKey(null)}
        />

        <div className="flex h-10 w-22 shrink-0 items-center justify-end">
          <Link
            href="/profile"
            className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-outline-variant transition-transform active:scale-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Avatar"
              className="h-full w-full object-cover"
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

  const isLoginPage =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/onboarding") ||
    pathname === "/profile/password";

  // Check if current route is a root-level tab route
  const isRootRoute = React.useMemo(() => {
    return [
      "/ledger",
      "/projects",
      "/materials",
      "/expenses",
      "/profile",
      "/settings",
      "/approvals",
    ].includes(pathname);
  }, [pathname]);

  return (
    <ProjectStateProvider>
      <ActivityDetailProvider>
        <div className="min-h-screen bg-background font-sans text-on-surface">
          {/* Top AppBar - Fixed, contents centered to match page width */}
          {!isLoginPage && (
            <Suspense
              fallback={<div className="h-14 border-b border-outline-variant/10 bg-surface" />}
            >
              <MobileHeader isRootRoute={isRootRoute} />
            </Suspense>
          )}

          {!isLoginPage && <ConnectivityBanner />}

          {/* Screen Content - Space-y-lg handles margins between widgets automatically */}
          <main
            className={`mx-auto w-full max-w-md px-margin-mobile ${
              isLoginPage
                ? "flex min-h-screen flex-col justify-center pt-6 pb-6"
                : "space-y-lg pt-20 pb-[calc(10rem+env(safe-area-inset-bottom))]"
            }`}
          >
            {children}
          </main>

          {!isLoginPage ? <DeveloperSimulationBanner /> : null}

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

          {/* Global Project Drawer wrapped in Suspense */}
          {!isLoginPage && (
            <Suspense fallback={null}>
              <GlobalProjectDrawer />
            </Suspense>
          )}

          {/* Global Vendor Bill Drawer wrapped in Suspense */}
          {!isLoginPage && (
            <Suspense fallback={null}>
              <GlobalVendorBillDrawer />
            </Suspense>
          )}

          {/* Global Client Invoice Drawer wrapped in Suspense */}
          {!isLoginPage && (
            <Suspense fallback={null}>
              <GlobalInvoiceDrawer />
            </Suspense>
          )}
        </div>
      </ActivityDetailProvider>
    </ProjectStateProvider>
  );
}
