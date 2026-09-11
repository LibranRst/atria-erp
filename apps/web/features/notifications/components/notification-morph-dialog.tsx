"use client";
import React, { useState } from "react";
import { AppIcon, Button, MorphDetailDialog, type DialogMorphOrigin } from "@/components/ui";
import { NotificationCategoryTabs, NotificationCenterView } from "./notification-center-view";
import { useNotifications } from "../hooks/notification-context";
export function NotificationMorphDialog({
  isOpen,
  isPresent,
  onClose,
  onExitComplete,
  morphOrigin,
  triggerRef,
}: {
  isOpen: boolean;
  isPresent: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  morphOrigin?: DialogMorphOrigin | null;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<"ACTION_REQUIRED" | "INFORMATIONAL">(
    "ACTION_REQUIRED",
  );
  const { summary, pending, markAllAsRead } = useNotifications();
  const unreadInTab =
    activeTab === "ACTION_REQUIRED"
      ? summary.unreadCount > summary.informationalUnreadCount
      : summary.informationalUnreadCount > 0;

  return (
    <MorphDetailDialog
      open={isOpen}
      present={isPresent}
      title="Notifikasi"
      headerAction={
        unreadInTab ? (
          <Button
            type="button"
            size="mini"
            variant="secondary"
            className="h-5.5"
            pending={pending}
            onClick={() => void markAllAsRead(activeTab)}
          >
            Baca semua
          </Button>
        ) : undefined
      }
      bodyHeader={<NotificationCategoryTabs value={activeTab} compact onChange={setActiveTab} />}
      morphOrigin={morphOrigin}
      morphClosedContent={
        <span className="relative flex h-10 w-10 items-center justify-center text-on-surface">
          <AppIcon name="bell" className="icon-md" />
        </span>
      }
      returnFocusRef={triggerRef}
      onClose={onClose}
      onExitComplete={onExitComplete}
    >
      <NotificationCenterView
        onNavigate={onClose}
        compact
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        hideMarkAll
        hideTabs
      />
    </MorphDetailDialog>
  );
}
