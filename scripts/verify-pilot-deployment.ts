/** Manual, anonymous HTTP smoke. This never loads credentials or writes application data. */
import { pathToFileURL } from "node:url";

interface PilotUrls {
  readonly web: URL;
  readonly api: URL;
}

interface CheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

interface LoginAsset {
  readonly url: URL;
  readonly kind: "script" | "font";
}

const usage = "bun run verify:pilot --web https://your-web.example --api https://your-api.example";
const timeoutMs = 20_000;

function parseOrigin(value: string | undefined): URL {
  if (!value) throw new Error("Provide both --web and --api HTTPS origins.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Deployment URLs must be absolute HTTPS origins.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Deployment URLs must be HTTPS origins without credentials, paths or queries.");
  }
  return url;
}

function parseArguments(args: readonly string[]): PilotUrls {
  if (args.length !== 4) throw new Error("Provide exactly --web <origin> and --api <origin>.");
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if ((flag !== "--web" && flag !== "--api") || !value || values.has(flag)) {
      throw new Error("Provide exactly --web <origin> and --api <origin>.");
    }
    values.set(flag, value);
  }
  return { web: parseOrigin(values.get("--web")), api: parseOrigin(values.get("--api")) };
}

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function getAnonymous(url: URL): Promise<Response> {
  try {
    return await fetch(url, {
      method: "GET",
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("Anonymous GET failed or timed out; no response body is logged.");
  }
}

async function check(name: string, operation: () => Promise<string>): Promise<CheckResult> {
  try {
    return { name, passed: true, detail: await operation() };
  } catch (error: unknown) {
    return {
      name,
      passed: false,
      detail: error instanceof Error ? error.message : "Verification failed.",
    };
  }
}

function contentType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
}

async function checkApi(origin: URL, path: string, status: "ok" | "ready"): Promise<string> {
  const response = await getAnonymous(new URL(path, origin));
  ensure(response.status === 200, `Expected HTTP 200; received ${response.status}.`);
  ensure(
    contentType(response) === "application/json",
    "Expected JSON, not a provider access page.",
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("API returned invalid JSON.");
  }
  ensure(
    typeof body === "object" && body !== null && "status" in body && body.status === status,
    `Expected API status ${status}.`,
  );
  return `200 JSON; status ${status}`;
}

function isLoginRedirect(response: Response, web: URL): boolean {
  if (response.status !== 307 && response.status !== 308) return false;
  const location = response.headers.get("location");
  if (!location) return false;
  try {
    const target = new URL(location, web);
    return (
      target.origin === web.origin &&
      (target.pathname === "/login" || target.pathname === "/profile/password")
    );
  } catch {
    return false;
  }
}

async function checkProtectedRoute(web: URL, path: string): Promise<string> {
  const response = await getAnonymous(new URL(path, web));
  ensure(
    isLoginRedirect(response, web),
    `Expected a same-origin login redirect; received ${response.status}.`,
  );
  return `${response.status} to login/password gate; redirect not followed`;
}

async function checkServerArtifact(web: URL): Promise<string> {
  const response = await getAnonymous(new URL("/server/server-reference-manifest.json", web));
  const body = await response.text();
  ensure(
    !/encryptionKey/i.test(body),
    "Server artifact response contains an encryptionKey marker.",
  );
  const unavailable =
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404 ||
    isLoginRedirect(response, web);
  ensure(unavailable, `Expected server artifact access denial; received ${response.status}.`);
  return `${response.status}; no encryptionKey marker; anonymous check only`;
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return (match?.[1] ?? match?.[2])?.replace(/&amp;/g, "&");
}

function loginAssets(html: string, web: URL): readonly LoginAsset[] {
  const assets = new Map<string, LoginAsset>();
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const script = match[1].toLowerCase() === "script";
    if (!script && attribute(tag, "as")?.toLowerCase() !== "font") continue;
    const source = attribute(tag, script ? "src" : "href");
    if (!source) continue;
    const url = new URL(source, web);
    if (!url.pathname.startsWith("/_next/static/")) continue;
    ensure(url.origin === web.origin, "Next.js assets must use the supplied web origin.");
    assets.set(url.href, { url, kind: script ? "script" : "font" });
  }
  ensure(
    [...assets.values()].some((asset) => asset.kind === "script"),
    "Login HTML has no Next.js scripts.",
  );
  return [...assets.values()];
}

async function checkAsset(asset: LoginAsset): Promise<string> {
  const response = await getAnonymous(asset.url);
  ensure(response.status === 200, `Expected HTTP 200; received ${response.status}.`);
  const type = contentType(response);
  ensure(
    asset.kind === "script"
      ? /^(?:application|text)\/(?:javascript|ecmascript)$/.test(type)
      : /^(?:font\/|application\/(?:font-|x-font-|vnd\.ms-fontobject))/.test(type),
    `Expected ${asset.kind} content type; received ${type || "none"}.`,
  );
  const bytes = (await response.arrayBuffer()).byteLength;
  ensure(bytes > 0, "Asset is empty.");
  return `200 ${type}; ${bytes} bytes`;
}

async function checkAssets(assets: readonly LoginAsset[]): Promise<readonly CheckResult[]> {
  const results: CheckResult[] = [];
  // Fetch at most four assets at a time; hashes come from current HTML, never a saved build.
  for (let offset = 0; offset < assets.length; offset += 4) {
    results.push(
      ...(await Promise.all(
        assets
          .slice(offset, offset + 4)
          .map((asset, index) =>
            check(`Login ${asset.kind} ${offset + index + 1}`, () => checkAsset(asset)),
          ),
      )),
    );
  }
  return results;
}

async function verify(urls: PilotUrls): Promise<readonly CheckResult[]> {
  let assets: readonly LoginAsset[] = [];
  const results = await Promise.all([
    check("API health", () => checkApi(urls.api, "/health", "ok")),
    check("API readiness", () => checkApi(urls.api, "/ready", "ready")),
    check("Public login HTML", async (): Promise<string> => {
      const response = await getAnonymous(new URL("/login", urls.web));
      ensure(response.status === 200, `Expected HTTP 200; received ${response.status}.`);
      ensure(contentType(response) === "text/html", "Expected login HTML.");
      const html = await response.text();
      ensure(/<form\b/i.test(html), "Login HTML has no form.");
      assets = loginAssets(html, urls.web);
      const scriptCount = assets.filter((asset) => asset.kind === "script").length;
      return `200 HTML form; ${scriptCount} scripts, ${assets.length - scriptCount} preloaded fonts`;
    }),
  ]);
  results.push(
    ...(await Promise.all([
      ...["/ledger", "/admin", "/projects"].map((path) =>
        check(`Protected ${path}`, () => checkProtectedRoute(urls.web, path)),
      ),
      check("Server artifact denial", () => checkServerArtifact(urls.web)),
    ])),
    ...(await checkAssets(assets)),
  );
  return results;
}

async function main(): Promise<void> {
  if (process.argv.length === 3 && process.argv[2] === "--help") {
    console.log(usage);
    return;
  }
  const urls = parseArguments(process.argv.slice(2));
  console.log(`Anonymous deployment verification: ${urls.web.origin} + ${urls.api.origin}`);
  const results = await verify(urls);
  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
  }
  const failures = results.filter((result) => !result.passed).length;
  console.log(
    `${results.length - failures}/${results.length} checks passed. No authenticated workflows verified.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown): void => {
    console.error(error instanceof Error ? error.message : "Deployment verification failed.");
    console.error(usage);
    process.exitCode = 1;
  });
}
