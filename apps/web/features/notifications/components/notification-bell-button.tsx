"use client";
import React, { useRef, useState } from "react";
import {
  AppIcon,
  Button,
  ContextPopover,
  IconButton,
  type DialogMorphOrigin,
} from "@/components/ui";
import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import type { NotificationCategory } from "@atria/core/notifications/types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { transitionSpringBouncy } from "@/lib/utils/motion";
import { useNotifications } from "../hooks/notification-context";
import { NotificationMorphDialog } from "./notification-morph-dialog";
import { NotificationCategoryTabs, NotificationCenterView } from "./notification-center-view";
export function NotificationBellButton({
  className = "",
  size = "compact",
}: {
  readonly className?: string;
  readonly size?: "default" | "compact";
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [dialogPresent, setDialogPresent] = useState(false);
  const [morphOrigin, setMorphOrigin] = useState<DialogMorphOrigin | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationCategory>("ACTION_REQUIRED");
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const { summary, pending, markAllAsRead } = useNotifications();
  const label = summary.unreadCount
    ? `${summary.unreadCount} notifikasi belum dibaca`
    : "Notifikasi";
  function handleOpen(): void {
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const width = el.offsetWidth || rect.width;
      const height = el.offsetHeight || rect.height;
      const top = rect.top + (rect.height - height) / 2;
      const left = rect.left + (rect.width - width) / 2;
      setMorphOrigin({ top, left, width, height });
    }
    setDialogPresent(true);
    setOpen(true);
  }
  if (desktop) {
    const unread =
      activeTab === "ACTION_REQUIRED"
        ? summary.unreadCount > summary.informationalUnreadCount
        : summary.informationalUnreadCount > 0;
    return (
      <ContextPopover
        label="Notifikasi"
        placement="bottom-end"
        width={420}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <IconButton
            ref={triggerRef}
            size={size}
            label={label}
            className={`relative ${className}`}
            icon={
              <>
                <AppIcon name="bell" className="icon-md" />
                {summary.unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1 -right-1 rounded-full bg-primary px-1 text-meta font-bold text-on-primary"
                  >
                    {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                  </span>
                ) : null}
              </>
            }
          />
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-section font-bold text-on-surface">Notifikasi</h2>
            {unread ? (
              <Button
                size="compact"
                variant="tertiary"
                pending={pending}
                onClick={() => void markAllAsRead(activeTab)}
              >
                Baca semua
              </Button>
            ) : null}
          </div>
          <NotificationCategoryTabs value={activeTab} compact onChange={setActiveTab} />
          <NotificationCenterView
            compact
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            hideMarkAll
            hideTabs
            onNavigate={() => setOpen(false)}
          />
        </div>
      </ContextPopover>
    );
  }
  return (
    <>
      <div
        className={`relative h-10 w-10 shrink-0 ${size === "default" ? "pointer-coarse:h-12 pointer-coarse:w-12" : ""} ${className}`}
      >
        <IconButton
          ref={triggerRef}
          size={size}
          label={
            summary.unreadCount ? `${summary.unreadCount} notifikasi belum dibaca` : "Notifikasi"
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          className={dialogPresent ? "pointer-events-none invisible" : undefined}
          onClick={handleOpen}
          icon={<AppIcon name="bell" className="icon-md" />}
        />
        <AnimatePresence>
          {!dialogPresent && summary.unreadCount > 0 && (
            <motion.span
              key="notification-badge"
              aria-hidden="true"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0, transition: { duration: 0.08 } }}
              transition={reduced ? { duration: 0 } : transitionSpringBouncy}
              className="pointer-events-none absolute -top-1 -right-1 origin-center rounded-full bg-primary px-1 text-meta font-bold text-on-primary"
            >
              {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <NotificationMorphDialog
        isOpen={open}
        isPresent={dialogPresent}
        onClose={() => setOpen(false)}
        onExitComplete={() => setDialogPresent(false)}
        morphOrigin={reduced ? null : morphOrigin}
        triggerRef={triggerRef}
      />
    </>
  );
}
