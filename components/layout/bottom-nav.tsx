"use client";

import Link from "next/link";
import { ClipboardList, FolderKanban, PlusCircle, UserCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly icon: NavIcon;
  readonly match: (pathname: string) => boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    match: (pathname: string): boolean => pathname === "/" || pathname.startsWith("/projects"),
  },
  {
    label: "Ledger",
    href: "/ledger",
    icon: ClipboardList,
    match: (pathname: string): boolean => pathname.startsWith("/ledger"),
  },
  {
    label: "Add Expense",
    href: "/expenses/new",
    icon: PlusCircle,
    match: (pathname: string): boolean => pathname.startsWith("/expenses/new"),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserCircle,
    match: (pathname: string): boolean => pathname.startsWith("/profile"),
  },
];

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="sticky bottom-0 z-20 h-16 border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.24)]"
    >
      <ul className="grid h-full grid-cols-4 items-center gap-1">
        {NAV_ITEMS.map((item: NavItem): React.JSX.Element => {
          const Icon = item.icon;
          const isActive = item.match(pathname);

          return (
            <li key={item.href} className="h-full">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[0.68rem] font-semibold leading-none transition-colors duration-150 ${
                  isActive
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:bg-elevated hover:text-secondary"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2.25} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
