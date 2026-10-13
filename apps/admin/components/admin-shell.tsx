"use client";

import { useState } from "react";
import { Avatar, Button, Dropdown, Label, Link, Separator } from "@heroui/react";
import { AppIcon } from "./ui";
import { buttonVariants } from "@heroui/styles";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { AdminActor } from "@/lib/auth/server";
import { adminNavigation, adminPageLabel, avatarInitials } from "./admin-navigation";
import { atriaWebHref } from "./app-links";
import { useGuardedLeaveAction } from "./unsaved-changes";

export function AdminShell({
  actor,
  children,
}: {
  readonly actor: AdminActor;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const requestLeave = useGuardedLeaveAction();
  const navigation = adminNavigation(actor.permissions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut(leaveDocument: (href: string) => void): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Belum bisa keluar. Coba lagi.");
        return;
      }
      leaveDocument("/login");
    } catch {
      setError("Server tidak dapat dijangkau. Coba keluar lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[208px_minmax(0,1fr)]">
      <Link
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-surface focus:p-3"
        href="#main-content"
      >
        Lewati navigasi
      </Link>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface p-4 md:flex">
        <Link
          href="/projects"
          className="mb-8 px-2 py-1 text-base font-semibold text-foreground no-underline"
        >
          Atria Admin
        </Link>
        <nav aria-label="Navigasi utama" className="space-y-1">
          {navigation.map((item): React.JSX.Element => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={`${buttonVariants({ size: "sm", variant: pathname.startsWith(item.href) ? "secondary" : "ghost" })} w-full justify-start gap-2`}
            >
              <AppIcon name="folder" size={17} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-2">
          <Link href={atriaWebHref()} className="gap-2 text-sm">
            <AppIcon name="open_in_new" size={16} aria-hidden="true" />
            Buka Atria
          </Link>
          <p className="text-xs text-muted">Dekoria</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-surface px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/projects"
              className="text-sm font-semibold text-foreground no-underline md:hidden"
            >
              Atria Admin
            </Link>
            <span className="hidden truncate text-sm text-muted sm:inline">
              {adminPageLabel(pathname)}
            </span>
          </div>
          <Dropdown>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Menu akun ${actor.name}`}
              isPending={pending}
            >
              <Avatar size="sm">
                {actor.image ? <Avatar.Image src={actor.image} alt="" /> : null}
                <Avatar.Fallback>{avatarInitials(actor.name)}</Avatar.Fallback>
              </Avatar>
              <span className="hidden max-w-40 truncate sm:inline">{actor.name}</span>
              <AppIcon name="expand_more" size={14} aria-hidden="true" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="Akun dan sesi" disabledKeys={pending ? ["logout"] : []}>
                <Dropdown.Item id="account" href="/account" textValue="Akun saya">
                  <AppIcon name="person" size={18} aria-hidden="true" />
                  <Label>Akun saya</Label>
                </Dropdown.Item>
                <Dropdown.Item id="password" href="/change-password" textValue="Ganti kata sandi">
                  <AppIcon name="lock" size={18} aria-hidden="true" />
                  <Label>Ganti kata sandi</Label>
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item
                  id="logout"
                  variant="danger"
                  textValue="Keluar"
                  onAction={(): void => {
                    requestLeave(signOut);
                  }}
                >
                  <AppIcon name="logout" size={18} aria-hidden="true" />
                  <Label>Keluar</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </header>
        {error ? (
          <p role="alert" className="text-danger border-b border-border px-5 py-3 text-sm lg:px-8">
            {error}
          </p>
        ) : null}
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1600px] min-w-0 px-5 py-6 outline-none lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
