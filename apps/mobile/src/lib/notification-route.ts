import { resolveAppDestination, type AppDestination } from "./app-destination";

export const MOBILE_NOTIFICATION_ROUTES = [
  "/ledger",
  "/projects",
  "/materials",
  "/expenses",
  "/approvals",
] as const;
export type MobileNotificationRoute = (typeof MOBILE_NOTIFICATION_ROUTES)[number];
export type MobileNotificationDestination = AppDestination;

/** Tujuan belum native menjadi bridge eksplisit; konteks tab/filter tidak dibuang. */
export function resolveMobileNotificationRoute(
  destination: string | null | undefined,
  fallback: MobileNotificationRoute,
): MobileNotificationDestination {
  return (
    resolveAppDestination(destination ?? fallback) ??
    resolveAppDestination(fallback) ?? { kind: "native", href: { pathname: "/projects" } }
  );
}
