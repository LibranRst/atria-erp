"use server";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  project,
  projectBudgets,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
} from "@/db/schema";
import { getNextRabRevision } from "@/lib/project/rab-selection";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  generateRabFromRapSchema,
  generateRabFromSelectedSourcesSchema,
  type GenerateRabFromRapInput,
  type GenerateRabFromSelectedSourcesInput,
} from "@/lib/validations/rap-rab";
import {
  assertProjectMutationAccess,
  buildRabCategoryPlanItemValues,
  buildRabMaterialItemValues,
  getSessionUser,
  toError,
} from "./rap-rab-utils";

export async function generateRabFromRap(
  input: GenerateRabFromRapInput
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = generateRabFromRapSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Data generate RAB tidak valid." } };
  }

  const user = await getSessionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const result = await db.transaction(async (tx) => {
      const rap = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, validation.data.projectRapId),
        with: {
          project: true,
          items: true,
          rabEstimates: true,
        },
      });
      if (!rap) throw new Error("RAP_NOT_FOUND");
      if (rap.items.length === 0) throw new Error("RAP_EMPTY");
      if (rap.status !== "LOCKED") throw new Error("RAP harus difinalisasi sebelum menjadi source RAB.");
      await assertProjectMutationAccess(user, rap.projectId, "create:rab");

      const openEstimate = rap.rabEstimates.find((estimate) => estimate.status === "DRAFT");
      if (openEstimate) throw new Error("RAB_DRAFT_EXISTS");
      const currentApproved = await tx.query.rabEstimate.findFirst({
        where: and(eq(rabEstimate.projectId, rap.projectId), eq(rabEstimate.status, "APPROVED")),
      });

      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, rap.projectId),
      });
      const targetGrossPercentage = budget ? Number(budget.targetGrossPercentage) : 10;
      const lastEstimate = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.projectId, rap.projectId),
        orderBy: [desc(rabEstimate.revision)],
      });
      const revision = (lastEstimate?.revision ?? 0) + 1;

      const [estimate] = await tx.insert(rabEstimate).values({
        projectId: rap.projectId,
        sourceProjectRapId: rap.id,
        supersedesRabEstimateId: currentApproved?.id ?? null,
        status: "DRAFT",
        revision,
        title: validation.data.title ?? `Client Estimate - ${rap.project.name}`,
        clientNotes: validation.data.clientNotes ?? "Draft estimasi client berdasarkan material plan internal. Silakan review sebelum dikirim.",
      }).returning();

      await tx.insert(rabEstimateItem).values(
        rap.items.map((item, index) =>
          buildRabMaterialItemValues({
            rabEstimateId: estimate.id,
            item: { ...item, revision: rap.revision },
            targetGrossPercentage,
            displayOrder: index + 1,
            description: item.description ?? `${item.area} - ${item.name}`,
          }),
        ),
      );

      return estimate;
    });

    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal generate RAB dari RAP.");
  }
}

export async function generateRabFromSelectedSources(
  input: GenerateRabFromSelectedSourcesInput
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = generateRabFromSelectedSourcesSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Data sumber quotation tidak valid." } };
  }

  const user = await getSessionUser();
  if (!user) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const result = await db.transaction(async (tx) => {
      const proj = await tx.query.project.findFirst({
        where: eq(project.id, validation.data.projectId),
        with: {
          rabEstimates: true,
        },
      });
      if (!proj) throw new Error("PROJECT_NOT_FOUND");
      await assertProjectMutationAccess(user, validation.data.projectId, "create:rab");

      const openEstimate = proj.rabEstimates.find((estimate) => estimate.status === "DRAFT");
      if (openEstimate) throw new Error("RAB_DRAFT_EXISTS");
      const currentApproved = proj.rabEstimates.find((estimate) => estimate.status === "APPROVED") ?? null;

      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, validation.data.projectId),
      });
      const targetGrossPercentage = budget ? Number(budget.targetGrossPercentage) : 10;
      const revision = getNextRabRevision(proj.rabEstimates);

      const uniqueRapItemIds = Array.from(new Set(validation.data.projectRapItemIds));
      const uniquePlanItemIds = Array.from(new Set(validation.data.projectCategoryPlanItemIds));
      const rapItems = uniqueRapItemIds.length > 0
        ? await tx.query.projectRapItem.findMany({
          where: inArray(projectRapItem.id, uniqueRapItemIds),
          with: {
            rap: true,
          },
        })
        : [];
      const categoryPlanItems = uniquePlanItemIds.length > 0
        ? await tx.query.projectCategoryPlanItem.findMany({
          where: inArray(projectCategoryPlanItem.id, uniquePlanItemIds),
          with: {
            expenseCategory: true,
          },
        })
        : [];

      if (rapItems.length !== uniqueRapItemIds.length) throw new Error("RAP_ITEM_NOT_FOUND");
      if (categoryPlanItems.length !== uniquePlanItemIds.length) throw new Error("CATEGORY_PLAN_ITEM_NOT_FOUND");

      for (const item of rapItems) {
        if (item.rap.projectId !== validation.data.projectId) throw new Error("RAP_ITEM_PROJECT_MISMATCH");
        if (item.rap.status !== "LOCKED") throw new Error("Material RAP harus difinalisasi sebelum menjadi source RAB.");
      }
      for (const item of categoryPlanItems) {
        if (item.projectId !== validation.data.projectId) throw new Error("CATEGORY_PLAN_ITEM_PROJECT_MISMATCH");
        if (item.expenseCategory.code !== "TUKANG" && item.expenseCategory.code !== "SUBCON") {
          throw new Error("CATEGORY_PLAN_ONLY_ALLOWED_FOR_TUKANG_OR_SUBCON");
        }
        if (item.status !== "ACTIVE" && item.status !== "LOCKED") {
          throw new Error("Package Tukang/Subcon harus ACTIVE sebelum dipakai sebagai source RAB.");
        }
      }

      const firstRap = rapItems[0]?.rap ?? null;
      const [estimate] = await tx.insert(rabEstimate).values({
        projectId: validation.data.projectId,
        sourceProjectRapId: firstRap?.id ?? null,
        supersedesRabEstimateId: currentApproved?.id ?? null,
        status: "DRAFT",
        revision,
        title: validation.data.title ?? `Client Estimate / Quotation - ${proj.name}`,
        clientNotes: validation.data.clientNotes ?? "Draft quotation client. Review label, harga, dan item sebelum dikirim.",
      }).returning();

      const generatedSourceItems = [
        ...rapItems.map((item, index) =>
          buildRabMaterialItemValues({
            rabEstimateId: estimate.id,
            item: { ...item, revision: item.rap.revision },
            targetGrossPercentage,
            displayOrder: index + 1,
          }),
        ),
        ...categoryPlanItems.map((item, index) =>
          buildRabCategoryPlanItemValues({
            rabEstimateId: estimate.id,
            item,
            targetGrossPercentage,
            displayOrder: rapItems.length + index + 1,
          }),
        ),
      ];

      const baselineItems = currentApproved
        ? await tx.query.rabEstimateItem.findMany({
          where: eq(rabEstimateItem.rabEstimateId, currentApproved.id),
          orderBy: (table, { asc }) => [asc(table.displayOrder)],
        })
        : [];
      const baselineBundles = currentApproved
        ? await tx.query.rabEstimateBundle.findMany({
          where: eq(rabEstimateBundle.rabEstimateId, currentApproved.id),
          with: { items: true },
          orderBy: (table, { asc }) => [asc(table.displayOrder)],
        })
        : [];

      const mergedSourceItems = generatedSourceItems.map((generatedItem) => {
        const baselineItem = baselineItems.find((candidate) => {
          if (candidate.sourceType !== generatedItem.sourceType) return false;
          if (generatedItem.sourceLibraryItemId && candidate.sourceLibraryItemId === generatedItem.sourceLibraryItemId) return true;
          if (generatedItem.sourceProjectCategoryPlanItemId && candidate.sourceProjectCategoryPlanItemId === generatedItem.sourceProjectCategoryPlanItemId) return true;
          return candidate.clientLabel === generatedItem.clientLabel;
        });
        if (!baselineItem) return generatedItem;
        return {
          ...generatedItem,
          clientLabel: baselineItem.clientLabel,
          description: baselineItem.description,
          quantity: baselineItem.quantity,
          unit: baselineItem.unit,
          unitPrice: baselineItem.unitPrice,
          lineTotal: baselineItem.lineTotal,
          displayOrder: baselineItem.displayOrder,
          isHidden: baselineItem.isHidden,
          isBundle: baselineItem.isBundle,
        };
      });

      const baselineManualItems = baselineItems
        .filter((item) => item.sourceType === "MANUAL")
        .map((item) => ({
          rabEstimateId: estimate.id,
          sourceType: "MANUAL",
          sourceProjectRapItemId: null,
          sourceProjectCategoryPlanItemId: null,
          sourceLibraryItemId: item.sourceLibraryItemId,
          sourceRevision: item.sourceRevision,
          sourceUpdatedAt: item.sourceUpdatedAt,
          clientLabel: item.clientLabel,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          displayOrder: item.displayOrder,
          isHidden: item.isHidden,
          isBundle: item.isBundle,
        }));

      const baselineManualLabels = new Set(baselineManualItems.map((item) => item.clientLabel.trim().toLowerCase()));
      const newManualItems = validation.data.manualLines
        .filter((item) => !baselineManualLabels.has(item.clientLabel.trim().toLowerCase()))
        .map((item, index) => ({
          rabEstimateId: estimate.id,
          sourceType: "MANUAL",
          sourceProjectRapItemId: null,
          sourceProjectCategoryPlanItemId: null,
          sourceLibraryItemId: null,
          sourceRevision: null,
          sourceUpdatedAt: null,
          clientLabel: item.clientLabel,
          description: item.description ?? null,
          quantity: item.quantity.toFixed(2),
          unit: item.unit,
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: (item.quantity * item.unitPrice).toFixed(2),
          displayOrder: mergedSourceItems.length + baselineManualItems.length + index + 1,
          isHidden: item.isHidden ?? false,
          isBundle: item.isBundle ?? false,
        }));

      const generatedItems = [
        ...mergedSourceItems,
        ...baselineManualItems,
        ...newManualItems,
      ];

      const insertedItems = await tx.insert(rabEstimateItem).values(generatedItems).returning();
      for (const baselineBundle of baselineBundles) {
        const [bundle] = await tx.insert(rabEstimateBundle).values({
          rabEstimateId: estimate.id,
          clientLabel: baselineBundle.clientLabel,
          description: baselineBundle.description,
          quantity: baselineBundle.quantity,
          unit: baselineBundle.unit,
          unitPrice: baselineBundle.unitPrice,
          lineTotal: baselineBundle.lineTotal,
          displayOrder: baselineBundle.displayOrder,
          isHidden: baselineBundle.isHidden,
        }).returning();
        for (const oldMember of baselineBundle.items) {
          const member = insertedItems.find((candidate) => {
            if (oldMember.sourceProjectRapItemId && candidate.sourceProjectRapItemId === oldMember.sourceProjectRapItemId) return true;
            if (oldMember.sourceProjectCategoryPlanItemId && candidate.sourceProjectCategoryPlanItemId === oldMember.sourceProjectCategoryPlanItemId) return true;
            return oldMember.sourceType === "MANUAL" && candidate.sourceType === "MANUAL" && candidate.clientLabel === oldMember.clientLabel;
          });
          if (member) await tx.update(rabEstimateItem).set({ bundleId: bundle.id, isBundle: true }).where(eq(rabEstimateItem.id, member.id));
        }
      }

      return estimate;
    });

    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal generate quotation dari sumber terpilih.");
  }
}
