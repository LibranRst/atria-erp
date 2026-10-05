export type RuntimeService = "api" | "web";

const serviceSettings = {
  api: { port: 3001, variable: "EXPO_PUBLIC_API_URL" },
  web: { port: 3000, variable: "EXPO_PUBLIC_WEB_URL" },
} satisfies Record<RuntimeService, { readonly port: number; readonly variable: string }>;

export function resolveRuntimeURL(
  service: RuntimeService,
  configuredURL: string | undefined,
  hostUri: string | null | undefined,
  development: boolean,
): string {
  const settings = serviceSettings[service];
  const configured = configuredURL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error(`${settings.variable} harus berupa URL HTTP atau HTTPS tanpa kredensial.`);
    }
    return configured.replace(/\/+$/, "");
  }

  if (development && hostUri) {
    const metroURL = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`);
    return `http://${metroURL.hostname}:${settings.port}`;
  }

  throw new Error(`${settings.variable} wajib diisi untuk build non-development.`);
}
