import { timingSafeEqual } from "node:crypto";

import { processNotificationDeliveries } from "@/server/services/notification-delivery";
import { runNotificationJob } from "@/server/services/notification-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return [process.env.CRON_SECRET, process.env.NOTIFICATION_JOB_SECRET]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => {
      const expected = Buffer.from(`Bearer ${secret}`);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const task = new URL(request.url).searchParams.get("task") ?? "all";
  if (task !== "all" && task !== "reconcile" && task !== "deliveries") {
    return Response.json({ error: "Unknown task" }, { status: 400 });
  }
  try {
    const reconciliation = task === "deliveries" ? null : await runNotificationJob();
    const deliveries =
      task === "reconcile" || task === "all" || task === "deliveries"
        ? await processNotificationDeliveries()
        : null;
    return Response.json({ task, reconciliation, deliveries });
  } catch (error) {
    console.error("Notification worker failed", error);
    return Response.json({ error: "Notification worker failed" }, { status: 500 });
  }
}

/** Vercel Cron invokes production routes with GET and CRON_SECRET. */
export async function GET(request: Request): Promise<Response> {
  return run(request);
}

/** Generic schedulers may continue using the documented bearer-authenticated POST. */
export async function POST(request: Request): Promise<Response> {
  return run(request);
}
