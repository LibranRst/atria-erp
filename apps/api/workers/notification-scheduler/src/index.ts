/**
 * Pemicu eksternal untuk worker notifikasi Atria.
 *
 * Fallback delivery worker dipanggil setiap 30 menit. Rekonsiliasi harian
 * berjalan pukul 00:00 WIB tanpa bergantung pada proses web. Pengiriman setelah event
 * tetap ditangani aplikasi. Worker memanggil endpoint pemulihan memakai
 * `NOTIFICATION_JOB_SECRET`; tidak ada logika notifikasi yang diduplikasi di
 * sini, jadi perilakunya identik dengan pemicu Vercel Cron.
 *
 * Deploy:
 *   cd apps/api/workers/notification-scheduler
 *   npx wrangler deploy
 *   npx wrangler secret put NOTIFICATION_JOB_SECRET
 *
 * Secret yang sama harus ada di API. Konfigurasi ATRIA_API_URL secara eksplisit.
 */
export interface Env {
  readonly NOTIFICATION_JOB_SECRET: string;
  readonly ATRIA_API_URL?: string;
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  if (!env.NOTIFICATION_JOB_SECRET) return false;
  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(request.headers.get("authorization") ?? "")),
    crypto.subtle.digest("SHA-256", encoder.encode(`Bearer ${env.NOTIFICATION_JOB_SECRET}`)),
  ]);
  const actualBytes = new Uint8Array(actual);
  const expectedBytes = new Uint8Array(expected);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

/** Delivery worker dan rekonsiliasi kondisi berbagi endpoint yang sama. */
async function trigger(
  env: Env,
  task: "deliveries" | "reconcile" | "all" | "material-analysis",
): Promise<Response> {
  if (!env.ATRIA_API_URL) throw new Error("ATRIA_API_URL wajib menunjuk backend API.");
  const base = env.ATRIA_API_URL.replace(/\/$/, "");
  const response = await fetch(
    task === "material-analysis"
      ? `${base}/api/internal/material-analysis`
      : `${base}/api/internal/notifications?task=${task}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTIFICATION_JOB_SECRET}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    // Biarkan Cron Trigger melihat kegagalan supaya terlihat di dashboard
    // Cloudflare, bukan gagal diam-diam seperti respons yang ditelan.
    const body = await response.text();
    throw new Error(`Atria worker ${task} gagal: HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  return response;
}

const scheduler = {
  /** Setiap 30 menit: pulihkan outbox/retry dan cek receipt yang menunggu. */
  async scheduled(
    controller: Pick<ScheduledController, "cron">,
    env: Env,
    ctx: Pick<ExecutionContext, "waitUntil">,
  ): Promise<void> {
    ctx.waitUntil(
      trigger(
        env,
        controller.cron === "* * * * *"
          ? "material-analysis"
          : controller.cron === "0 17 * * *"
            ? "all"
            : "deliveries",
      ),
    );
  },

  /** Jalur manual untuk memicu rekonsiliasi atau memverifikasi konfigurasi. */
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }
    if (!(await authorized(request, env))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const task = new URL(request.url).searchParams.get("task");
    if (task !== "deliveries" && task !== "reconcile") {
      return Response.json({ error: "task harus deliveries atau reconcile" }, { status: 400 });
    }
    const response = await trigger(env, task);
    return Response.json({ ok: true, task, upstream: response.status });
  },
};

export default scheduler;
