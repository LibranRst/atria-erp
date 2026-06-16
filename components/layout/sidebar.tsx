"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ROLE_ID_TO_NAME } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/profile/logout-button";

interface SidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type SidebarNavItem = {
  readonly label: string;
  readonly href: string;
  readonly iconName: string;
  readonly match: (pathname: string, searchParams: URLSearchParams) => boolean;
};

export function Sidebar({ isOpen, onClose }: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();

  const roleId = session?.user ? (session.user as any).roleId : null;
  const roleName = roleId ? ROLE_ID_TO_NAME[roleId] : null;

  const sidebarItems: readonly SidebarNavItem[] = [
    {
      label: "Dashboard",
      href: "/ledger",
      iconName: "dashboard",
      match: (path, params): boolean =>
        path === "/ledger" && params.get("brief") !== "true",
    },
    {
      label: "Proyek",
      href: "/projects",
      iconName: "folder",
      match: (path): boolean => path.startsWith("/projects"),
    },
    {
      label: "Material & Stok",
      href: "/materials",
      iconName: "inventory_2",
      match: (path): boolean => path.startsWith("/materials"),
    },
    {
      label: "Kas & Tagihan",
      href: "/expenses",
      iconName: "receipt_long",
      match: (path): boolean => path.startsWith("/expenses"),
    },
    {
      label: "Persetujuan (Approvals)",
      href: "/approvals",
      iconName: "verified_user",
      match: (path): boolean => path.startsWith("/approvals"),
    },
    {
      label: "AI CFO Briefing",
      href: "/ledger?brief=true",
      iconName: "auto_awesome",
      match: (path, params): boolean =>
        path === "/ledger" && params.get("brief") === "true",
    },
    {
      label: "Pengaturan ERP",
      href: "/settings",
      iconName: "tune",
      match: (path): boolean => path.startsWith("/settings"),
    },
    {
      label: "Profil Saya",
      href: "/profile",
      iconName: "person",
      match: (path): boolean => path.startsWith("/profile"),
    },
  ];

  const filteredItems = sidebarItems.filter((item) => {
    if (!roleName) return false;

    if (item.label === "Dashboard") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Persetujuan (Approvals)") {
      return roleName === "OWNER";
    }

    if (item.label === "AI CFO Briefing") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN";
    }

    if (item.label === "Pengaturan ERP") {
      return roleName === "OWNER" || roleName === "FINANCE_ADMIN" || roleName === "PURCHASING";
    }

    return true;
  });

  const getBadgeStatus = (role: string) => {
    switch (role) {
      case "OWNER":
        return "PRIMARY";
      case "FINANCE_ADMIN":
        return "APPROVED";
      case "PROJECT_MANAGER":
        return "PENDING";
      default:
        return "DRAFT";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex pointer-events-none transition-all duration-300 ${
        isOpen ? "visible" : "invisible"
      }`}
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto cursor-pointer ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer Container */}
      <aside
        className={`relative w-[280px] max-w-[85vw] h-screen bg-surface border-r border-outline-variant/20 shadow-2xl flex flex-col pointer-events-auto transform transition-transform duration-300 ease-out z-[101] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close Button Header */}
        <div className="flex justify-end p-sm">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* User Profile Info Card */}
        {session?.user && (
          <div className="px-md pb-md border-b border-outline-variant/10 space-y-sm select-none">
            <div className="flex items-center gap-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container border border-outline-variant/20 text-primary text-md font-sans text-[32px] leading-[40px] tracking-tight font-bold font-bold">
                {getInitials(session.user.name)}
              </div>
              <div className="min-w-0">
                <h3 className="font-sans text-[16px] leading-[24px] font-normal font-bold text-on-surface truncate leading-tight">
                  {session.user.name}
                </h3>
                <p className="text-[10px] text-on-surface-variant truncate font-medium">
                  {session.user.email}
                </p>
              </div>
            </div>
            {roleName && (
              <div className="pt-1">
                <Badge status={getBadgeStatus(roleName)}>{roleName}</Badge>
              </div>
            )}
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto py-sm px-xs space-y-xs select-none">
          {filteredItems.map((item) => {
            const isActive = item.match(pathname, searchParams);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-md px-md py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.iconName}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout Button */}
        <div className="p-md border-t border-outline-variant/10">
          <LogoutButton />
        </div>
      </aside>
    </div>
  );
}
