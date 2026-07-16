"use client";

import React, { Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { HeaderMorphMenu } from "@/components/layout/header-morph-menu";
import {
  getHeaderMenuItems,
  getPageTitle,
} from "@/components/layout/header-menu-config";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { GlobalExpenseDrawer } from "@/features/expenses/components/global-drawer";
import { GlobalProjectDrawer } from "@/features/projects/list/components/global-project-drawer";
import { GlobalVendorBillDrawer } from "@/features/expenses/components/global-vendor-bill-drawer";
import { GlobalInvoiceDrawer } from "@/features/projects/detail/components/invoices/global-invoice-drawer";
import { ProjectStateProvider } from "@/features/projects/detail/components/project-state-context";
import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME } from "@/lib/auth/permissions";
import {
  transitionSpringBouncy,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { ConnectivityBanner } from "@/components/ui/page-state";

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
  return typeof roleId === "string" ? ROLE_ID_TO_NAME[roleId] ?? null : null;
}

function MobileHeader({
  isRootRoute,
}: {
  readonly isRootRoute: boolean;
}): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [openRouteKey, setOpenRouteKey] = React.useState<string | null>(null);
  const isMenuOpen = openRouteKey === routeKey;
  const hasBackButton = !isRootRoute;

  const pageTitle = React.useMemo(
    () => getPageTitle(pathname),
    [pathname],
  );
  const roleName = React.useMemo(
    () => getRoleName(session?.user ?? null),
    [session?.user],
  );
  const menuItems = React.useMemo(
    () => getHeaderMenuItems(roleName),
    [roleName],
  );

  return (
    <header
      className={`fixed top-0 left-0 w-full flex items-center h-14 select-none ${
        isMenuOpen ? "z-[90]" : "z-50"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-md items-center justify-between px-margin-mobile">
        <div className="relative h-10 w-[88px] shrink-0">
          <AnimatePresence>
            {hasBackButton && (
              <motion.button
                key="header-back-button"
                type="button"
                onClick={() => router.back()}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={
                  hasBackButton ? transitionSpringBouncy : transitionSpringSmooth
                }
                className="absolute left-0 top-0 z-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-outline-variant/15 bg-white text-on-surface-variant shadow-[0_10px_24px_rgba(17,17,17,0.10)] transition-colors duration-200 hover:bg-surface-container-low active:scale-95"
                aria-label="Go back"
              >
                <span className="material-symbols-outlined text-[28px]">
                  chevron_left
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={() => toast("AI Chat segera hadir.")}
            animate={{ x: hasBackButton ? 46 : 0 }}
            transition={hasBackButton ? transitionSpringBouncy : transitionSpringSmooth}
            className="absolute left-0 top-0 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-outline-variant/15 bg-white text-on-surface-variant shadow-[0_10px_24px_rgba(17,17,17,0.10)] transition-colors duration-200 hover:bg-surface-container-low active:scale-95"
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
          onToggle={() =>
            setOpenRouteKey((current) =>
              current === routeKey ? null : routeKey,
            )
          }
          onClose={() => setOpenRouteKey(null)}
        />

        <div className="w-[88px] h-10 flex shrink-0 items-center justify-end">
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

  const isLoginPage = pathname === "/login";

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
      <div className="min-h-screen bg-background text-on-surface font-sans">
        {/* Top AppBar - Fixed, contents centered to match page width */}
        {!isLoginPage && (
          <Suspense
            fallback={
              <div className="h-14 bg-surface border-b border-outline-variant/10" />
            }
          >
            <MobileHeader isRootRoute={isRootRoute} />
          </Suspense>
        )}

        {!isLoginPage && <ConnectivityBanner />}

        {/* Screen Content - Space-y-lg handles margins between widgets automatically */}
        <main
          className={`mx-auto w-full max-w-md px-margin-mobile ${
            isLoginPage
              ? "pt-6 pb-6 min-h-screen flex flex-col justify-center"
              : "pt-20 pb-[calc(10rem+env(safe-area-inset-bottom))] space-y-lg"
          }`}
        >
          {children}
        </main>

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
    </ProjectStateProvider>
  );
}
