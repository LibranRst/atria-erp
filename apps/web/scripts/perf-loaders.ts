/**
 * Mengukur waktu loader setiap halaman utama.
 *
 *   bun run perf:loaders
 *
 * Hanya membaca, jadi aman dijalankan terhadap database mana pun — termasuk
 * produksi, dan memang di sanalah angkanya berarti.
 *
 * Loader yang cepat di database kosong tidak membuktikan apa pun: yang bikin
 * lambat itu data. Karena itu skrip ini selalu mencetak jumlah baris yang
 * sedang diukur, dan menolak menyimpulkan apa-apa di bawah 500 baris. Angka
 * yang layak dijadikan patokan adalah angka dari database Polda yang sudah
 * berisi.
 *
 * Sengaja tidak mengembalikan exit code non-nol untuk yang lambat: waktu
 * eksekusi ikut berubah oleh mesin, jarak ke region Neon, dan tetangga sekamar
 * di server. Ini alat ukur, bukan gerbang CI.
 *
 * ## Yang belum bisa diukur di sini
 *
 * Sebagian loader membaca sesi sendiri lewat `getServerSession()` — bukan di
 * loadernya, tapi di dalam `lib/` yang dipanggilnya, misalnya
 * `lib/finance/approval-details.ts`. Padahal pemanggilnya sudah menyerahkan
 * `Actor`. Akibatnya `cookies()` dipanggil di luar request dan loadernya
 * berhenti sebelum satu query pun jalan.
 *
 * Skrip ini melaporkannya apa adanya, bukan sebagai kegagalan: yang salah bukan
 * pengukurannya, tapi kaitannya. Selama kaitan itu ada, loader tersebut juga
 * tidak bisa dipakai ulang oleh tRPC tanpa membawa request scope — jadi
 * melepasnya bukan cuma demi skrip ini.
 */
import { getApprovalsPageData } from "@/features/approvals/server/get-approvals-page-data";
import { getExpensesPageData } from "@/features/expenses/server/get-expenses-page-data";
import { getFinanceDashboardPageData } from "@/features/finance-dashboard/server/get-finance-dashboard-page-data";
import { getProjectListPageData } from "@/features/projects/list/server/get-project-list-page-data";
import { getSettingsPageData } from "@/features/settings/server/get-settings-page-data";
import { getReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";
import { getMaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { getRoleAccess } from "@/lib/auth/role-access";
import { countAllRows } from "./row-census";
import { db, pool } from "@/db";
import { role, user } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { eq } from "drizzle-orm";

const DIM = "[2m";
const RESET = "[0m";
const WARN = "[33m";
const BAD = "[31m";

/** Sekali dibuang untuk menyerap koneksi dingin, lalu tiga kali diukur. */
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 3;

/** Di bawah ini, angka apa pun cuma mengukur database yang kebetulan kosong. */
const MEANINGFUL_ROWS = 500;

const ATTENTION_MS = 500;
const SLOW_MS = 1000;

/**
 * Menyusun Actor dari Owner yang benar-benar ada di database.
 *
 * Bukan objek karangan: izin dan cakupan data ikut menentukan berapa banyak
 * yang di-query setiap loader, jadi Actor palsu akan mengukur jalur kode yang
 * tidak pernah dilewati siapa pun.
 */
async function resolveOwnerActor(): Promise<Actor> {
  const owner = await db
    .select({
      id: user.id,
      roleId: user.roleId,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .innerJoin(role, eq(role.id, user.roleId))
    .where(eq(role.name, "owner"))
    .limit(1);

  const found = owner[0];
  if (!found) {
    throw new Error(
      "Tidak ada pengguna Owner di database ini.\n" +
        "  Jalankan setelah onboarding selesai — loader diukur sebagai Owner karena\n" +
        "  peran itu yang paling banyak membaca.",
    );
  }

  const access = await getRoleAccess(found.roleId);
  if (!access) {
    throw new Error(`Peran ${found.roleId} tidak punya baris akses — database ini belum siap.`);
  }

  return {
    userId: found.id,
    roleId: found.roleId,
    roleName: access.roleName,
    permissions: access.permissions,
    dataScope: access.dataScope,
    name: found.name ?? "",
    email: found.email ?? "",
    isActive: true,
    mustChangePassword: false,
    sessionId: "",
    developerActorUserId: null,
  };
}

/**
 * Membedakan "tidak bisa diukur di sini" dari "rusak".
 *
 * Loader yang rantai impornya sampai ke `cookies()` berhenti di luar request
 * scope. Itu bukan kegagalan pengukuran, dan menandainya merah cuma bikin
 * keluaran ini kehilangan arti begitu ada yang benar-benar rusak.
 */
function isRequestBound(message: string): boolean {
  return message.includes("outside a request scope") || message.includes("was called outside");
}

/** Median dari beberapa kali jalan, supaya satu hiccup jaringan tidak menang. */
async function measure(load: () => Promise<unknown>): Promise<number> {
  for (let i = 0; i < WARMUP_RUNS; i += 1) await load();

  const times: number[] = [];
  for (let i = 0; i < MEASURED_RUNS; i += 1) {
    const started = performance.now();
    await load();
    times.push(performance.now() - started);
  }

  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

async function main(): Promise<void> {
  const target = process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@") ?? "(tidak diset)";
  console.log(`Waktu loader halaman utama\n${DIM}  ${target}${RESET}\n`);

  const actor = await resolveOwnerActor();
  const rows = await countAllRows(pool);

  const loaders: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
    ["/ledger", () => getFinanceDashboardPageData(actor)],
    ["/expenses", () => getExpensesPageData(actor)],
    ["/projects", () => getProjectListPageData(actor)],
    ["/approvals", () => getApprovalsPageData(actor)],
    ["/settings", () => getSettingsPageData()],
    ["/reconciliation", () => getReconciliationWorkspace()],
    ["/materials", () => getMaterialOperationsDashboard()],
  ];

  let failed = 0;
  let requestBound = 0;
  for (const [label, load] of loaders) {
    try {
      const median = await measure(load);
      const note =
        median > SLOW_MS
          ? `${BAD} ← lambat${RESET}`
          : median > ATTENTION_MS
            ? `${WARN} ← perlu diperhatikan${RESET}`
            : "";
      console.log(`  ${label.padEnd(18)} ${median.toFixed(0).padStart(6)} ms${note}`);
    } catch (error) {
      const message = (error as Error).message;
      if (isRequestBound(message)) {
        requestBound += 1;
        console.log(`  ${label.padEnd(18)} ${DIM}     — terikat request scope${RESET}`);
        continue;
      }
      failed += 1;
      console.log(`  ${label.padEnd(18)} ${BAD}GAGAL${RESET} ${DIM}${message}${RESET}`);
    }
  }

  console.log(
    `\n${DIM}Median dari ${MEASURED_RUNS} kali jalan, satu kali pemanasan dibuang.` +
      ` Diukur sebagai ${actor.roleName} (${actor.dataScope}).${RESET}`,
  );
  console.log(`${DIM}Volume data: ${rows.toLocaleString("id-ID")} baris.${RESET}`);

  if (rows < MEANINGFUL_ROWS) {
    console.log(
      `\n${WARN}Database ini terlalu kosong untuk dijadikan patokan.${RESET}\n` +
        `  Di bawah ${MEANINGFUL_ROWS} baris, semua loader akan terlihat cepat — termasuk yang\n` +
        "  nanti tidak. Ulangi setelah data Polda masuk, dan simpan angkanya.",
    );
  }

  if (requestBound > 0) {
    console.log(
      `\n${DIM}${requestBound} loader tidak bisa diukur di sini: rantai impornya sampai ke\n` +
        "  getServerSession(), jadi cookies() dipanggil di luar request. Selama itu\n" +
        "  masih begitu, loader tersebut juga belum bisa dipakai ulang oleh tRPC.\n" +
        `  Untuk sementara ukur lewat HTTP terhadap app yang jalan.${RESET}`,
    );
  }

  if (failed > 0) {
    console.log(
      `\n${BAD}${failed} loader gagal dijalankan${RESET} — perbaiki dulu sebelum mengukur.`,
    );
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(`${BAD}✗${RESET} ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
