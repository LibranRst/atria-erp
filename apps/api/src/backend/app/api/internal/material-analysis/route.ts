import { after } from "@runtime/next-server";
import { timingSafeEqual } from "node:crypto";
import { drainMaterialAnalysis } from "@backend/server/services/material-analysis-worker";
export async function POST(request: Request): Promise<Response> {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const allowed = [process.env.CRON_SECRET, process.env.NOTIFICATION_JOB_SECRET]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const expected = Buffer.from(`Bearer ${value}`);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    });
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  after(async () => {
    await drainMaterialAnalysis();
  });
  return Response.json({ ok: true }, { status: 202 });
}
