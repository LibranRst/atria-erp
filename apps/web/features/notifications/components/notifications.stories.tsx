import React, { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { NotificationBellButton } from "./notification-bell-button";
import { NotificationCenterView } from "./notification-center-view";
import { NotificationStoreProvider } from "../hooks/notification-context";
import { createNotificationStore } from "../hooks/notification-store";
import type { NotificationItem } from "@atria/core/notifications/types";
const examples: NotificationItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "test",
    userId: "test",
    title: "Biaya menunggu persetujuan",
    message: "Pembelian material untuk pemasangan kabinet dapur dan ruang keluarga proyek contoh.",
    read: false,
    severity: "WARNING",
    category: "ACTION_REQUIRED",
    isResolved: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "test",
    userId: "test",
    title: "Tagihan vendor jatuh tempo",
    message: "Tagihan pemasok material proyek contoh sudah perlu diproses.",
    read: true,
    severity: "CRITICAL",
    category: "ACTION_REQUIRED",
    isResolved: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "test",
    userId: "test",
    title: "Pembayaran selesai",
    message: "Pembayaran vendor untuk proyek contoh telah dicatat.",
    read: true,
    severity: "INFO",
    category: "ACTION_REQUIRED",
    isResolved: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    tenantId: "test",
    userId: "test",
    title: "Penerimaan material dicatat",
    message: "Material proyek contoh sudah diterima di gudang dan siap dipakai tim lapangan.",
    read: false,
    severity: "INFO",
    category: "INFORMATIONAL",
    isResolved: false,
    createdAt: new Date().toISOString(),
  },
];
function Preview({ failure = false }: { failure?: boolean }): React.JSX.Element {
  const store = useMemo(
    () =>
      createNotificationStore(
        {
          summary: async () =>
            failure
              ? { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Gagal" } }
              : {
                  success: true,
                  data: {
                    unreadCount: 2,
                    actionRequiredCount: 2,
                    informationalUnreadCount: 1,
                    items: [],
                  },
                },
          list: async ({ category }) => ({
            success: true,
            data: {
              items: examples.filter((item) => item.category === category),
              hasMore: false,
              nextCursor: null,
            },
          }),
          mark: async () => ({
            success: false,
            error: { code: "INTERNAL_SERVER_ERROR", message: "Contoh kegagalan penyimpanan" },
          }),
          markAll: async () => ({
            success: false,
            error: { code: "INTERNAL_SERVER_ERROR", message: "Contoh kegagalan penyimpanan" },
          }),
        },
        { available: () => true, subscribe: () => () => undefined, reportError: () => undefined },
      ),
    [failure],
  );
  return (
    <NotificationStoreProvider store={store}>
      <div className="mx-auto min-h-screen max-w-md space-y-5 bg-background p-4">
        <div className="flex justify-end">
          <NotificationBellButton />
        </div>
        <NotificationCenterView />
      </div>
    </NotificationStoreProvider>
  );
}
const meta: Meta<typeof Preview> = {
  title: "Features/Notifications",
  component: Preview,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
};
export default meta;
type Story = StoryObj<typeof Preview>;
export const Populated: Story = {};
export const Failed: Story = { args: { failure: true } };
