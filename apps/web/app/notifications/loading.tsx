import React from "react";
import { PageHeader } from "@/components/ui";
import { NotificationSkeleton } from "@/features/notifications/components/notification-center-view";
export default function Loading(): React.JSX.Element {
  return (
    <section className="space-y-4 pb-8">
      <PageHeader title="Notifikasi" />
      <div aria-hidden="true" className="h-12 rounded-full bg-surface-container" />
      <NotificationSkeleton />
    </section>
  );
}
