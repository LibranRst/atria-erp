"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useNotifications } from "../hooks/notification-context";
import { useRouter } from "next/navigation";
import { AppIcon, Badge } from "@/components/ui";
import { safeNotificationUrl, type NotificationItem } from "@atria/core/notifications/types";
import { formatRelativeTime, getSeverityVisualConfig } from "../utils/notification-formatting";

interface NotificationRowProps {
  item: NotificationItem;
  onItemClick?: (item: NotificationItem) => void;
}

export function NotificationRow({ item, onItemClick }: NotificationRowProps): React.JSX.Element {
  const router = useRouter();
  const { openNotification } = useNotifications();
  const visual = getSeverityVisualConfig(item.severity, item.isResolved);

  const [pending, setPending] = useState(false);
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
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-busy={pending}
      className={`flex min-h-12 w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 outline-none hover:bg-surface-container-high/30 focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-high/50 ${
        item.read ? "text-on-surface-variant" : "bg-primary/[0.02] text-on-surface"
      }`}
    >
      {/* Icon Badge */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${visual.bgClass} ${visual.iconClass}`}
      >
        <AppIcon name={visual.iconName} className="icon-md" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <p
            className={`text-[14px] leading-tight ${
              item.read ? "font-medium text-on-surface-variant" : "font-semibold text-on-surface"
            }`}
          >
            {item.title}
          </p>
        </div>

        <p className="mb-1.5 text-[13px] leading-relaxed text-on-surface-variant">{item.message}</p>

        <time
          dateTime={item.createdAt}
          className="mb-2 block text-meta text-on-surface-variant tabular-nums"
        >
          {formatRelativeTime(item.createdAt)}
        </time>
        {/* Footer badges */}
        <div className="flex items-center gap-2">
          {item.isResolved ? (
            <Badge status="COMPLETED">Sudah Selesai</Badge>
          ) : item.category === "ACTION_REQUIRED" ? (
            <Badge status="WARNING">Perlu Tindakan</Badge>
          ) : null}

          {!item.read && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
              aria-label="Belum dibaca"
            />
          )}
        </div>
      </div>

      {/* Chevron indicator if actionable */}
      {item.actionUrl && (
        <div className="shrink-0 self-center text-on-surface-variant">
          <AppIcon name="chevron_right" className="icon-sm" />
        </div>
      )}
    </button>
  );
}
