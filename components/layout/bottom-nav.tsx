"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";

import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME } from "@/lib/auth/permissions";

type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  readonly match: (pathname: string, searchParams: URLSearchParams) => boolean;
};

export function BottomNav(): React.JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();

  if (pathname === "/login") return null;

  const roleId = session?.user ? (session.user as any).roleId : null;
  const roleName = roleId ? ROLE_ID_TO_NAME[roleId] : null;

  const navItems: readonly NavItem[] = [
    {
      label: "Today",
      href: "/ledger",
      iconName: "today",
      match: (path, params): boolean => path === "/ledger" && params.get("brief") !== "true",
    },
    {
      label: "Projects",
      href: "/projects",
      iconName: "architecture",
      match: (path): boolean => path.startsWith("/projects"),
    },
    {
      label: "Payments",
      href: "/approvals",
      iconName: "payments",
      match: (path): boolean => path.startsWith("/approvals"),
    },
    {
      label: "Expenses",
      href: "/expenses/new",
      iconName: "receipt_long",
      match: (path): boolean => path.startsWith("/expenses"),
    },
    {
      label: "AI Brief",
      href: "/ledger?brief=true",
      iconName: "auto_awesome",
      match: (path, params): boolean => path === "/ledger" && params.get("brief") === "true",
    },
  ];

  const filteredNavItems = navItems.filter((item) => {
    // Default safe layout during loading
    if (!roleName) {
      return item.label === "Projects" || item.label === "Expenses";
    }

    if (item.label === "Today" || item.label === "AI Brief") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Payments") {
      return roleName === "OWNER";
    }

    return true; // Projects, Expenses
  });

  return (
    <div className="fixed bottom-8 left-0 right-0 mx-auto w-[calc(100%-2rem)] max-w-md z-50 h-[72px] pointer-events-none select-none">
      {/* Floating Action Button (FAB) */}
      <Link
        href="/expenses/new"
        className="absolute right-0 -top-16 z-50 flex w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl items-center justify-center active:scale-95 transition-all duration-200 border border-white/10 pointer-events-auto cursor-pointer"
        aria-label="Add Expense"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </Link>

      {/* Floating Tab Bar Container */}
      <nav
        aria-label="Primary mobile navigation"
        className="flex justify-center items-center px-1 py-2 gap-2 h-full bg-surface/90 backdrop-blur-md border border-outline-variant/30 rounded-full shadow-xl pointer-events-auto"
      >
        {filteredNavItems.map((item: NavItem): React.JSX.Element => {
          const isActive = item.match(pathname, searchParams);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 h-full rounded-full transition-all duration-200 px-2 flex-1 active:scale-90 ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <span 
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.iconName}
              </span>
              <span className="font-label-caps uppercase tracking-wider text-[8px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
