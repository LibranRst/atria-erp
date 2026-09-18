import React from "react";
import { redirect } from "next/navigation";
import { resolveActor } from "@/server/actor";
import { AppIcon, IconButtonLink, PageHeader } from "@/components/ui";
import { NotificationCenterView } from "@/features/notifications/components/notification-center-view";

export const dynamic = "force-dynamic";

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");

  return (
    <section className="space-y-sm px-1 pb-8 select-none max-[430px]:-mx-1 max-[430px]:pb-6">
      <PageHeader
        title="Notifikasi"
        subtitle="Pusat pemberitahuan tindakan, approval, dan pembaruan operasional."
        action={
          <IconButtonLink
            href="/profile#notifications"
            label="Pengaturan perangkat & notifikasi"
            variant="secondary"
            size="compact"
          >
            <AppIcon name="tune" className="icon-sm" />
          </IconButtonLink>
        }
      />
      <NotificationCenterView />
    </section>
  );
}
