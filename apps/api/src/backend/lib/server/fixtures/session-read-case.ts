import { expect, mock } from "bun:test";
import type { RoleAccess } from "@backend/lib/auth/role-access";
import type { RequiredServerSession, ServerSession } from "@backend/lib/server/session";

const ownerId = "12345678-1234-4234-8234-123456789012";
const changedUserId = "87654321-4321-4321-8321-210987654321";
const ownerRole = "00000000-0000-0000-0000-000000000001";
const changedRole = "00000000-0000-0000-0000-000000000002";

function sessionFor(
  userId: string,
  roleId = ownerRole,
  mustChangePassword = false,
): RequiredServerSession {
  const now = new Date("2026-10-04T00:00:00.000Z");
  return {
    session: {
      id: `synthetic-session-${userId}`,
      userId,
      token: "synthetic-session-token",
      expiresAt: new Date("2026-10-05T00:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      developerActorUserId: null,
    },
    user: {
      id: userId,
      roleId,
      name: "Synthetic account",
      email: "synthetic@example.invalid",
      emailVerified: true,
      image: null,
      isActive: true,
      mustChangePassword,
      createdAt: now,
      updatedAt: now,
    },
  };
}

let currentSession: ServerSession = sessionFor(ownerId);
let reads = 0;
const receivedHeaders: Headers[] = [];
mock.module("@backend/lib/auth", () => ({
  auth: {
    api: {
      getSession: async (input: { readonly headers: Headers }): Promise<ServerSession> => {
        reads++;
        receivedHeaders.push(input.headers);
        const response =
          input.headers.get("authorization") === "Bearer synthetic-account-b"
            ? sessionFor(changedUserId, changedRole)
            : currentSession;
        await new Promise<void>((resolve): void => {
          setTimeout(resolve, 5);
        });
        return response;
      },
    },
  },
}));
mock.module("@backend/lib/auth/role-access", () => ({
  getRoleAccess: async (roleId: string): Promise<RoleAccess> => ({
    roleId,
    roleName: roleId === ownerRole ? "OWNER" : "PROJECT_MANAGER",
    permissions: ["view:cost"],
    dataScope: roleId === ownerRole ? "GLOBAL" : "ASSIGNED",
  }),
}));

const { getServerSession, getSessionFromHeaders, requireServerSession } =
  await import("@backend/lib/server/session");
const { resolveActor } = await import("@backend/server/actor");
const { withRequestContext, headers } = await import("@runtime/request-context");
function request(authorization = "Bearer synthetic-account-a"): Request {
  return new Request("http://api.example.invalid/api/internal/web-rpc", {
    headers: {
      cookie: "better-auth.session_token=synthetic-cookie",
      authorization,
      "x-request-marker": "synthetic-header",
    },
  });
}

const mode = process.argv[2];
switch (mode) {
  case "sequential":
    await withRequestContext(request(), async (): Promise<void> => {
      // Compatibility gate, required-session loader and actor resolution all
      // invoke the actual zero-argument session helper in this same context.
      expect((await getServerSession())?.user.id).toBe(ownerId);
      expect((await requireServerSession()).user.id).toBe(ownerId);
      expect((await resolveActor())?.userId).toBe(ownerId);
      expect((await getServerSession())?.user.id).toBe(ownerId);
    });
    break;
  case "inflight":
    await withRequestContext(request(), async (): Promise<void> => {
      const [gate, loader, actor] = await Promise.all([
        getServerSession(),
        requireServerSession(),
        resolveActor(),
      ]);
      expect(gate?.user.id).toBe(ownerId);
      expect(loader.user.id).toBe(ownerId);
      expect(actor?.userId).toBe(ownerId);
    });
    break;
  case "null":
    currentSession = null;
    await withRequestContext(request(), async (): Promise<void> => {
      expect(await getServerSession()).toBeNull();
      expect(await getServerSession()).toBeNull();
      expect(await resolveActor()).toBeNull();
    });
    break;
  case "new-context": {
    const sameRequest = request();
    await withRequestContext(sameRequest, async (): Promise<void> => {
      expect((await getServerSession())?.user.id).toBe(ownerId);
    });
    currentSession = sessionFor(ownerId, changedRole, true);
    await withRequestContext(sameRequest, async (): Promise<void> => {
      expect((await getServerSession())?.user).toMatchObject({
        roleId: changedRole,
        mustChangePassword: true,
      });
    });
    break;
  }
  case "headers":
    await withRequestContext(request(), async (): Promise<void> => {
      await getServerSession();
    });
    expect(receivedHeaders[0]).toBeInstanceOf(Headers);
    expect(receivedHeaders[0]?.get("authorization")).toBe("Bearer synthetic-account-a");
    expect(receivedHeaders[0]?.get("cookie")).toBe("better-auth.session_token=synthetic-cookie");
    expect(receivedHeaders[0]?.get("x-request-marker")).toBe("synthetic-header");
    break;
  case "new-context-revoked": {
    const sameRequest = request();
    await withRequestContext(sameRequest, async (): Promise<void> => {
      expect((await getServerSession())?.user.id).toBe(ownerId);
    });
    currentSession = null;
    await withRequestContext(sameRequest, async (): Promise<void> => {
      expect(await getServerSession()).toBeNull();
    });
    break;
  }
  case "fresh-header":
    await withRequestContext(request(), async (): Promise<void> => {
      expect((await getServerSession())?.user.id).toBe(ownerId);
      currentSession = null; // A credential/session mutation revoked identity.
      expect(await getSessionFromHeaders(await headers())).toBeNull();
    });
    expect(receivedHeaders[1]?.get("authorization")).toBe("Bearer synthetic-account-a");
    break;
  case "parallel-contexts": {
    const results = await Promise.all([
      withRequestContext(
        request(),
        async (): Promise<string | undefined> => (await getServerSession())?.user.id,
      ),
      withRequestContext(
        request("Bearer synthetic-account-b"),
        async (): Promise<string | undefined> => (await getServerSession())?.user.id,
      ),
    ]);
    expect(results.map((result) => result.value)).toEqual([ownerId, changedUserId]);
    break;
  }
  default:
    throw new Error("Unknown isolated session regression scenario.");
}
console.log(JSON.stringify({ reads }));
