"use client";
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AppIcon, Button, MorphDetailDialog, type DialogMorphOrigin } from "@/components/ui";
import { transitionEaseSmooth } from "@/lib/utils/motion";
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
  const reduced = useReducedMotion();
  const unreadInTab =
    activeTab === "ACTION_REQUIRED"
      ? summary.unreadCount > summary.informationalUnreadCount
      : summary.informationalUnreadCount > 0;

  const contentTransition = reduced
    ? { duration: 0 }
    : isOpen
      ? { ...transitionEaseSmooth, delay: 0.1, duration: 0.26 }
      : { ...transitionEaseSmooth, duration: 0.18 };

  const tabsTransition = reduced
    ? { duration: 0 }
    : isOpen
      ? { ...transitionEaseSmooth, delay: 0.08, duration: 0.22 }
      : { ...transitionEaseSmooth, duration: 0.16 };

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
      bodyHeader={
        <motion.div
          initial={false}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={tabsTransition}
        >
          <NotificationCategoryTabs value={activeTab} compact onChange={setActiveTab} />
        </motion.div>
      }
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
      <motion.div
        initial={false}
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={contentTransition}
      >
        <NotificationCenterView
          onNavigate={onClose}
          compact
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          hideMarkAll
          hideTabs
        />
      </motion.div>
    </MorphDetailDialog>
  );
}
