import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const root = new URL("../../../", import.meta.url);
const source = await readFile(new URL(".github/workflows/web-pilot-quality.yml", root), "utf8");
const permissions = z.record(z.string(), z.enum(["read", "write", "none"]));
const defaults = z
  .object({
    run: z.object({ "working-directory": z.string().optional() }).passthrough().optional(),
  })
  .passthrough();
const stepSchema = z
  .object({
    name: z.string().optional(),
    uses: z.string().optional(),
    run: z.string().optional(),
    if: z.unknown().optional(),
    "continue-on-error": z.unknown().optional(),
    "working-directory": z.string().optional(),
    env: z.record(z.string(), z.unknown()).optional(),
    with: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
const workflow = z
  .object({
    name: z.string(),
    on: z.record(z.string(), z.unknown()),
    permissions,
    defaults: defaults.optional(),
    env: z.record(z.string(), z.unknown()).optional(),
    jobs: z.record(
      z.string(),
      z
        .object({
          "runs-on": z.string(),
          if: z.unknown().optional(),
          "continue-on-error": z.unknown().optional(),
          environment: z.unknown().optional(),
          permissions: permissions.optional(),
          defaults: defaults.optional(),
          env: z.record(z.string(), z.unknown()).optional(),
          steps: z.array(stepSchema),
        })
        .passthrough(),
    ),
  })
  .passthrough()
  .parse(Bun.YAML.parse(source));
const scripts = z
  .object({ scripts: z.record(z.string(), z.string()) })
  .parse(JSON.parse(await readFile(new URL("package.json", root), "utf8"))).scripts;

type Job = (typeof workflow.jobs)[string];
type Step = z.infer<typeof stepSchema>;

function requiredJob(name: string): Job {
  const job = workflow.jobs[name];
  expect(job, `Keep the ${name} check available for branch protection`).toBeDefined();
  if (!job) throw new Error(`Missing CI job: ${name}`);
  return job;
}

function commandStep(job: Job, command: string): Step {
  const step = job.steps.find(
    (candidate: Step): boolean =>
      candidate.run?.split("\n").some((line: string): boolean => line.trim() === command) ?? false,
  );
  expect(step, `CI must execute ${command}`).toBeDefined();
  if (!step) throw new Error(`Missing CI command: ${command}`);
  expect(step.if, `${command} must run unconditionally`).toBeUndefined();
  expect(step["continue-on-error"] ?? false, `${command} must fail the check on failure`).toBe(
    false,
  );
  expect(step["working-directory"] ?? ".").toBe(".");
  expect(job.defaults?.run?.["working-directory"] ?? ".").toBe(".");
  expect(workflow.defaults?.run?.["working-directory"] ?? ".").toBe(".");
  expect(step.run).not.toMatch(/\|\|\s*(?:true|:)|\bexit\s+0\b/);
  return step;
}

test("quality checks cover every push and pull request without branch or path filters", (): void => {
  for (const event of ["push", "pull_request"]) {
    expect(Object.hasOwn(workflow.on, event), `Missing ${event} trigger`).toBe(true);
    const configuration = workflow.on[event];
    expect(
      configuration == null ||
        Object.keys(z.record(z.string(), z.unknown()).parse(configuration)).length === 0,
      `${event} must not restrict branches, paths, or event types`,
    ).toBe(true);
  }
  expect(workflow.on).not.toHaveProperty("pull_request_target");
  expect(workflow.name).toBe("Web pilot quality");
  for (const name of ["quality", "postgres-integration"]) {
    const job = requiredJob(name);
    expect(job.if).toBeUndefined();
    expect(job["continue-on-error"] ?? false).toBe(false);
  }
});

test("unit gate runs all workspace tests and the database isolation guard regressions", (): void => {
  const job = requiredJob("quality");
  commandStep(job, "bun run test");
  expect(scripts.test).toMatch(/bun(?:\s+run)?\s+--filter\s+(?:["']\*["']|\*)\s+test\b/);
  expect(scripts.test).toMatch(/\bbun\s+run\s+test:dev-scripts\b/);
  for (const file of [
    "scripts/test-backup-pilot-db.py",
    "scripts/test-backup-production-db.py",
    "scripts/test-test-integration.py",
    "apps/api/scripts/test-local-postgres-audit.py",
  ])
    commandStep(job, `python3 ${file}`);
});

test("Chromium and its system dependencies are installed before the browser regression tests", (): void => {
  const job = requiredJob("quality");
  const setupIndex = job.steps.findIndex(
    (step: Step): boolean =>
      step.run
        ?.split("\n")
        .some(
          (line: string): boolean =>
            line.trim() === "bun x playwright install --with-deps chromium",
        ) ?? false,
  );
  expect(
    setupIndex,
    "Install Chromium so browser regressions cannot silently skip in fresh CI",
  ).toBeGreaterThanOrEqual(0);
  const setup = job.steps[setupIndex];
  if (!setup) throw new Error("Missing Chromium installation step");
  expect(setup.if).toBeUndefined();
  expect(setup["continue-on-error"] ?? false).toBe(false);
  expect(setup["working-directory"]).toBe("apps/web");
  expect(setupIndex).toBeLessThan(job.steps.indexOf(commandStep(job, "bun run test")));
});

test("integration gate uses the same owned disposable database runner as local verification", (): void => {
  const job = requiredJob("postgres-integration");
  commandStep(job, "bun run test:integration");
  expect(scripts["test:integration"]).toBe("python3 scripts/test-integration.py");
  expect(job).not.toHaveProperty("services");
  expect(job.steps.map((step: Step): string => step.run ?? "").join("\n")).not.toMatch(
    /prepare-disposable-postgres|run-local-postgres-audit|\b(?:psql|pg_restore|createdb|dropdb)\b/,
  );
});

test("CI runs untrusted contributions without deployment credentials or database configuration", (): void => {
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(source).not.toMatch(/\$\{\{\s*secrets\b/);
  const environments = [workflow.env];
  for (const job of Object.values(workflow.jobs)) {
    expect(job["runs-on"]).toMatch(/^ubuntu-[\w.-]+$/);
    expect(job.environment).toBeUndefined();
    expect(Object.values(job.permissions ?? {})).not.toContain("write");
    environments.push(job.env, ...job.steps.map((step: Step) => step.env));
    const checkouts = job.steps.filter(
      (step: Step): boolean => step.uses?.startsWith("actions/checkout@") ?? false,
    );
    expect(checkouts.length).toBeGreaterThan(0);
    for (const checkout of checkouts) expect(checkout.with?.["persist-credentials"]).toBe(false);
  }
  for (const environment of environments) {
    for (const name of Object.keys(environment ?? {})) {
      expect(
        name,
        "CI must not select an application database or receive provider credentials",
      ).not.toMatch(
        /DATABASE|^PG(?:HOST|PORT|USER|PASSWORD|DATABASE|SERVICE)|^(?:AWS|AZURE|GOOGLE|OPENAI|IMAGEKIT|NEON)_/i,
      );
    }
  }
});

test("integration artifacts contain sanitized suite results rather than raw logs or environment hashes", (): void => {
  const uploads = requiredJob("postgres-integration").steps.filter(
    (step: Step): boolean => step.uses?.startsWith("actions/upload-artifact@") ?? false,
  );
  expect(uploads.length).toBeGreaterThan(0);
  for (const upload of uploads) {
    expect(upload.with?.path).toBe("output/test-integration/*/suites/results.json");
  }
});
