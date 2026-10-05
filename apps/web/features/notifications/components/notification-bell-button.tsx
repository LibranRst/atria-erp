"use client";
import React, { useRef, useState } from "react";
import { AppIcon, IconButton, type DialogMorphOrigin } from "@/components/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { transitionSpringBouncy } from "@/lib/utils/motion";
import { useNotifications } from "../hooks/notification-context";
import { NotificationMorphDialog } from "./notification-morph-dialog";
export function NotificationBellButton({
  className = "",
}: {
  readonly className?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [dialogPresent, setDialogPresent] = useState(false);
  const [morphOrigin, setMorphOrigin] = useState<DialogMorphOrigin | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const { summary } = useNotifications();
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
  return (
    <>
      <div className={`relative h-10 w-10 shrink-0 ${className}`}>
        <IconButton
          ref={triggerRef}
          size="compact"
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
