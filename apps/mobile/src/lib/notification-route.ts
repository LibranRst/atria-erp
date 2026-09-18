/**
 * Terjemahan tujuan notifikasi web → rute native yang benar-benar ada.
 *
 * Sumber tujuan tetap satu: `notificationDestination` di `@atria/core` (dipakai
 * server saat mengirim payload Web Push maupun Expo). Fungsi ini sengaja hanya
 * memangkas bagian tujuan yang belum punya layar di aplikasi native — bukan
 * peta rute tandingan. Aturan yang berlaku:
 *
 * - `/approvals`, `/projects/**`, `/materials/**`, `/expenses/**`, `/ledger`
 *   punya layar native sendiri; tab detail proyek (`?tab=...`) dibuang karena
 *   layar native masih menampilkan ringkasan proyek saja.
 * - `/reconciliation` belum ada di native; Dashboard finance (`/ledger`) adalah
 *   layar terdekat dan sudah membatasi diri untuk peran non-finance.
 * - `/notifications` tidak punya padanan native; pemanggil memakai rute
 *   cadangan sesuai peran.
 */
export const MOBILE_NOTIFICATION_ROUTES = [
  "/ledger",
  "/projects",
  "/materials",
  "/expenses",
  "/approvals",
] as const;

export type MobileNotificationRoute = (typeof MOBILE_NOTIFICATION_ROUTES)[number];

/** Rute native yang dijamin terdaftar di `expo-router`. */
export type MobileNotificationDestination = MobileNotificationRoute | `/projects/${string}`;

function pathnameOf(destination: string): string {
  const [pathname] = destination.split(/[?#]/);
  return pathname ?? "";
}

/** `/projects/<id>` dipertahankan; id diambil apa adanya agar proyek tetap terbuka. */
function projectDestination(pathname: string): MobileNotificationDestination {
  const rest = pathname.slice("/projects/".length);
  const [projectId] = rest.split("/");
  return projectId ? `/projects/${projectId}` : "/projects";
}

/** Selalu rute yang ada di native: salah satu dari `MOBILE_NOTIFICATION_ROUTES` atau `/projects/<id>`. */
export function resolveMobileNotificationRoute(
  destination: string | null | undefined,
  fallback: MobileNotificationRoute,
): MobileNotificationDestination {
  if (!destination || !destination.startsWith("/") || destination.startsWith("//")) return fallback;
  const pathname = pathnameOf(destination);
  if (pathname === "/approvals" || pathname.startsWith("/approvals/")) return "/approvals";
  if (pathname === "/projects" || pathname.startsWith("/projects/"))
    return projectDestination(pathname);
  if (pathname === "/materials" || pathname.startsWith("/materials/")) return "/materials";
  if (pathname === "/expenses" || pathname.startsWith("/expenses/")) return "/expenses";
  if (pathname === "/ledger" || pathname.startsWith("/ledger/")) return "/ledger";
  if (pathname === "/reconciliation" || pathname.startsWith("/reconciliation/")) return "/ledger";
  return fallback;
}
