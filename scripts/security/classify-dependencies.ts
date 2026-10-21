import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { z } from "zod";

const dependencies = z.record(z.string(), z.string());
const metadataSchema = z.object({
  dependencies: dependencies.default({}),
  optionalDependencies: dependencies.default({}),
  peerDependencies: dependencies.default({}),
  optionalPeers: z.array(z.string()).default([]),
});
const workspaceSchema = metadataSchema.extend({
  name: z.string(),
  devDependencies: dependencies.default({}),
});
const lockSchema = z.object({
  lockfileVersion: z.number(),
  workspaces: z.record(z.string(), workspaceSchema),
  packages: z.record(z.string(), z.array(z.unknown()).min(1)),
});
const advisorySchema = z.object({
  id: z.number(),
  url: z.string().url(),
  title: z.string(),
  severity: z.string(),
  vulnerable_versions: z.string(),
});
const auditSchema = z.record(z.string(), z.array(advisorySchema));
export type Lock = z.infer<typeof lockSchema>;
export type Audit = z.infer<typeof auditSchema>;
type Peer = "none" | "required" | "optional";
type Metadata = z.infer<typeof metadataSchema>;
type Package = {
  readonly key: string;
  readonly name: string;
  readonly version: string | null;
  readonly workspace: string | null;
  readonly metadata: Metadata;
};
type Reach = {
  readonly profile: string;
  readonly kind: "production" | "development";
  readonly peer: Peer;
  readonly contractOnly: boolean;
  readonly path: readonly string[];
};
export type ClassifiedAdvisory = {
  readonly package: string;
  readonly lockedKey: string;
  readonly version: string | null;
  readonly advisory: z.infer<typeof advisorySchema>;
  readonly contexts: readonly Reach[];
  readonly webOrApiDependency: boolean;
  readonly review: string;
};
export type Classification = {
  readonly findings: readonly ClassifiedAdvisory[];
  readonly unresolved: readonly string[];
  readonly unmatchedAdvisories: readonly string[];
};

export function parseLock(text: string): Lock {
  const parsed = ts.parseConfigFileTextToJson("bun.lock", text);
  if (parsed.error) throw new Error("bun.lock JSONC cannot be parsed.");
  return lockSchema.parse(parsed.config);
}

/** Scoped names are one package segment, rather than two filesystem levels. */
function packageChain(key: string): readonly string[] {
  const segments = key.split("/");
  const result: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) continue;
    if (segment.startsWith("@")) {
      const name = segments[index + 1];
      if (!name) throw new Error(`Malformed locked package key: ${key}`);
      result.push(`${segment}/${name}`);
      index += 1;
    } else result.push(segment);
  }
  return result;
}

export function resolveDependency(
  keys: ReadonlySet<string>,
  parent: string | null,
  dependency: string,
): string | null {
  const chain = parent ? packageChain(parent) : [];
  for (let depth = chain.length; depth >= 0; depth -= 1) {
    const candidate = [...chain.slice(0, depth), dependency].join("/");
    if (keys.has(candidate)) return candidate;
  }
  return null;
}

function lockedPackage(key: string, entry: readonly unknown[]): Package {
  const descriptor = z.string().parse(entry[0]);
  const separator = descriptor.indexOf("@", descriptor.startsWith("@") ? 1 : 0);
  if (separator < 0) throw new Error(`Unsupported locked descriptor: ${key}`);
  const name = descriptor.slice(0, separator);
  const specifier = descriptor.slice(separator + 1);
  const workspace = specifier.startsWith("workspace:")
    ? specifier.slice("workspace:".length)
    : null;
  const version = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(specifier)
    ? specifier
    : (/(?:-|\/)(\d+\.\d+\.\d+)\.tgz(?:$|\?)/.exec(specifier)?.[1] ?? null);
  const metadata = entry.find(
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return { key, name, version, workspace, metadata: metadataSchema.parse(metadata ?? {}) };
}

function contextId(reach: Reach): string {
  return `${reach.profile}:${reach.kind}:${reach.peer}:${reach.contractOnly}`;
}
function reviewFinding(name: string, production: boolean): string {
  if (!production)
    return "Only development, mobile, optional/required peer, or declaration-contract paths were found; this does not establish API/web runtime exploitability.";
  if (name === "uuid")
    return "ExcelJS production package closure includes uuid8. The advisory concerns v3/v5/v6 with a caller-provided buffer; review actual exports/call sites. Do not force uuid11 across the CommonJS ExcelJS dependency.";
  if (name === "brace-expansion")
    return "ExcelJS/archive glob dependency path is installed. Exploitation needs an untrusted glob pattern reaching expansion; a locked dependency path alone does not prove that input path. Apply same-major registry patches.";
  return "API/web dependency closure is reachable. Review the advisory's vulnerable API and application input path before declaring it exploitable.";
}

export function classifyDependencies(lock: Lock, audit: Audit): Classification {
  const nodes = new Map(
    Object.entries(lock.packages).map(([key, entry]) => [key, lockedPackage(key, entry)]),
  );
  const keys = new Set(nodes.keys());
  const reaches = new Map<string, Map<string, Reach>>();
  const unresolved = new Set<string>();
  type Work = { readonly key: string; readonly reach: Reach };
  const queue: Work[] = [];
  function enqueue(parent: string | null, dependency: string, reach: Reach): void {
    const key = resolveDependency(keys, parent, dependency);
    if (!key) {
      unresolved.add(`${parent ?? reach.profile} -> ${dependency}`);
      return;
    }
    const node = nodes.get(key);
    if (!node) return;
    const next: Reach = {
      ...reach,
      path: [
        ...reach.path,
        `${node.name}@${node.version ?? (node.workspace ? `workspace:${node.workspace}` : "non-registry")}`,
      ],
    };
    const byContext = reaches.get(key) ?? new Map<string, Reach>();
    const id = contextId(next);
    if (byContext.has(id)) return;
    byContext.set(id, next);
    reaches.set(key, byContext);
    queue.push({ key, reach: next });
  }
  function edges(parent: string | null, metadata: Metadata, reach: Reach): void {
    for (const dependency of new Set([
      ...Object.keys(metadata.dependencies),
      ...Object.keys(metadata.optionalDependencies),
    ])) {
      const contractOnly =
        reach.contractOnly ||
        (parent === null && reach.profile === "apps/web" && dependency === "@atria/api");
      enqueue(parent, dependency, { ...reach, contractOnly });
    }
    for (const dependency of Object.keys(metadata.peerDependencies)) {
      const optional = metadata.optionalPeers.includes(dependency);
      const peer: Peer =
        optional || reach.peer === "optional"
          ? "optional"
          : reach.peer === "none"
            ? "required"
            : reach.peer;
      // Missing optional peers are not runtime graph errors.
      if (optional && !resolveDependency(keys, parent, dependency)) continue;
      enqueue(parent, dependency, { ...reach, peer });
    }
  }
  for (const [path, workspace] of Object.entries(lock.workspaces)) {
    const profile = path || "root";
    edges(null, workspace, {
      profile,
      kind: "production",
      peer: "none",
      contractOnly: false,
      path: [profile],
    });
    for (const dependency of Object.keys(workspace.devDependencies))
      enqueue(null, dependency, {
        profile,
        kind: "development",
        peer: "none",
        contractOnly: false,
        path: [`${profile} (dev)`],
      });
  }
  for (let index = 0; index < queue.length; index += 1) {
    const work = queue[index];
    if (!work) continue;
    const node = nodes.get(work.key);
    if (!node) continue;
    const metadata = node.workspace ? lock.workspaces[node.workspace] : node.metadata;
    if (!metadata) {
      unresolved.add(`Missing workspace ${node.workspace}`);
      continue;
    }
    // Crossing a workspace dependency follows its production metadata, never its devDependencies.
    edges(node.workspace ? null : node.key, metadata, work.reach);
  }
  const findings: ClassifiedAdvisory[] = [];
  const matched = new Set<string>();
  for (const node of nodes.values()) {
    for (const advisory of audit[node.name] ?? []) {
      if (!node.version || !Bun.semver.satisfies(node.version, advisory.vulnerable_versions))
        continue;
      matched.add(`${node.name}:${advisory.id}`);
      const contexts = [...(reaches.get(node.key)?.values() ?? [])].sort((a, b) =>
        contextId(a).localeCompare(contextId(b)),
      );
      const webOrApiDependency = contexts.some(
        (context) =>
          ["apps/web", "apps/api"].includes(context.profile) &&
          context.kind === "production" &&
          context.peer === "none" &&
          !context.contractOnly,
      );
      findings.push({
        package: node.name,
        lockedKey: node.key,
        version: node.version,
        advisory,
        contexts,
        webOrApiDependency,
        review: reviewFinding(node.name, webOrApiDependency),
      });
    }
  }
  const unmatchedAdvisories = Object.entries(audit).flatMap(([name, advisories]) =>
    advisories
      .filter((advisory) => !matched.has(`${name}:${advisory.id}`))
      .map((advisory) => `${name}: ${advisory.url}`),
  );
  return {
    findings: findings.sort(
      (a, b) => a.package.localeCompare(b.package) || a.lockedKey.localeCompare(b.lockedKey),
    ),
    unresolved: [...unresolved].sort(),
    unmatchedAdvisories,
  };
}

function markdown(report: Classification): string {
  const installed = report.findings.filter((finding) => finding.webOrApiDependency);
  const lines = [
    "# Dependency advisory classification",
    "",
    "This is lockfile package reachability, not proof of exploitability or an attestation of the final production bundle. Required and optional peers are separate from direct dependency paths. The web's declaration-only @atria/api dependency is classified as a contract boundary.",
    "",
    `API/web dependency-closure advisory instances: ${installed.length}. All matching locked advisory instances: ${report.findings.length}.`,
    "",
    "| Package/version | Context | Advisory | Review |",
    "| --- | --- | --- | --- |",
  ];
  for (const finding of report.findings) {
    const paths = finding.contexts.filter(
      (context) =>
        context.kind === "production" && context.peer === "none" && !context.contractOnly,
    );
    const context = paths.map((path) => path.profile).join(", ") || "dev / peer / contract only";
    lines.push(
      `| ${finding.package}@${finding.version} (${finding.lockedKey}) | ${context} | [${finding.advisory.severity}: ${finding.advisory.title.replaceAll("|", "/")}](${finding.advisory.url}) | ${finding.review} |`,
    );
  }
  lines.push("", "## Shortest API/web production dependency paths", "");
  const seen = new Set<string>();
  for (const finding of installed) {
    for (const context of finding.contexts.filter(
      (value) =>
        ["apps/web", "apps/api"].includes(value.profile) &&
        value.kind === "production" &&
        value.peer === "none" &&
        !value.contractOnly,
    )) {
      const path = context.path.join(" -> ");
      if (!seen.has(path)) {
        lines.push(`- ${path}`);
        seen.add(path);
      }
    }
  }
  if (report.unmatchedAdvisories.length)
    lines.push(
      "",
      "Audit entries which no longer match a locked version (rerun the audit after dependency updates):",
      ...report.unmatchedAdvisories.map((value) => `- ${value}`),
    );
  if (report.unresolved.length)
    lines.push(
      "",
      "Unresolved dependency edges require review; classification is incomplete for those edges:",
      ...report.unresolved.map((value) => `- ${value}`),
    );
  return lines.join("\n") + "\n";
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  function option(name: string): string | undefined {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  }
  const lockPath = resolve(option("--lock") ?? "bun.lock");
  const lockText = await readFile(lockPath, "utf8");
  let auditText: string;
  const auditPath = option("--audit");
  if (auditPath) auditText = await readFile(resolve(auditPath), "utf8");
  else {
    const child = Bun.spawn(["bun", "audit", "--json"], { stdout: "pipe", stderr: "pipe" });
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code > 1) throw new Error(`Dependency audit failed: ${error.slice(0, 500)}`);
    auditText = output;
  }
  const result = classifyDependencies(
    parseLock(lockText),
    auditSchema.parse(JSON.parse(auditText)),
  );
  if ((await readFile(lockPath, "utf8")) !== lockText)
    throw new Error("Lock changed during audit; rerun for consistent evidence.");
  const report = {
    generatedAt: new Date().toISOString(),
    lockSha256: Bun.CryptoHasher.hash("sha256", lockText, "hex"),
    auditSha256: Bun.CryptoHasher.hash("sha256", auditText, "hex"),
    ...result,
  };
  const output =
    option("--format") === "markdown" ? markdown(result) : JSON.stringify(report, null, 2) + "\n";
  const destination = option("--output");
  if (destination) {
    await mkdir(dirname(resolve(destination)), { recursive: true });
    await writeFile(resolve(destination), output);
    console.log(
      `Wrote ${destination}: ${result.findings.filter((value) => value.webOrApiDependency).length} API/web dependency-closure advisory instances, ${result.unresolved.length} unresolved edges.`,
    );
  } else console.log(output.trimEnd());
  const threshold = option("--fail-on-production");
  if (threshold && threshold !== "high" && threshold !== "any")
    throw new Error("Use --fail-on-production high or any.");
  if (result.unresolved.length) process.exitCode = 2;
  else if (
    result.findings.some(
      (finding) =>
        finding.webOrApiDependency &&
        (threshold === "any" ||
          (threshold === "high" && ["high", "critical"].includes(finding.advisory.severity))),
    )
  )
    process.exitCode = 1;
}
