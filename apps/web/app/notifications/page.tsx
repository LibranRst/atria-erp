import React from "react";
import { redirect } from "next/navigation";
import { resolveActor } from "@/server/actor";
import { PageHeader } from "@/components/ui";
import { NotificationCenterView } from "@/features/notifications/components/notification-center-view";
import { WebPushControl } from "@/features/notifications/components/web-push-control";

export const dynamic = "force-dynamic";

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");

  return (
    <section className="space-y-sm px-1 pb-8 select-none max-[430px]:-mx-1 max-[430px]:pb-6">
      <PageHeader
        title="Notifikasi"
        subtitle="Pusat pemberitahuan tindakan, approval, dan pembaruan operasional."
      />
      <WebPushControl publicKey={process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? ""} />
      <NotificationCenterView />
    </section>
  );
}
