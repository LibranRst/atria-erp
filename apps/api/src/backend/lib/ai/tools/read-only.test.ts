import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Pagar arsitektur: tool yang tersedia bagi model bahasa harus selalu read-only.
 *
 * Route handler `app/api/ai/chat/route.ts` adalah satu-satunya endpoint REST internal
 * di aplikasi ini, dan pengecualian itu hanya bisa dipertanggungjawabkan selama
 * model tidak punya jalan untuk mengubah data. Test ini gagal ketika ada yang
 * menambahkan operasi tulis ke dalam registry tool.
 */

const TOOLS_DIRECTORY = import.meta.dir;

const FORBIDDEN_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bdb\s*\.\s*insert\s*\(/, label: "db.insert(" },
  { pattern: /\bdb\s*\.\s*update\s*\(/, label: "db.update(" },
  { pattern: /\bdb\s*\.\s*delete\s*\(/, label: "db.delete(" },
  { pattern: /\bdb\s*\.\s*execute\s*\(/, label: "db.execute(" },
  { pattern: /\bdb\s*\.\s*transaction\s*\(/, label: "db.transaction(" },
  { pattern: /\btx\s*\.\s*(insert|update|delete)\s*\(/, label: "tx.insert/update/delete(" },
  { pattern: /\btx\s*\.\s*execute\s*\(/, label: "tx.execute(" },
];

/** Two named readers need a repeatable, database-enforced READ ONLY snapshot. */
function hasReadOnlySnapshotTransaction(filePath: string, source: string): boolean {
  if (
    !["financial-history-tools.ts", "project-tools.ts"].some(
      (name) => path.resolve(filePath) === path.join(TOOLS_DIRECTORY, name),
    )
  )
    return false;
  const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "db" &&
      node.expression.name.text === "transaction"
    )
      calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const call = calls[0];
  if (calls.length !== 1 || call?.arguments.length !== 2) return false;
  const config = call.arguments[1];
  if (!ts.isObjectLiteralExpression(config) || config.properties.length !== 2) return false;
  const values: Record<string, string> = {};
  for (const property of config.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ||
      !ts.isStringLiteral(property.initializer)
    )
      return false;
    values[property.name.text] = property.initializer.text;
  }
  return values.isolationLevel === "repeatable read" && values.accessMode === "read only";
}

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
        if (label === "db.transaction(" && hasReadOnlySnapshotTransaction(filePath, source))
          continue;
        if (pattern.test(source)) {
          violations.push(`${path.relative(process.cwd(), filePath)} memakai ${label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test.each(["financial-history-tools.ts", "project-tools.ts"])(
    "snapshot exception rejects writes, dynamic configuration and other files: %s",
    (name) => {
      const file = path.join(TOOLS_DIRECTORY, name);
      const source = readFileSync(file, "utf8");
      expect(hasReadOnlySnapshotTransaction(file, source)).toBe(true);
      expect(
        hasReadOnlySnapshotTransaction(path.join(TOOLS_DIRECTORY, "other-tools.ts"), source),
      ).toBe(false);
      expect(
        hasReadOnlySnapshotTransaction(
          file,
          source.replace('accessMode: "read only"', 'accessMode: "read write"'),
        ),
      ).toBe(false);
      expect(
        hasReadOnlySnapshotTransaction(
          file,
          source.replace('accessMode: "read only"', "accessMode: requestedMode"),
        ),
      ).toBe(false);
      expect(
        hasReadOnlySnapshotTransaction(
          file,
          source.replace('isolationLevel: "repeatable read"', 'isolationLevel: "read committed"'),
        ),
      ).toBe(false);
      expect(
        hasReadOnlySnapshotTransaction(file, `${source}\ndb.transaction(async () => null);`),
      ).toBe(false);
      for (const write of [
        "db.insert(",
        "db.update(",
        "db.delete(",
        "db.execute(",
        "tx.insert(",
        "tx.update(",
        "tx.delete(",
        "tx.execute(",
      ]) {
        const mutated = `${source}\n${write}`;
        expect(
          FORBIDDEN_PATTERNS.some(
            ({ pattern, label }) => label !== "db.transaction(" && pattern.test(mutated),
          ),
        ).toBe(true);
      }
    },
  );

  test("tool backend tidak bergantung pada framework frontend", () => {
    const missing = files.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /(?:from|import)\s*["'](?:next(?:\/[^"']*)?|react(?:-dom)?(?:\/[^"']*)?|server-only|@atria\/web(?:\/[^"']*)?)["']/.test(
        source,
      );
    });

    expect(missing.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });

  test("tidak ada tool yang memanggil Server Action mutasi", () => {
    // Tool usulan sekalipun hanya boleh membaca. Penulisan dipicu manusia dari
    // kartu konfirmasi, bukan dari dalam lingkaran agent.
    const violations = files.filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /from\s+"@backend\/app\/actions\//.test(source);
    });

    expect(violations.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });

  test("registry memuat seluruh tool yang diharapkan dan tidak lebih", async () => {
    const { buildAiTools } = await import("@backend/lib/ai/tools");
    const { aiToolContextForRole } = await import("@backend/lib/testing/ai-tool-context");
    const tools = buildAiTools(aiToolContextForRole("OWNER"));

    expect(Object.keys(tools).sort()).toEqual(
      [
        "analyzeRoleChangeImpact",
        "explainUserAccess",
        "getQuickStartContext",
        "proposeQuickStart",
        "getAvailableActions",
        "getBankBalances",
        "getBankCashContext",
        "getBankReconciliationContext",
        "analyzeBankStatementAttachment",
        "getCatalogSettingsContext",
        "getCategoryPlanContext",
        "getCompanyBudgetDefaults",
        "getClientInvoiceContext",
        "getVendorPaymentContext",
        "getBudgetSettingsContext",
        "getOperationalSettingsContext",
        "getAdministrationContext",
        "getRabExportContext",
        "prepareRabExport",
        "inspectProjectBudgetSummary",
        "getOwnProfileContext",
        "proposeOwnProfile",
        "getExpenseCategorySettingsContext",
        "getEditableMaterials",
        "getEditableRapItems",
        "getExpenseCategories",
        "getExpenseBatchContext",
        "getFinancialHistory",
        "getInventoryLocations",
        "getMaterialCatalog",
        "getMaterialDraftForCorrection",
        "getMaterialInputContext",
        "getMaterialShortage",
        "getPendingApprovals",
        "getPendingExpenseApprovals",
        "getProjectBudget",
        "getProjectHealth",
        "getProjectManagementContext",
        "getProjectStockContext",
        "getProjectsAtRisk",
        "getRabDraftContext",
        "getRabWorkflowContext",
        "getRapDraftContext",
        "getRapLifecycleContext",
        "getRapSetupContext",
        "getRecentExpenses",
        "getUnpaidClientInvoices",
        "getUnpaidVendorBills",
        "getUpcomingBills",
        "getVendorBillContext",
        "getWarehouseContext",
        "listClients",
        "listProjects",
        "listRoles",
        "listVendors",
        "proposeBankReconciliation",
        "proposeBankCash",
        "proposeCatalogSettings",
        "proposeClientInvoice",
        "proposeClientInvoiceSchedule",
        "proposeBudgetSettings",
        "proposeApprovalThresholds",
        "proposeStaffChanges",
        "proposeRoleDetails",
        "proposeRoleDeletion",
        "proposeExpenseCategorySettings",
        "proposeCategoryPlanPackages",
        "proposeCreateProject",
        "proposeCreateRole",
        "proposeCreateUser",
        "proposeCreateUserBatch",
        "proposeDisburseExpense",
        "proposeExpenseDraft",
        "proposeExpenseBatch",
        "proposeExpenseBatchVerify",
        "proposeExpenseBatchDecision",
        "proposeExpenseBatchPayment",
        "proposeExpenseReview",
        "proposeGoodsReceipt",
        "proposeMaterialMaster",
        "proposeProjectManagement",
        "proposeProjectStock",
        "proposeRabDraft",
        "proposeRabWorkflow",
        "proposeRapLifecycleActions",
        "proposeRapMaterialChanges",
        "proposeRapMaterialDraft",
        "proposeRapSetupActions",
        "proposeRecordClientPayment",
        "proposeRoleChange",
        "proposeSetupProjectBudget",
        "proposeUpdateMaterial",
        "proposeVendorBill",
        "proposeVendorBillCorrection",
        "getVendorBillCorrectionContext",
        "proposeVendorBillPayment",
        "proposeVendorPaymentSchedule",
        "proposeVendorPaymentDecision",
        "proposeWarehouseOperation",
        "proposeWarehouseIntake",
        "getWarehouseIntakeContext",
        "getStockCorrectionContext",
        "proposeStockCorrection",
        "requestUserInput",
        "suggestFollowUps",
        "suggestRoleReview",
        "whoCanDo",
      ].sort(),
    );
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
