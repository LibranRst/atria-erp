import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Pagar arsitektur: tool yang tersedia bagi model bahasa harus selalu read-only.
 *
 * Route handler `app/api/ai/chat/route.ts` adalah satu-satunya endpoint REST internal
 * di aplikasi ini, dan pengecualian itu hanya bisa dipertanggungjawabkan selama
 * model tidak punya jalan untuk mengubah data. Test ini gagal ketika ada yang
 * menambahkan operasi tulis ke dalam registry tool.
 */

const TOOLS_DIRECTORY = path.join(process.cwd(), "lib", "ai", "tools");

const FORBIDDEN_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bdb\s*\.\s*insert\s*\(/, label: "db.insert(" },
  { pattern: /\bdb\s*\.\s*update\s*\(/, label: "db.update(" },
  { pattern: /\bdb\s*\.\s*delete\s*\(/, label: "db.delete(" },
  { pattern: /\bdb\s*\.\s*execute\s*\(/, label: "db.execute(" },
  { pattern: /\bdb\s*\.\s*transaction\s*\(/, label: "db.transaction(" },
  { pattern: /\btx\s*\.\s*(insert|update|delete)\s*\(/, label: "tx.insert/update/delete(" },
];

function collectToolSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectToolSources(entryPath);
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }
    return [entryPath];
  });
}

describe("registry tool AI", () => {
  const files = collectToolSources(TOOLS_DIRECTORY);

  test("menemukan berkas tool untuk diperiksa", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test("tidak ada tool yang menulis ke database", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const source = readFileSync(filePath, "utf8");
      for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(process.cwd(), filePath)} memakai ${label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("setiap berkas tool berjalan hanya di server", () => {
    const missing = files.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return !source.startsWith('import "server-only";');
    });

    expect(missing.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });

  test("tidak ada tool yang memanggil Server Action mutasi", () => {
    // Tool usulan sekalipun hanya boleh membaca. Penulisan dipicu manusia dari
    // kartu konfirmasi, bukan dari dalam lingkaran agent.
    const violations = files.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /from\s+"@\/app\/actions\//.test(source);
    });

    expect(violations.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });

  test("registry memuat seluruh tool yang diharapkan dan tidak lebih", async () => {
    const { buildAiTools } = await import("@/lib/ai/tools");
    const { aiToolContextForRole } = await import("@/lib/testing/ai-tool-context");
    const tools = buildAiTools(aiToolContextForRole("OWNER"));

    expect(Object.keys(tools).sort()).toEqual([
      "analyzeRoleChangeImpact",
      "explainUserAccess",
      "getBankBalances",
      "getExpenseCategories",
      "getInventoryLocations",
      "getMaterialCatalog",
      "getMaterialShortage",
      "getPendingApprovals",
      "getPendingExpenseApprovals",
      "getProjectBudget",
      "getProjectHealth",
      "getProjectsAtRisk",
      "getRecentExpenses",
      "getUnpaidClientInvoices",
      "getUnpaidVendorBills",
      "getUpcomingBills",
      "listClients",
      "listProjects",
      "listRoles",
      "listVendors",
      "proposeBankReconciliation",
      "proposeCreateProject",
      "proposeCreateRole",
      "proposeCreateUser",
      "proposeCreateUserBatch",
      "proposeDisburseExpense",
      "proposeExpenseDraft",
      "proposeExpenseReview",
      "proposeGoodsReceipt",
      "proposeRecordClientPayment",
      "proposeRoleChange",
      "proposeSetupProjectBudget",
      "proposeVendorBillPayment",
      "requestUserInput",
      "suggestFollowUps",
      "suggestRoleReview",
      "whoCanDo",
    ]);
  });

  test("semua tool usulan diawali dengan kata propose", () => {
    const proposalFiles = [
      "proposal-tools.ts",
      "project-proposal-tools.ts",
      "finance-proposal-tools.ts",
      "material-proposal-tools.ts",
      "role-tools.ts",
    ];

    for (const file of proposalFiles) {
      const source = readFileSync(path.join(TOOLS_DIRECTORY, file), "utf8");
      expect(source).not.toContain("submitExpense");
      expect(source).not.toContain("createProjectAction");
      expect(source).not.toContain("payVendorBill");
    }
  });
});
