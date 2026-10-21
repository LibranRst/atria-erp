/** Loopback-only synthetic QA server. Imported by tests/tooling, never by app routes. */
import type { ServerSession, WebRpcOperation, WebRpcResult } from "@atria/api/contract";
import { ROLE_PERMISSIONS, type PermissionKey } from "@atria/core/auth/permissions";
import { createProjectSchema, updateProjectSchema } from "@atria/core/validations/project";
import {
  updateProjectBudgetCategoryAllocationSchema,
  createProjectBudgetFromRatiosSchema,
} from "@atria/core/validations/budget";
import { updateOwnProfileSchema, changeOwnPasswordSchema } from "@atria/core/validations/profile";
import { changeTemporaryPasswordSchema } from "@atria/core/validations/administration";
import superjson from "superjson";
import { z } from "zod";
import type { AdminActor } from "../lib/auth/policy";
import type { ProjectBudget, ProjectDetailData, ProjectListData } from "../features/projects/types";
import {
  projectListFixture,
  projectDetailFixture,
  projectBudgetFixture,
  projectFormFixture,
  FIXTURE_PROJECT_ID,
} from "../features/projects/fixtures/projects";

export const QA_BRIDGE_SECRET = "local-development-only-api-bridge-secret";
export const QA_EMAIL = "owner@atria.test";
export const QA_PASSWORD = "FixtureAdmin123!";
const fixtureToken = "qa-fixture-session";
const timestamp = new Date("2026-10-06T00:00:00.000Z");
const permissions = [
  "use:desktop_admin",
  "view:project",
  "view:budget",
  "create:project",
  "create:budget",
  "update:budget",
  "approve:budget",
  "view:profitability",
  "manage:onboarding",
  "review:onboarding",
] as const satisfies readonly PermissionKey[];
const stateUpdateSchema = z
  .object({
    reset: z.boolean().optional(),
    desktopAccess: z.boolean().optional(),
    domainAccess: z.boolean().optional(),
    temporaryPassword: z.boolean().optional(),
    onboarding: z.enum(["none", "setup", "review"]).optional(),
    outage: z.boolean().optional(),
    role: z.enum(["owner", "finance", "custom"]).optional(),
    scope: z.enum(["GLOBAL", "ASSIGNED", "NONE"]).optional(),
    empty: z.boolean().optional(),
    expired: z.boolean().optional(),
    permissions: z.array(z.enum(permissions)).optional(),
  })
  .strict();
type QAOptions = Required<Omit<z.infer<typeof stateUpdateSchema>, "reset" | "permissions">> & {
  permissions: readonly PermissionKey[] | null;
};
type ProjectList = Extract<ProjectListData, { status: "ready" }>;
interface OperationRecord {
  readonly operation: string;
  readonly args: readonly unknown[];
  readonly credentialPresent: boolean;
}
interface QAState {
  options: QAOptions;
  name: string;
  password: string;
  projects: ProjectList;
  detail: ProjectDetailData;
  budget: ProjectBudget;
  operations: OperationRecord[];
}

function freshState(): QAState {
  if (projectListFixture.status !== "ready") throw new Error("Project QA fixture must be ready.");
  return {
    options: {
      desktopAccess: true,
      domainAccess: true,
      temporaryPassword: false,
      onboarding: "none",
      outage: false,
      role: "owner",
      scope: "GLOBAL",
      empty: false,
      expired: false,
      permissions: null,
    },
    name: "Owner Pengujian",
    password: QA_PASSWORD,
    projects: structuredClone(projectListFixture),
    detail: structuredClone(projectDetailFixture),
    budget: structuredClone(projectBudgetFixture),
    operations: [],
  };
}

class FixtureFailure extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

function rpc(data: unknown, invalidations: readonly { readonly path: string }[] = []): Response {
  return new Response(
    superjson.stringify({
      ok: true,
      data,
      revalidatePaths: invalidations.map((item) => item.path),
      invalidations,
    }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}

function typedResult<K extends WebRpcOperation>(
  _operation: K,
  result: WebRpcResult<K>,
): WebRpcResult<K> {
  return result;
}
function projectInvalidations(id = FIXTURE_PROJECT_ID): readonly { readonly path: string }[] {
  return [{ path: "/projects" }, { path: `/projects/${id}` }, { path: "/ledger" }];
}

/** All state is in this closure; no environment database URL or backend runtime is read. */
export function createFixtureAPI(): { readonly fetch: (request: Request) => Promise<Response> } {
  let state = freshState();

  function actor(): AdminActor {
    const role = state.options.role;
    const defaultPermissions =
      role === "custom"
        ? ["use:desktop_admin", "view:project", "view:budget"]
        : ROLE_PERMISSIONS[role === "finance" ? "FINANCE_ADMIN" : "OWNER"];
    const effectivePermissions: readonly PermissionKey[] = (
      state.options.permissions ?? defaultPermissions
    ).filter((permission): permission is PermissionKey => {
      if (permission === "use:desktop_admin") return state.options.desktopAccess;
      if (!state.options.domainAccess && permission === "view:budget") return false;
      return true;
    });
    return {
      userId: "owner-fixture",
      roleId: `${role}-fixture`,
      roleName: role === "custom" ? "QA_CUSTOM" : role === "finance" ? "FINANCE_ADMIN" : "OWNER",
      name: state.name,
      email: QA_EMAIL,
      image: null,
      isActive: true,
      mustChangePassword: state.options.temporaryPassword,
      sessionId: "session-fixture",
      permissions: effectivePermissions,
      dataScope: state.options.scope,
      developerActorUserId: null,
    };
  }

  function session(): NonNullable<ServerSession> {
    const current = actor();
    return {
      user: {
        id: current.userId,
        name: current.name,
        email: current.email,
        image: null,
        emailVerified: true,
        roleId: current.roleId,
        isActive: true,
        mustChangePassword: current.mustChangePassword,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      session: {
        id: current.sessionId,
        userId: current.userId,
        token: fixtureToken,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        createdAt: timestamp,
        updatedAt: timestamp,
        ipAddress: null,
        userAgent: null,
        developerActorUserId: null,
      },
    };
  }

  function authenticated(request: Request): boolean {
    return (
      !state.options.expired &&
      (request.headers.get("cookie") ?? "")
        .split(";")
        .some((part) => part.trim() === `better-auth.session_token=${fixtureToken}`)
    );
  }

  function requirePermission(permission: PermissionKey): void {
    if (!actor().permissions.includes(permission))
      throw new FixtureFailure("FORBIDDEN", "Izin pengujian tidak tersedia.");
  }

  function listProjects(): ProjectList {
    const scoped =
      state.options.empty || state.options.scope === "NONE"
        ? []
        : state.options.scope === "ASSIGNED"
          ? state.projects.projects.filter((item) => item.id === FIXTURE_PROJECT_ID)
          : state.projects.projects;
    return { ...state.projects, projects: scoped };
  }

  function syncBudget(): void {
    state.detail = { ...state.detail, projectBudgetDashboard: structuredClone(state.budget) };
    state.projects = {
      ...state.projects,
      projects: state.projects.projects.map((item) =>
        item.id === FIXTURE_PROJECT_ID ? { ...item, budgetStatus: state.budget.status } : item,
      ),
    };
  }

  function invoke(
    operation: string,
    args: readonly unknown[],
  ): { readonly result: unknown; readonly invalidations?: readonly { readonly path: string }[] } {
    switch (operation) {
      case "features/navigation/server/home-destination.resolveHomeDestination":
        return {
          result: typedResult(
            operation,
            state.options.onboarding === "setup"
              ? "/onboarding?step=welcome"
              : state.options.onboarding === "review"
                ? "/onboarding/review"
                : "/projects",
          ),
        };
      case "features/projects/list/server/get-project-list-page-data.getProjectListPageData":
        requirePermission("view:budget");
        return { result: typedResult(operation, listProjects()) };
      case "features/projects/detail/server/get-project-detail-data.getProjectDetailData": {
        requirePermission("view:budget");
        const id = z.string().parse(args[0]);
        const project = listProjects().projects.find((item) => item.id === id);
        if (!project || !state.detail.project)
          throw new FixtureFailure("NOT_FOUND", "Proyek pengujian di luar cakupan.");
        const detail: ProjectDetailData =
          id === FIXTURE_PROJECT_ID
            ? state.detail
            : {
                ...state.detail,
                project: {
                  ...state.detail.project,
                  id,
                  name: project.name,
                  totalContractValue: String(project.totalContractValue),
                  status: project.status,
                  location: project.location ?? null,
                  notes: project.notes ?? null,
                },
                projectBudgetDashboard: null,
              };
        return { result: typedResult(operation, detail) };
      }
      case "app/actions/project/crud.getProjectFormData":
        return { result: typedResult(operation, { success: true, data: projectFormFixture }) };
      case "app/actions/project/excel-budget.getProjectBudgetDashboard":
        requirePermission("view:budget");
        return { result: typedResult(operation, { success: true, data: state.budget }) };
      case "app/actions/project/excel-budget.createProjectBudgetFromRatios": {
        requirePermission("create:budget");
        createProjectBudgetFromRatiosSchema.parse(args[0]);
        state.budget = { ...state.budget, status: "DRAFT" };
        syncBudget();
        return {
          result: typedResult(operation, { success: true, data: state.budget }),
          invalidations: projectInvalidations(),
        };
      }
      case "app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation": {
        requirePermission("update:budget");
        const input = updateProjectBudgetCategoryAllocationSchema.parse(args[0]);
        if (state.budget.status !== "DRAFT" && state.budget.status !== "REJECTED")
          throw new FixtureFailure(
            "FORBIDDEN",
            "Budget pengujian tidak dapat diedit pada status ini.",
          );
        state.budget = {
          ...state.budget,
          categories: state.budget.categories.map((category) =>
            category.id === input.projectBudgetCategoryId
              ? { ...category, allocatedAmount: input.allocatedAmount ?? category.allocatedAmount }
              : category,
          ),
        };
        syncBudget();
        return {
          result: typedResult(operation, { success: true, data: state.budget }),
          invalidations: projectInvalidations(),
        };
      }
      case "app/actions/project/excel-budget.submitProjectBudget":
        requirePermission("update:budget");
        state.budget = { ...state.budget, status: "PENDING_APPROVAL" };
        syncBudget();
        return {
          result: typedResult(operation, { success: true, data: state.budget }),
          invalidations: projectInvalidations(),
        };
      case "app/actions/project/excel-budget.approveProjectBudget":
        requirePermission("approve:budget");
        state.budget = { ...state.budget, status: "APPROVED" };
        syncBudget();
        return {
          result: typedResult(operation, { success: true, data: state.budget }),
          invalidations: projectInvalidations(),
        };
      case "app/actions/project/excel-budget.rejectProjectBudget":
        requirePermission("approve:budget");
        state.budget = { ...state.budget, status: "REJECTED" };
        syncBudget();
        return {
          result: typedResult(operation, { success: true, data: state.budget }),
          invalidations: projectInvalidations(),
        };
      case "app/actions/project/crud.createProjectAction": {
        requirePermission("create:project");
        const input = createProjectSchema.parse(args[0]);
        const id = crypto.randomUUID();
        const source = state.projects.projects[0];
        if (!source) throw new FixtureFailure("NOT_FOUND", "Fixture dasar tidak tersedia.");
        state.projects = {
          ...state.projects,
          projects: [
            ...state.projects.projects,
            {
              ...source,
              id,
              name: input.name,
              status: input.status,
              totalContractValue: input.totalContractValue,
              location: input.location ?? null,
              notes: input.notes ?? null,
            },
          ],
        };
        return {
          result: typedResult(operation, { success: true, data: { id } }),
          invalidations: projectInvalidations(id),
        };
      }
      case "app/actions/project/crud.updateProjectAction": {
        requirePermission("update:budget");
        const input = updateProjectSchema.parse(args[0]);
        state.projects = {
          ...state.projects,
          projects: state.projects.projects.map((item) =>
            item.id === input.id
              ? {
                  ...item,
                  name: input.name,
                  location: input.location ?? null,
                  notes: input.notes ?? null,
                }
              : item,
          ),
        };
        if (state.detail.project?.id === input.id)
          state.detail = {
            ...state.detail,
            project: {
              ...state.detail.project,
              name: input.name,
              location: input.location ?? null,
              notes: input.notes ?? null,
            },
          };
        return {
          result: typedResult(operation, { success: true, data: { id: input.id } }),
          invalidations: projectInvalidations(input.id),
        };
      }
      case "app/actions/profile/update-own-profile.updateOwnProfile": {
        state.name = updateOwnProfileSchema.parse(args[0]).name;
        return {
          result: typedResult(operation, { success: true, data: { updated: true } }),
          invalidations: [{ path: "/profile" }],
        };
      }
      case "app/actions/profile/change-own-password.changeOwnPassword":
      case "app/actions/administration-staff.changeTemporaryPassword": {
        const input =
          operation === "app/actions/administration-staff.changeTemporaryPassword"
            ? changeTemporaryPasswordSchema.parse(args[0])
            : changeOwnPasswordSchema.parse(args[0]);
        if (input.currentPassword !== state.password)
          throw new FixtureFailure("VALIDATION_ERROR", "Kata sandi pengujian tidak cocok.");
        state.password = input.newPassword;
        if (operation === "app/actions/administration-staff.changeTemporaryPassword") {
          state.options.temporaryPassword = false;
          state.options.expired = true;
        }
        return { result: typedResult(operation, { success: true, data: { changed: true } }) };
      }
      default:
        throw new FixtureFailure("NOT_FOUND", "Operasi tidak tersedia pada fixture pengujian.");
    }
  }

  return {
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      if (url.pathname === "/__qa/state") {
        if (request.method === "POST") {
          const parsed = stateUpdateSchema.safeParse(await request.json());
          if (!parsed.success)
            return Response.json({ error: "Kontrol QA tidak valid." }, { status: 400 });
          const { reset, ...options } = parsed.data;
          if (reset) state = freshState();
          state.options = { ...state.options, ...options };
        }
        return Response.json(
          {
            options: state.options,
            name: state.name,
            operations: state.operations,
            budget: state.budget,
            projects: state.projects,
          },
          { headers: { "cache-control": "no-store" } },
        );
      }
      if (state.options.outage)
        return Response.json({ error: "Fixture API outage" }, { status: 503 });
      if (url.pathname === "/health") return Response.json({ status: "ok", synthetic: true });
      if (url.pathname === "/api/auth/sign-in/email" && request.method === "POST") {
        const parsed = z
          .object({ email: z.string(), password: z.string() })
          .safeParse(await request.json());
        if (
          !parsed.success ||
          parsed.data.email !== QA_EMAIL ||
          parsed.data.password !== state.password
        )
          return Response.json(
            { code: "INVALID_EMAIL_OR_PASSWORD", message: "Fixture credentials mismatch" },
            { status: 401 },
          );
        state.options.expired = false;
        return Response.json(
          { redirect: false, token: fixtureToken, user: session().user },
          {
            headers: {
              "set-cookie": `better-auth.session_token=${fixtureToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600`,
            },
          },
        );
      }
      if (url.pathname === "/api/auth/get-session")
        return Response.json(authenticated(request) ? session() : null, {
          headers: { "cache-control": "no-store" },
        });
      if (url.pathname === "/api/auth/sign-out") {
        state.options.expired = true;
        return Response.json(
          { success: true },
          {
            headers: {
              "set-cookie": "better-auth.session_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
            },
          },
        );
      }
      if (url.pathname !== "/api/internal/web-rpc" || request.method !== "POST")
        return Response.json({ error: "Fixture route not found" }, { status: 404 });
      try {
        if (request.headers.get("x-atria-bridge-secret") !== QA_BRIDGE_SECRET)
          throw new FixtureFailure("UNAUTHORIZED", "Fixture bridge credentials missing.");
        const input = z
          .object({ operation: z.string(), args: z.array(z.unknown()) })
          .parse(superjson.parse<unknown>(await request.text()));
        const credentialPresent = authenticated(request);
        state.operations.push({
          operation: input.operation,
          args: input.operation.includes("Password") ? ["redacted password input"] : input.args,
          credentialPresent,
        });
        if (input.operation === "server/actor.resolveActor")
          return rpc(typedResult(input.operation, credentialPresent ? actor() : null));
        if (!credentialPresent)
          throw new FixtureFailure("UNAUTHORIZED", "Fixture session expired.");
        if (state.options.temporaryPassword && !input.operation.includes("Password"))
          throw new FixtureFailure("FORBIDDEN", "MUST_CHANGE_PASSWORD: Fixture password gate.");
        const result = invoke(input.operation, input.args);
        return rpc(result.result, result.invalidations);
      } catch (error: unknown) {
        const failure =
          error instanceof FixtureFailure
            ? error
            : new FixtureFailure("VALIDATION_ERROR", "Payload fixture tidak valid.");
        return new Response(
          superjson.stringify({
            ok: false,
            error: { code: failure.code, message: failure.message },
          }),
          {
            status:
              failure.code === "UNAUTHORIZED" ? 401 : failure.code === "FORBIDDEN" ? 403 : 400,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      }
    },
  };
}

if (import.meta.main) {
  const api = createFixtureAPI();
  const port = z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .parse(process.env.ATRIA_QA_API_PORT ?? "3301");
  Bun.serve({ hostname: "127.0.0.1", port, fetch: api.fetch });
  console.log(`Synthetic admin QA API listening on http://127.0.0.1:${port}`);
}
