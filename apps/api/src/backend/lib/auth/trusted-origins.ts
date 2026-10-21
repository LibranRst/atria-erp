/** Every browser frontend has its own cookie origin; accounts and auth stay API-owned. */
export function configuredAuthOrigins(
  environment: Readonly<Record<string, string | undefined>>,
  development: boolean,
): readonly string[] {
  return [
    environment.BETTER_AUTH_URL,
    environment.NEXT_PUBLIC_APP_URL,
    environment.NEXT_PUBLIC_AUTH_URL,
    environment.API_PUBLIC_URL ?? (development ? "http://localhost:3001" : undefined),
    environment.WEB_ORIGIN ?? (development ? "http://localhost:3000" : undefined),
    environment.ADMIN_ORIGIN ?? (development ? "http://localhost:3002" : undefined),
  ].flatMap((url): readonly string[] => {
    if (!url) return [];
    try {
      return [new URL(url).origin];
    } catch {
      return [];
    }
  });
}
