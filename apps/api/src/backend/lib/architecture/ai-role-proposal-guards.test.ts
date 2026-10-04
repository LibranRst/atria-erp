import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..");

function source(relativePath: string): string {
  return readFileSync(path.join(APP_ROOT, relativePath), "utf8");
}

/**
 * Empat pagar jalur usulan izin lewat asisten.
 *
 * Jalur ini adalah satu-satunya tempat izin bisa berubah dalam satu ketukan,
 * dan alasan ia boleh ada sama sekali adalah keempat pagar ini. Menghapus salah
 * satunya tanpa sengaja mengubah kartu percakapan menjadi jalan pintas
 * pemberian wewenang — kegagalan yang tidak menghasilkan error, tidak
 * menghasilkan keluhan pengguna, dan tidak terlihat sampai ada yang mengaudit.
 *
 * Keputusannya tercatat di `docs/plans/2026-08-25-ai-role-intelligence.md`.
 */
const CONFIRM_ACTION = "app/actions/ai/confirm-role-proposal.ts";
const CREATE_ACTION = "app/actions/ai/confirm-create-role-proposal.ts";
const ROLE_TOOLS = "lib/ai/tools/role-tools.ts";

describe("pagar usulan izin lewat asisten", () => {
  test("izin terlarang diperiksa sebelum menulis", () => {
    const action = source(CONFIRM_ACTION);

    expect(action).toContain("findForbiddenProposalPermissions");
    expect(action).toContain("describeForbiddenProposal");
    // Diperiksa untuk yang diberikan MAUPUN yang dicabut.
    expect(action).toContain("[...grant, ...revoke]");
  });

  test("izin terlarang juga diperiksa saat kartu dibuat", () => {
    // Kartu yang tampil lalu ditolak servernya adalah janji yang dilanggar.
    expect(source(ROLE_TOOLS)).toContain("findForbiddenProposalPermissions");
  });

  test("pencabutan yang menyisakan nol pemegang ditolak, bukan diperingatkan", () => {
    const action = source(CONFIRM_ACTION);

    expect(action).toContain("describeCriticalGaps");
    expect(action).toContain('refuse(\n      "CONFLICT"');
  });

  test("peran Owner ditolak di jalur ini", () => {
    expect(source(CONFIRM_ACTION)).toContain("proposal.roleId === OWNER_ROLE_ID");
  });

  test("audit menandai asal perubahan", () => {
    const action = source(CONFIRM_ACTION);
    const useCase = source("server/usecases/administration/roles.ts");

    expect(action).toContain('"AI_PROPOSAL"');
    expect(useCase).toContain('AI_PROPOSAL: "AI_PROPOSED_ROLE_CHANGE"');
  });

  test("anti-eskalasi dihitung terhadap aktor manusia, bukan konteks asisten", () => {
    const action = source(CONFIRM_ACTION);

    // Aktor selalu diselesaikan dari sesi di dalam Server Action, dan
    // penulisannya menumpang use-case yang sama dengan layar peran.
    expect(action).toContain("const actor = await resolveActor();");
    expect(action).toContain("updateRolePermissionsUseCase(\n    actor,");
  });

  test("selisih dihitung ulang dari database, bukan diambil dari kartu", () => {
    const action = source(CONFIRM_ACTION);

    // Peran bisa berubah antara kartu dibuat dan tombolnya ditekan.
    expect(action).toContain("db.query.role.findFirst");
    expect(action).toContain("const held = new Set(");
    expect(action).not.toContain("proposal.affectedUsers");
    expect(action).not.toContain("proposal.modulesLost");
  });

  test("satu kartu hanya bisa diterapkan sekali", () => {
    expect(source(CONFIRM_ACTION)).toContain("aiProposalConfirmation.toolCallId");
    expect(source(CREATE_ACTION)).toContain("aiProposalConfirmation.toolCallId");
  });
});

describe("pagar pembuatan peran lewat asisten", () => {
  test("izin terlarang tidak boleh lahir di peran baru", () => {
    const action = source(CREATE_ACTION);

    // Peran baru memang nol pemegang, tetapi ia menyala ketika seseorang
    // ditugaskan berbulan kemudian — oleh orang yang jarang membuka lagi
    // daftar izinnya.
    expect(action).toContain("findForbiddenProposalPermissions");
    expect(action).toContain("describeForbiddenProposal");
  });

  test("ditolak seluruhnya, bukan disaring diam-diam", () => {
    const tools = source(ROLE_TOOLS);
    const block = tools.slice(
      tools.indexOf("proposeCreateRole: tool({"),
      tools.indexOf("suggestRoleReview: tool({"),
    );

    // Membuang izin terlarang tanpa bilang menghasilkan peran yang dikira
    // sesuai permintaan padahal tidak.
    expect(block).toContain("findForbiddenProposalPermissions");
    expect(block).toContain("buildRoleCreateHref");
    expect(block).not.toContain(".filter((key) => !isForbidden");
  });

  test("nama peran diperiksa unik sebelum menulis", () => {
    expect(source(CREATE_ACTION)).toContain("eq(role.name, normalized)");
  });

  test("audit pembuatan menandai asalnya", () => {
    expect(source(CREATE_ACTION)).toContain('"AI_PROPOSAL"');
    expect(source("server/usecases/administration/roles.ts")).toContain(
      'AI_PROPOSAL: "AI_PROPOSED_ROLE_CREATE"',
    );
  });

  test("anti-eskalasi memakai use-case yang sama dengan layar", () => {
    const action = source(CREATE_ACTION);

    expect(action).toContain("const actor = await resolveActor();");
    expect(action).toContain("createRoleUseCase(\n    actor,");
  });
});

describe("pagar pembuatan pengguna lewat asisten", () => {
  const USER_CREATE_ACTION = "app/actions/ai/confirm-create-user-proposal.ts";
  const ROLE_TOOLS = "lib/ai/tools/role-tools.ts";

  test("peran Owner ditolak saat pembuatan pengguna lewat kartu", () => {
    expect(source(USER_CREATE_ACTION)).toContain("proposal.roleId === OWNER_ROLE_ID");
    expect(source(ROLE_TOOLS)).toContain("match.id === OWNER_ROLE_ID");
  });

  test("hanya aktor dengan izin manage:users yang boleh mengeksekusi", () => {
    expect(source(USER_CREATE_ACTION)).toContain('actorCan(actor, "manage:users")');
    expect(source(ROLE_TOOLS)).toContain('hasPermission(context, "manage:users")');
  });

  test("email diperiksa sebelum menulis", () => {
    expect(source(USER_CREATE_ACTION)).toContain("eq(user.email, proposal.email)");
    expect(source(ROLE_TOOLS)).toContain("eq(user.email, normalizedEmail)");
  });

  test("kata sandi sementara wajib mematuhi kebijakan password", () => {
    expect(source(USER_CREATE_ACTION)).toContain("aiCreateUserProposalSchema.safeParse");
    expect(source(ROLE_TOOLS)).toContain("generateSecureTemporaryPassword");
  });

  test("audit pembuatan pengguna menandai asal usulan AI", () => {
    expect(source(USER_CREATE_ACTION)).toContain('"AI_PROPOSAL"');
    expect(source(USER_CREATE_ACTION)).toContain('"CREATE_STAFF_USER"');
  });

  test("satu kartu pembuatan user hanya bisa diterapkan sekali", () => {
    expect(source(USER_CREATE_ACTION)).toContain("aiProposalConfirmation.toolCallId");
    expect(source(USER_CREATE_ACTION)).toContain('"CREATE_USER"');
  });
});

describe("pagar pembuatan pengguna batch lewat asisten", () => {
  const BATCH_CREATE_ACTION = "app/actions/ai/confirm-create-user-batch-proposal.ts";
  const ROLE_TOOLS = "lib/ai/tools/role-tools.ts";

  test("peran Owner ditolak saat pembuatan pengguna batch lewat kartu", () => {
    expect(source(BATCH_CREATE_ACTION)).toContain("u.roleId === OWNER_ROLE_ID");
    expect(source(ROLE_TOOLS)).toContain("proposeCreateUserBatch");
  });

  test("hanya aktor dengan izin manage:users yang boleh mengeksekusi batch", () => {
    expect(source(BATCH_CREATE_ACTION)).toContain('actorCan(actor, "manage:users")');
  });

  test("email duplikat internal maupun database ditolak", () => {
    expect(source(BATCH_CREATE_ACTION)).toContain("emailSet.has(normalizedEmail)");
    expect(source(ROLE_TOOLS)).toContain("emailSet.has(email)");
  });

  test("audit pembuatan batch menandai asal usulan AI", () => {
    expect(source(BATCH_CREATE_ACTION)).toContain('"AI_PROPOSAL"');
    expect(source(BATCH_CREATE_ACTION)).toContain('"CREATE_STAFF_USER_BATCH"');
  });

  test("idempotensi batch kartu terikat pada toolCallId", () => {
    expect(source(BATCH_CREATE_ACTION)).toContain("aiProposalConfirmation.toolCallId");
    expect(source(BATCH_CREATE_ACTION)).toContain('"CREATE_USER_BATCH"');
  });
});
