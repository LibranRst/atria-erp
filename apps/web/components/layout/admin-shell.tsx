"use client";

import Link from "@/lib/navigation/workspace-link";
import { usePathname } from "next/navigation";
import {
  useCan,
  useCurrentUserProfile,
  usePermissions,
} from "@/components/auth/permissions-provider";
import { AppIcon, DesktopButtonLink } from "@/components/ui";
import { availableAdminNavigation } from "@/lib/navigation/admin-navigation";
import { NotificationBellButton } from "@/features/notifications";
import { useTopBarSlots } from "./top-bar-slots";
import { AdminQuickActions } from "./admin-quick-actions";
import { DesktopProfileMenu } from "./desktop-profile-menu";

export function DesktopChrome({
  hidden = false,
}: {
  readonly hidden?: boolean;
}): React.JSX.Element {
  const pathname = usePathname();
  const permissions = usePermissions();
  const slots = useTopBarSlots();
  const can = useCan();
  const user = useCurrentUserProfile();
  const items = availableAdminNavigation(permissions);
  const active = items.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return (
    <>
      <a
        hidden={hidden}
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3"
      >
        Lewati navigasi
      </a>
      <aside
        hidden={hidden}
        className="fixed inset-y-0 left-0 z-20 w-52 border-r border-outline-variant/25 bg-surface-container-lowest"
      >
        <Link
          href="/"
          className="flex h-16 items-center gap-2.5 px-5 text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-icon bg-primary text-white">
            <AppIcon name="space_dashboard" className="icon-lg" />
          </span>
          Atria
        </Link>
        <nav aria-label="Navigasi Atria" className="flex flex-col gap-1 px-3 pb-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active?.href === item.href ? "page" : undefined}
              className={`flex min-h-10 shrink-0 items-center gap-2.5 rounded-full px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring pointer-coarse:min-h-12 ${active?.href === item.href ? "bg-primary text-white shadow-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`}
            >
              <AppIcon name={item.icon} className="icon-md" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-5 text-xs leading-relaxed text-on-surface-variant">
          Kontrol keuangan dan material proyek dalam satu workspace.
        </div>
      </aside>
      <header
        hidden={hidden}
        className="atria-desktop-topbar sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-outline-variant/25 bg-background px-6"
      >
        <div className="min-w-0">
          <p className="max-w-96 truncate text-sm font-semibold" title={slots?.title}>
            {slots?.title ?? active?.label ?? (pathname === "/profile" ? "Profil saya" : "Atria")}
          </p>
          <p className="text-xs text-on-surface-variant">
            {slots?.subtitle ?? user?.name ?? "Atria"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {slots?.left}
          {slots?.right}
          {pathname !== "/ai" ? <AdminQuickActions /> : null}
          {can("use:ai_chat") && pathname !== "/ai" ? (
            <DesktopButtonLink
              href="/ai"
              variant="secondary"
              aria-label="Asisten AI"
              leadingIcon={<AppIcon name="sparkle" className="icon-md" />}
            >
              Asisten AI
            </DesktopButtonLink>
          ) : null}
          <NotificationBellButton size="default" />
          <DesktopProfileMenu />
        </div>
      </header>
    </>
  );
}
