"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { AppIcon, Badge } from "@/components/ui";
import { safeNotificationUrl, type NotificationItem } from "@atria/core/notifications/types";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { useNotifications } from "../hooks/notification-context";
import { formatRelativeTime, getSeverityVisualConfig } from "../utils/notification-formatting";

interface NotificationRowProps {
  item: NotificationItem;
  onItemClick?: (item: NotificationItem) => void;
}

export function NotificationRow({ item, onItemClick }: NotificationRowProps): React.JSX.Element {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { openNotification } = useNotifications();
  const visual = getSeverityVisualConfig(item.severity, item.isResolved);
  const [pending, setPending] = useState(false);

  const hasFooterBadge = Boolean(item.isResolved || item.category === "ACTION_REQUIRED");

  async function handleClick(): Promise<void> {
    if (pending) return;
    if (item.actionUrl) {
      setPending(true);
      try {
        const response = await openNotification(item.id);
        if (!response.success) {
          toast.error(response.error?.message ?? "Tujuan tidak tersedia.");
          return;
        }
        onItemClick?.(item);
        router.push(response.data.url);
      } catch {
        toast.error("Tujuan belum dapat dibuka. Coba lagi.");
      } finally {
        setPending(false);
      }
      return;
    }
    if (onItemClick) {
      onItemClick(item);
    }
    const url = safeNotificationUrl(item.actionUrl);
    if (url) {
      router.push(url);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={() => void handleClick()}
      aria-busy={pending}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={transitionSpringSnappy}
      className={`group flex min-h-12 w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors duration-150 outline-none hover:bg-surface-container-high/30 focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-high/50 ${
        item.read ? "text-on-surface-variant" : "bg-primary/[0.025] text-on-surface"
      }`}
    >
      {/* Icon Avatar */}
      <div
        className={`mt-0.5 flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full ${visual.bgClass} ${visual.iconClass}`}
      >
        <AppIcon name={visual.iconName} className="icon-md" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: Title + Unread Indicator & Timestamp */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={`truncate text-[13.5px] leading-snug ${
                item.read ? "font-medium text-on-surface-variant" : "font-semibold text-on-surface"
              }`}
            >
              {item.title}
            </p>
            {!item.read && (
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-label="Belum dibaca"
              />
            )}
          </div>

          <time
            dateTime={item.createdAt}
            className="shrink-0 text-meta tabular-nums text-on-surface-variant/75"
          >
            {formatRelativeTime(item.createdAt)}
          </time>
        </div>

        {/* Message Body */}
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-on-surface-variant/90">
          {item.message}
        </p>

        {/* Status Badge (Only rendered if applicable) */}
        {hasFooterBadge && (
          <div className="mt-2 flex items-center gap-2">
            {item.isResolved ? (
              <Badge status="COMPLETED">Sudah Selesai</Badge>
            ) : item.category === "ACTION_REQUIRED" ? (
              <Badge status="WARNING">Perlu Tindakan</Badge>
            ) : null}
          </div>
        )}
      </div>
    </motion.button>
  );
}
