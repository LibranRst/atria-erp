import { fileURLToPath } from "node:url";
import { browserTestEnvironment } from "./environment";

const settings = browserTestEnvironment();
const target = process.argv[2];
if (target !== "api" && target !== "web") throw new Error("Choose api or web.");
const apiDirectory = fileURLToPath(new URL("../../api/", import.meta.url));
const webDirectory = fileURLToPath(new URL("../", import.meta.url));
const environment: Record<string, string> = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  ATRIA_LOCAL_TEST_DATABASE_URL: settings.databaseUrl,
  ATRIA_LOCAL_TEST_MODE: settings.mode,
  DATABASE_URL: settings.databaseUrl,
  DATABASE_URL_UNPOOLED: settings.databaseUrl,
  ATRIA_TEST_DATABASE_URL: settings.databaseUrl,
  API_PUBLIC_URL: settings.apiUrl,
  WEB_ORIGIN: settings.webUrl,
  BETTER_AUTH_URL: settings.apiUrl,
  BETTER_AUTH_SECRET: "atria-e2e-auth-secret-only-for-disposable-local-tests",
  API_BRIDGE_SECRET: "atria-e2e-bridge-secret-only-for-disposable-local-tests",
  API_ORIGIN: settings.apiUrl,
  API_CALL_TIMEOUT_MS: "60000",
  NEXT_PUBLIC_APP_URL: settings.webUrl,
  NEXT_PUBLIC_ATRIA_PILOT_MODE:
    process.env.NEXT_PUBLIC_ATRIA_PILOT_MODE === "true" ? "true" : "false",
  ATRIA_NEXT_DIST_DIR: ".next-pilot-e2e",
  ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED: "false",
  NEXT_PUBLIC_DESKTOP_ADMIN_AUTO: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  GEMINI_API_KEY: "",
  DEEPSEEK_API_KEY: "",
  NINEROUTER_API_KEY: "",
  IMAGEKIT_PRIVATE_KEY: "",
  NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY: "",
  NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: "",
  WEB_PUSH_VAPID_PRIVATE_KEY: "",
  WEB_PUSH_VAPID_PUBLIC_KEY: "",
};
if (process.env.TMPDIR) environment.TMPDIR = process.env.TMPDIR;
const command =
  target === "api"
    ? ["bun", "--no-env-file", "--preload", "./scripts/local-postgres-preload.ts", "src/index.ts"]
    : [
        "node",
        "./node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        new URL(settings.webUrl).port,
      ];
if (target === "api") environment.PORT = new URL(settings.apiUrl).port;
const child = Bun.spawn(command, {
  cwd: target === "api" ? apiDirectory : webDirectory,
  env: environment,
  stdin: "ignore",
  stdout: "inherit",
  stderr: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, (): void => {
    child.kill(signal);
  });
process.exitCode = await child.exited;
