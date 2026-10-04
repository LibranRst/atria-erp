"use client";

import Link from "@/lib/navigation/workspace-link";
import { usePathname } from "next/navigation";
import {
  useCan,
  useCurrentUserProfile,
  usePermissions,
} from "@/components/auth/permissions-provider";
import { AppIcon, ConnectivityBanner, DesktopButtonLink, UserAvatar } from "@/components/ui";
import { availableAdminNavigation } from "@/lib/navigation/admin-navigation";
import { getProfileInitials } from "@atria/core/presentation/user-identity";
import { NotificationBellButton } from "@/features/notifications";
import { useTopBarSlots } from "./top-bar-slots";
import { AdminQuickActions } from "./admin-quick-actions";
import { WorkspaceSwitch } from "./workspace-switch";

export function AdminShell({
  children,
}: {
  readonly children: React.ReactNode;
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
    <div className="admin-workspace min-h-dvh bg-background text-on-surface">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3"
      >
        Lewati navigasi
      </a>
      <aside className="admin-sidebar border-outline-variant/25 bg-surface-container-lowest lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:w-60 lg:border-r">
        <Link
          href="/admin"
          className="flex min-h-20 items-center gap-3 px-6 text-title font-bold outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-icon bg-primary text-white">
            <AppIcon name="space_dashboard" className="icon-lg" />
          </span>
          Atria
        </Link>
        <nav
          aria-label="Workspace desktop"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active?.href === item.href ? "page" : undefined}
              className={`text-body flex min-h-12 shrink-0 items-center gap-3 rounded-full px-4 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${active?.href === item.href ? "bg-primary text-white shadow-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`}
            >
              <AppIcon name={item.icon} className="icon-md" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 py-5 text-support text-on-surface-variant lg:block">
          Kontrol keuangan dan material proyek dalam satu workspace.
        </div>
      </aside>
      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-10 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-outline-variant/25 bg-surface-container-lowest px-5 lg:px-8">
          <div className="min-w-0">
            <p className="text-body font-bold">{slots?.title ?? active?.label ?? "Workspace"}</p>
            <p className="text-support text-on-surface-variant">{user?.name ?? "Atria"}</p>
          </div>
          <div className="flex items-center gap-2">
            {slots?.left}
            {slots?.right}
            <AdminQuickActions />
            <WorkspaceSwitch target="mobile" />
            {can("use:ai_chat") ? (
              <DesktopButtonLink
                href="/admin/ai"
                variant="secondary"
                aria-label="Asisten AI"
                leadingIcon={<AppIcon name="sparkle" className="icon-md" />}
              >
                <span className="hidden xl:inline">Asisten AI</span>
              </DesktopButtonLink>
            ) : null}
            <NotificationBellButton />
            <Link
              href="/admin/profile"
              aria-label="Profil saya"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest shadow-control outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <UserAvatar
                imageUrl={user?.image}
                initials={getProfileInitials(user?.name ?? "")}
                renderPx={40}
              />
            </Link>
          </div>
        </header>
        <ConnectivityBanner />
        <main
          id="admin-content"
          className="mx-auto w-full max-w-400 min-w-0 space-y-lg px-5 py-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
