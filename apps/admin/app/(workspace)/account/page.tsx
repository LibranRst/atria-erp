import { Avatar, Card, Link, Separator } from "@heroui/react";
import { formatRoleLabel } from "@atria/core/presentation/role-label";
import { AccountForm } from "@/components/account-form";
import { LogoutButton } from "@/components/logout-button";
import { avatarInitials } from "@/components/admin-navigation";
import { atriaWebHref } from "@/components/app-links";
import { requireAdminActor } from "@/lib/auth/server";

export default async function AccountPage(): Promise<React.JSX.Element> {
  const actor = await requireAdminActor();
  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Akun saya</h1>
        <p className="text-sm text-muted">Profil dan keamanan akun Atria Anda.</p>
      </div>
      <Card className="p-6">
        <Card.Header className="mb-3 flex-row items-center gap-4">
          <Avatar size="md">
            {actor.image ? <Avatar.Image src={actor.image} alt="" /> : null}
            <Avatar.Fallback>{avatarInitials(actor.name)}</Avatar.Fallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">{actor.email}</p>
            <p className="text-xs text-muted">{formatRoleLabel(actor.roleName)}</p>
          </div>
        </Card.Header>
        <Card.Content className="space-y-5">
          <AccountForm initialName={actor.name} />
          <Separator />
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/change-password" className="text-sm">
              Ganti kata sandi
            </Link>
            <Link href={atriaWebHref("/profile")} className="text-sm">
              Kelola foto di Atria
              <Link.Icon aria-hidden="true" />
            </Link>
            <LogoutButton />
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
