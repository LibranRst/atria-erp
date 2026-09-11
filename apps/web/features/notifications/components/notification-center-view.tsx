"use client";
import React, { useState } from "react";
import { Button, ButtonLink, EmptyState, GroupedSurface, SegmentedTabs } from "@/components/ui";
import type { NotificationCategory, NotificationItem } from "@atria/core/notifications/types";
import { NotificationRow } from "./notification-row";
import { useNotifications } from "../hooks/notification-context";

export function NotificationCategoryTabs({
  value,
  onChange,
  compact = false,
}: {
  readonly value: NotificationCategory;
  readonly onChange: (value: NotificationCategory) => void;
  readonly compact?: boolean;
}): React.JSX.Element {
  const { summary } = useNotifications();
  return (
    <SegmentedTabs
      value={value}
      options={[
        {
          value: "ACTION_REQUIRED" as const,
          label: "Perlu tindakan",
          count: summary.actionRequiredCount || undefined,
        },
        {
          value: "INFORMATIONAL" as const,
          label: "Informasi",
          count: summary.informationalUnreadCount || undefined,
        },
      ]}
      onChange={onChange}
      ariaLabel="Kategori notifikasi"
      fillAvailableSpace
      density={compact ? "compact" : "default"}
    />
  );
}

export function NotificationSkeleton(): React.JSX.Element {
  return (
    <GroupedSurface aria-label="Memuat notifikasi" aria-busy="true">
      <div className="divide-y divide-outline-variant">
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex gap-3 p-4" aria-hidden="true">
            <div className="h-9 w-9 shrink-0 rounded-full bg-surface-container" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-full bg-surface-container" />
              <div className="h-3 w-full rounded-full bg-surface-container" />
              <div className="h-3 w-1/2 rounded-full bg-surface-container" />
            </div>
          </div>
        ))}
      </div>
    </GroupedSurface>
  );
}
export function NotificationCenterView({
  onNavigate,
  compact = false,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  hideMarkAll = false,
  hideTabs = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
  activeTab?: NotificationCategory;
  onActiveTabChange?: (tab: NotificationCategory) => void;
  hideMarkAll?: boolean;
  hideTabs?: boolean;
}): React.JSX.Element {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] =
    useState<NotificationCategory>("ACTION_REQUIRED");
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;
  const {
    summary,
    pages,
    isLoading,
    error,
    pending,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const page = pages[activeTab];
  const unread =
    activeTab === "ACTION_REQUIRED"
      ? summary.unreadCount > summary.informationalUnreadCount
      : summary.informationalUnreadCount > 0;
  function click(item: NotificationItem): void {
    if (!item.read) void markAsRead(item.id);
    if (item.actionUrl) onNavigate?.();
  }
  const open = page.items.filter((item) => !item.isResolved);
  const resolved = page.items.filter((item) => item.isResolved);
  function rows(items: NotificationItem[]): React.JSX.Element {
    return (
      <GroupedSurface>
        <div className="divide-y divide-outline-variant">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onItemClick={click} />
          ))}
        </div>
      </GroupedSurface>
    );
  }
  return (
    <div className="space-y-2">
      {!hideTabs ? (
        <NotificationCategoryTabs
          value={activeTab}
          compact={compact}
          onChange={(value) => {
            if (onActiveTabChange) onActiveTabChange(value);
            else setUncontrolledActiveTab(value);
          }}
        />
      ) : null}
      {error && (
        <div role="status" className="text-support text-on-surface-variant">
          <p>{error}</p>
          <Button variant="tertiary" onClick={() => void refresh()}>
            Coba lagi
          </Button>
        </div>
      )}
      {!hideMarkAll && unread && (
        <div className="flex justify-end">
          <Button
            size="compact"
            variant="tertiary"
            pending={pending}
            onClick={() => void markAllAsRead(activeTab)}
          >
            Tandai semua dibaca
          </Button>
        </div>
      )}
      {isLoading ? (
        <NotificationSkeleton />
      ) : page.items.length === 0 ? (
        !error && (
          <EmptyState
            icon="bell"
            title={
              activeTab === "ACTION_REQUIRED"
                ? "Tidak ada tindakan tertunda"
                : "Belum ada informasi"
            }
            description={
              activeTab === "ACTION_REQUIRED"
                ? "Tindakan yang menjadi tanggung jawab Anda akan muncul di sini."
                : "Pembaruan operasional akan muncul di sini."
            }
          />
        )
      ) : (
        <>
          {open.length > 0 && rows(open)}
          {resolved.length > 0 && (
            <>
              <h3 className="ml-3 text-support font-semibold text-on-surface-variant">Selesai</h3>
              {rows(resolved)}
            </>
          )}
        </>
      )}
      {page.hasMore && (
        <Button variant="secondary" fullWidth onClick={() => void loadMore(activeTab)}>
          Muat lainnya
        </Button>
      )}
      {compact && (
        <ButtonLink href="/notifications" variant="secondary" fullWidth onClick={onNavigate}>
          Buka semua notifikasi
        </ButtonLink>
      )}
    </div>
  );
}
