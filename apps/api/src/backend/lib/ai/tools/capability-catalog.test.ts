import { describe, expect, test } from "bun:test";
import { buildAiTools } from "./index";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import { AI_CAPABILITIES, availableAiCapabilities, aiCapabilityReport } from "./capability-catalog";
import { canAccessProject } from "./context";
describe("effective AI capability catalog", () => {
  test("staff and role administration follow exact company grants rather than role names or project scope", () => {
    const base = {
      ...aiToolContextForRole("OWNER"),
      dataScope: "NONE" as const,
      permissions: ["use:ai_chat", "manage:users"] as const,
    };
    expect(buildAiTools(base).proposeStaffChanges).toBeDefined();
    expect(buildAiTools(base).proposeRoleDetails).toBeUndefined();
    const roles = { ...base, permissions: ["use:ai_chat", "manage:roles"] as const };
    expect(buildAiTools(roles).getAdministrationContext).toBeDefined();
    expect(buildAiTools(roles).proposeRoleDeletion).toBeDefined();
    expect(buildAiTools(roles).proposeStaffChanges).toBeUndefined();
    expect(
      buildAiTools({ ...base, permissions: ["manage:users"] }).proposeStaffChanges,
    ).toBeUndefined();
  });
  test("operational Settings require their exact company grants even with NONE project scope", () => {
    const base = {
      ...aiToolContextForRole("OWNER"),
      dataScope: "NONE" as const,
      permissions: ["use:ai_chat", "view:settings", "manage:approval_settings"] as const,
    };
    expect(buildAiTools(base).getOperationalSettingsContext).toBeDefined();
    expect(buildAiTools(base).proposeApprovalThresholds).toBeDefined();
    expect(buildAiTools(base).proposeExpenseCategorySettings).toBeUndefined();
    for (const key of base.permissions)
      expect(
        buildAiTools({ ...base, permissions: base.permissions.filter((p) => p !== key) })
          .proposeApprovalThresholds,
      ).toBeUndefined();
    const category = {
      ...base,
      permissions: ["use:ai_chat", "view:settings", "manage:expense_categories"] as const,
    };
    expect(buildAiTools(category).getExpenseCategorySettingsContext).toBeDefined();
    expect(buildAiTools(category).proposeExpenseCategorySettings).toBeDefined();
    expect(buildAiTools(category).proposeBudgetSettings).toBeUndefined();
    const reader = { ...base, permissions: ["use:ai_chat", "view:settings"] as const };
    expect(buildAiTools(reader).getOperationalSettingsContext).toBeDefined();
    expect(buildAiTools(reader).getExpenseCategorySettingsContext).toBeDefined();
    expect(buildAiTools(reader).proposeApprovalThresholds).toBeUndefined();
    expect(buildAiTools(reader).proposeExpenseCategorySettings).toBeUndefined();
  });
  test("stored bill corrections require actual read/update grants and project scope without draft creation rights", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "Custom corrections",
      dataScope: "ASSIGNED" as const,
      permissions: ["use:ai_chat", "view:vendor_bill", "update:vendor_bill"] as const,
    };
    expect(buildAiTools(context).proposeVendorBillCorrection).toBeDefined();
    expect(buildAiTools(context).proposeVendorBill).toBeUndefined();
    for (const key of context.permissions)
      expect(
        buildAiTools({ ...context, permissions: context.permissions.filter((p) => p !== key) })
          .proposeVendorBillCorrection,
      ).toBeUndefined();
    expect(
      buildAiTools({ ...context, dataScope: "NONE" }).getVendorBillCorrectionContext,
    ).toBeUndefined();
    expect(aiCapabilityReport(context).manual.some((a) => a.label.includes("tagihan vendor"))).toBe(
      false,
    );
  });
  test("intake follows each domain grant and both inventory reads for custom NONE roles", () => {
    const base = aiToolContextForRole("OWNER");
    for (const grant of [
      "create:stock_movement",
      "create:opening_inventory",
      "approve:opening_inventory",
      "reverse:opening_inventory",
    ] as const) {
      const context = {
        ...base,
        roleName: "Custom warehouse",
        dataScope: "NONE" as const,
        permissions: ["use:ai_chat", "view:material", "view:inventory", grant] as const,
      };
      expect(buildAiTools(context).proposeWarehouseIntake).toBeDefined();
      expect(buildAiTools(context).getWarehouseIntakeContext).toBeDefined();
      for (const permission of context.permissions)
        expect(
          buildAiTools({
            ...context,
            permissions: context.permissions.filter((p) => p !== permission),
          }).proposeWarehouseIntake,
        ).toBeUndefined();
      const labels =
        aiCapabilityReport(context).proposals.find((p) => p.tool === "proposeWarehouseIntake")
          ?.label ?? "";
      expect(labels).not.toBe("");
    }
  });
  test("invoice and company-default proposals follow each live grant and distinct project/Settings rights", () => {
    const base = aiToolContextForRole("OWNER");
    const invoice = {
      ...base,
      roleName: "Custom invoice maker",
      dataScope: "ASSIGNED" as const,
      permissions: [
        "use:ai_chat",
        "view:project",
        "view:client_invoice",
        "create:client_invoice",
      ] as const,
    };
    expect(buildAiTools(invoice).proposeClientInvoice).toBeDefined();
    expect(buildAiTools({ ...invoice, dataScope: "NONE" }).proposeClientInvoice).toBeUndefined();
    for (const permission of invoice.permissions)
      expect(
        buildAiTools({
          ...invoice,
          permissions: invoice.permissions.filter((key) => key !== permission),
        }).proposeClientInvoice,
      ).toBeUndefined();
    const settings = {
      ...base,
      roleName: "Custom budget administrator",
      permissions: ["use:ai_chat", "view:settings", "manage:budget_settings"] as const,
    };
    expect(buildAiTools(settings).proposeBudgetSettings).toBeDefined();
    expect(
      buildAiTools({ ...settings, dataScope: "ASSIGNED" }).proposeBudgetSettings,
    ).toBeDefined();
    expect(buildAiTools({ ...settings, dataScope: "NONE" }).proposeBudgetSettings).toBeDefined();
    for (const permission of settings.permissions)
      expect(
        buildAiTools({
          ...settings,
          permissions: settings.permissions.filter((key) => key !== permission),
        }).proposeBudgetSettings,
      ).toBeUndefined();
    expect(buildAiTools(aiToolContextForRole("PURCHASING")).proposeBudgetSettings).toBeUndefined();
    expect(
      aiCapabilityReport(base).manual.some(
        (item) => item.label.includes("default budget") || item.label === "Perbarui sumber RAB",
      ),
    ).toBe(false);
  });
  test("vendor drafting follows create rights and actual project scope independently of role name", () => {
    const custom = {
      ...aiToolContextForRole("OWNER"),
      roleName: "Custom invoice author",
      dataScope: "ASSIGNED" as const,
      permissions: ["use:ai_chat", "create:vendor_bill"] as const,
    };
    expect(buildAiTools(custom).proposeVendorBill).toBeDefined();
    expect(buildAiTools({ ...custom, dataScope: "NONE" }).proposeVendorBill).toBeUndefined();
    expect(
      buildAiTools({ ...custom, permissions: ["use:ai_chat"] }).proposeVendorBill,
    ).toBeUndefined();
    expect(
      aiCapabilityReport(custom).manual.some((a) => a.label === "Buat atau ubah tagihan vendor"),
    ).toBe(false);
  });
  test("warehouse rights require inventory reads and advertise only each live action while NONE stays finance-free", () => {
    const custom = {
      ...aiToolContextForRole("OWNER"),
      roleName: "Custom warehouse maker",
      dataScope: "NONE" as const,
      permissions: [
        "use:ai_chat",
        "view:material",
        "view:inventory",
        "create:stock_count",
      ] as const,
    };
    expect(buildAiTools(custom).proposeWarehouseOperation).toBeDefined();
    expect(buildAiTools(custom).proposeVendorBill).toBeUndefined();
    expect(
      aiCapabilityReport(custom).proposals.find((a) => a.tool === "proposeWarehouseOperation")
        ?.label,
    ).toBe("Simpan dan ajukan hasil stock opname");
    for (const permission of custom.permissions)
      expect(
        buildAiTools({ ...custom, permissions: custom.permissions.filter((p) => p !== permission) })
          .proposeWarehouseOperation,
      ).toBeUndefined();
  });
  test("stock proposals follow exact domain grants and warehouse NONE exception without general project access", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "CUSTOM",
      dataScope: "ASSIGNED" as const,
      permissions: ["use:ai_chat", "view:material", "reserve:stock"] as const,
    };
    expect(buildAiTools(context).proposeProjectStock).toBeDefined();
    for (const permission of context.permissions)
      expect(
        buildAiTools({
          ...context,
          permissions: context.permissions.filter((key) => key !== permission),
        }).proposeProjectStock,
      ).toBeUndefined();
    expect(buildAiTools({ ...context, dataScope: "NONE" }).getProjectStockContext).toBeUndefined();
    const purchasing = aiToolContextForRole("PURCHASING");
    expect(buildAiTools(purchasing).proposeProjectStock).toBeDefined();
    expect(buildAiTools(purchasing).proposeRabWorkflow).toBeUndefined();
    expect(
      aiCapabilityReport(context).proposals.find((row) => row.tool === "proposeProjectStock")
        ?.label,
    ).toBe("Reservasi dan pelepasan kuota stok proyek");
    expect(
      aiCapabilityReport(purchasing).manual.some((row) => row.label === "Reservasi stok"),
    ).toBe(false);
  });

  test("saved RAB workflow advertises only live action rights for custom assigned roles", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "Custom quotation editor",
      dataScope: "ASSIGNED" as const,
      permissions: ["use:ai_chat", "view:rab", "update:rab"] as const,
    };
    expect(buildAiTools(context).proposeRabWorkflow).toBeDefined();
    const label = aiCapabilityReport(context).proposals.find(
      (action) => action.tool === "proposeRabWorkflow",
    )?.label;
    expect(label).toContain("Koreksi");
    expect(label).not.toContain("Persetujuan");
    expect(label).not.toContain("Draft revisi");
    for (const permission of context.permissions) {
      expect(
        buildAiTools({
          ...context,
          permissions: context.permissions.filter((key) => key !== permission),
        }).proposeRabWorkflow,
      ).toBeUndefined();
    }
    expect(buildAiTools({ ...context, dataScope: "NONE" }).getRabWorkflowContext).toBeUndefined();
    const approver = {
      ...context,
      permissions: ["use:ai_chat", "view:rab", "approve:rab"] as const,
    };
    expect(
      aiCapabilityReport(approver).proposals.find((action) => action.tool === "proposeRabWorkflow")
        ?.label,
    ).toContain("Persetujuan");
    expect(
      aiCapabilityReport(context).manual.some((action) => action.label === "Perbarui sumber RAB"),
    ).toBe(false);
  });
  test("RAP follows all dynamic grants and project scope, independently of role label", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "Custom planner",
      dataScope: "ASSIGNED" as const,
      permissions: ["use:ai_chat", "update:rap", "view:budget", "view:material"] as const,
    };
    expect(buildAiTools(context).proposeRapMaterialDraft).toBeDefined();
    for (const permission of context.permissions) {
      expect(
        buildAiTools({
          ...context,
          permissions: context.permissions.filter((key) => key !== permission),
        }).proposeRapMaterialDraft,
      ).toBeUndefined();
    }
    expect(buildAiTools({ ...context, dataScope: "NONE" }).getRapDraftContext).toBeUndefined();
    expect(
      buildAiTools(aiToolContextForRole("PURCHASING")).proposeRapMaterialDraft,
    ).toBeUndefined();
  });
  test("material editing follows actual grants, including Purchasing and a custom NONE role", () => {
    expect(buildAiTools(aiToolContextForRole("PURCHASING")).proposeUpdateMaterial).toBeDefined();
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "CUSTOM",
      dataScope: "NONE" as const,
      permissions: ["use:ai_chat", "manage:material_settings"] as const,
    };
    expect(buildAiTools(context).getEditableMaterials).toBeDefined();
    expect(buildAiTools(context).proposeUpdateMaterial).toBeDefined();
    expect(
      buildAiTools({ ...context, permissions: ["use:ai_chat", "view:material"] })
        .proposeUpdateMaterial,
    ).toBeUndefined();
    expect(
      buildAiTools({ ...context, permissions: ["manage:material_settings"] }).proposeUpdateMaterial,
    ).toBeUndefined();
  });
  test("capability report separates read, proposal and manual workflows even for Owner", () => {
    const owner = aiCapabilityReport(aiToolContextForRole("OWNER"));
    expect(owner.read.every((action) => action.mode === "read")).toBe(true);
    expect(owner.proposals.every((action) => action.mode === "proposal")).toBe(true);
    expect(owner.proposals.some((action) => action.tool === "proposeUpdateMaterial")).toBe(true);
    expect(owner.proposals.some((action) => action.tool === "proposeRapLifecycleActions")).toBe(
      true,
    );
    expect(owner.proposals.some((action) => action.tool === "proposeRapMaterialDraft")).toBe(true);
    const purchasing = aiCapabilityReport(aiToolContextForRole("PURCHASING"));
    expect(purchasing.proposals.some((action) => action.tool === "proposeVendorBillPayment")).toBe(
      false,
    );
    expect(
      purchasing.manual.some((action) => action.label === "Ubah default budget perusahaan"),
    ).toBe(false);
    const denied = aiCapabilityReport({ ...aiToolContextForRole("OWNER"), permissions: [] });
    expect(denied).toMatchObject({
      read: [],
      proposals: [],
      manual: [],
      projectCreation: { available: false },
    });
  });
  test("company policy follows Settings read permission, including custom roles", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "CUSTOM",
      dataScope: "NONE" as const,
      permissions: ["use:ai_chat", "view:settings"] as const,
    };
    expect(buildAiTools(context).getCompanyBudgetDefaults).toBeDefined();
    expect(
      buildAiTools({ ...context, permissions: ["use:ai_chat"] }).getCompanyBudgetDefaults,
    ).toBeUndefined();
  });
  test("Purchasing can prepare material, cannot create users or pay", () => {
    const context = aiToolContextForRole("PURCHASING");
    const tools = buildAiTools(context);
    expect(tools.proposeMaterialMaster).toBeDefined();
    expect(tools.proposeCreateUser).toBeUndefined();
    expect(tools.proposeVendorBillPayment).toBeUndefined();
    expect(tools.listProjects).toBeUndefined();
    expect(
      availableAiCapabilities(context)
        .map((item) => item.tool)
        .sort(),
    ).toEqual(Object.keys(tools).sort());
  });
  test("custom roles follow actual grants, never role names", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      roleName: "CUSTOM",
      permissions: ["use:ai_chat", "manage:material_settings"] as const,
      dataScope: "NONE" as const,
    };
    expect(Object.keys(buildAiTools(context))).toContain("proposeMaterialMaster");
    expect(buildAiTools(context).getBankBalances).toBeUndefined();
    expect(buildAiTools({ ...context, permissions: [] }).proposeMaterialMaster).toBeUndefined();
  });
  test("NONE never queries assigned project access", async () => {
    expect(
      await canAccessProject(
        { ...aiToolContextForRole("OWNER"), dataScope: "NONE" },
        crypto.randomUUID(),
      ),
    ).toBe(false);
  });
  test("every registered action has an explicit permission descriptor", () => {
    const tools = buildAiTools(aiToolContextForRole("OWNER"));
    expect(Object.keys(tools).every((name) => AI_CAPABILITIES[name] !== undefined)).toBe(true);
  });
  test("proposal availability includes final confirmation rights", () => {
    const context = {
      ...aiToolContextForRole("OWNER"),
      permissions: ["use:ai_chat", "create:budget", "update:cost", "reconcile:ledger"] as const,
    };
    const tools = buildAiTools(context);
    expect(tools.proposeCreateProject).toBeUndefined();
    expect(tools.proposeDisburseExpense).toBeUndefined();
    expect(tools.proposeRecordClientPayment).toBeUndefined();
  });
  test("regular project capability reports its missing access instead of an unimplemented workflow", () => {
    const owner = aiToolContextForRole("OWNER");
    expect(aiCapabilityReport(owner).projectCreation).toEqual({ available: true });
    const report = aiCapabilityReport({
      ...owner,
      permissions: ["use:ai_chat", "create:project"],
    });
    expect(report.projectCreation.available).toBe(false);
    expect(report.projectCreation.reason).toContain("izin membuat budget proyek");
    expect(report.projectCreation.reason).not.toContain("izin membuat proyek,");
    expect(report.manual.some((action) => action.label === "Buat proyek")).toBe(false);
  });
});

test("saved RAP changes require every actual permission and project scope", () => {
  const owner = aiToolContextForRole("OWNER");
  expect(buildAiTools(owner).getEditableRapItems).toBeDefined();
  expect(buildAiTools(owner).proposeRapMaterialChanges).toBeDefined();
  for (const permission of ["use:ai_chat", "update:rap", "view:budget", "view:material"]) {
    const restricted = {
      ...owner,
      permissions: owner.permissions.filter((key) => key !== permission),
    };
    expect(buildAiTools(restricted).proposeRapMaterialChanges).toBeUndefined();
  }
  expect(buildAiTools({ ...owner, dataScope: "NONE" }).getEditableRapItems).toBeUndefined();
  expect(
    buildAiTools(aiToolContextForRole("PURCHASING")).proposeRapMaterialChanges,
  ).toBeUndefined();
});

test("package planning follows budget grants and assignment rather than role names", () => {
  const actor = {
    ...aiToolContextForRole("OWNER"),
    roleName: "Custom estimator",
    dataScope: "ASSIGNED" as const,
    permissions: ["use:ai_chat", "update:budget", "view:budget"] as const,
  };
  expect(buildAiTools(actor).getCategoryPlanContext).toBeDefined();
  expect(buildAiTools(actor).proposeCategoryPlanPackages).toBeDefined();
  for (const permission of actor.permissions)
    expect(
      buildAiTools({ ...actor, permissions: actor.permissions.filter((p) => p !== permission) })
        .proposeCategoryPlanPackages,
    ).toBeUndefined();
  expect(buildAiTools({ ...actor, dataScope: "NONE" }).getCategoryPlanContext).toBeUndefined();
  expect(
    buildAiTools(aiToolContextForRole("PURCHASING")).proposeCategoryPlanPackages,
  ).toBeUndefined();
});

test("RAP readiness uses read grants and exact action authorities", () => {
  const source = {
    ...aiToolContextForRole("OWNER"),
    roleName: "Custom reviewer",
    dataScope: "ASSIGNED" as const,
    permissions: ["use:ai_chat", "view:rap", "view:budget"] as const,
  };
  expect(buildAiTools(source).getRapSetupContext).toBeDefined();
  expect(buildAiTools(source).proposeRapSetupActions).toBeUndefined();
  expect(
    buildAiTools({ ...source, permissions: [...source.permissions, "lock:rap"] })
      .proposeRapSetupActions,
  ).toBeDefined();
  expect(
    buildAiTools({ ...source, permissions: [...source.permissions, "update:budget"] })
      .proposeRapSetupActions,
  ).toBeDefined();
  expect(buildAiTools({ ...source, dataScope: "NONE" }).getRapSetupContext).toBeUndefined();
});

test("remaining RAP workflow follows actual grants and project scope", () => {
  const source = aiToolContextForRole("OWNER");
  expect(buildAiTools({ ...source, dataScope: "NONE" }).proposeRapLifecycleActions).toBeUndefined();
  expect(
    buildAiTools({ ...source, permissions: ["use:ai_chat", "view:rap", "view:budget"] })
      .proposeRapLifecycleActions,
  ).toBeUndefined();
  expect(
    buildAiTools({
      ...source,
      permissions: ["use:ai_chat", "view:rap", "view:budget", "update:budget"],
    }).proposeRapLifecycleActions,
  ).toBeDefined();
  expect(
    aiCapabilityReport(source).manual.some((action) => action.label.includes("revisi RAP")),
  ).toBe(false);
});

test("RAB draft follows every dynamic grant and project scope independently of role name", () => {
  const source = aiToolContextForRole("OWNER", {
    roleName: "Custom estimator",
    dataScope: "ASSIGNED",
    permissions: ["use:ai_chat", "view:rap", "view:rab", "create:rab"],
  });
  expect(buildAiTools(source).proposeRabDraft).toBeDefined();
  expect(buildAiTools(source).getRabDraftContext).toBeDefined();
  for (const grant of source.permissions) {
    const denied = {
      ...source,
      permissions: source.permissions.filter((permission) => permission !== grant),
    };
    expect(buildAiTools(denied).proposeRabDraft).toBeUndefined();
  }
  expect(buildAiTools({ ...source, dataScope: "NONE" }).proposeRabDraft).toBeUndefined();
  expect(buildAiTools(aiToolContextForRole("PURCHASING")).proposeRabDraft).toBeUndefined();
  expect(
    aiCapabilityReport(source).proposals.some((action) => action.tool === "proposeRabDraft"),
  ).toBe(true);
});

test("receipt-only warehouse and waste-only project capabilities use live domain grants and assignment scope", () => {
  const context = {
    ...aiToolContextForRole("OWNER"),
    permissions: [
      "use:ai_chat",
      "view:material",
      "view:inventory",
      "request:goods_receipt_reversal",
    ] as const,
  };
  expect(buildAiTools(context).proposeWarehouseOperation).toBeDefined();
  expect(
    aiCapabilityReport(context).proposals.find((a) => a.tool === "proposeWarehouseOperation")
      ?.label,
  ).toContain("Ajukan pembatalan");
  const waste = {
    ...context,
    permissions: ["use:ai_chat", "view:material", "waste:stock"] as const,
  };
  expect(buildAiTools(waste).proposeProjectStock).toBeDefined();
  expect(buildAiTools({ ...waste, dataScope: "NONE" }).proposeProjectStock).toBeUndefined();
});
