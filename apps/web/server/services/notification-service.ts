import "server-only";

import { after } from "next/server";

import { processNotificationDeliveries } from "./notification-delivery";

/** Process the committed outbox after the domain response has been released. */
export function scheduleNotificationPush(ids: readonly string[]): void {
  if (!ids.length) return;
  try {
    after(async () => {
      await processNotificationDeliveries();
    });
  } catch {
    // CLI/tests have no request scope. The durable worker will claim the outbox later.
  }
}

/** Compatibility export for existing operators and focused tests. */
export async function sendCommittedNotificationPush(): Promise<void> {
  await processNotificationDeliveries();
}
