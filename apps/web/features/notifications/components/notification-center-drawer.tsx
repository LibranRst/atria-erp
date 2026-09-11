"use client";
import React from "react";
import { DetailSheet } from "@/components/ui";
import { NotificationCenterView } from "./notification-center-view";
export function NotificationCenterDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <DetailSheet open={open} title="Notifikasi" onClose={onClose}>
      <NotificationCenterView onNavigate={onClose} compact />
    </DetailSheet>
  );
}
