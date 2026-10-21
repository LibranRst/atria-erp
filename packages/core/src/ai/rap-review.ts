import { calculateRapMaterialCost, sumRapAmounts } from "../project/rap-cost";
import {
  type RapDraftFields,
  type RapDraftProposal,
  type RapDraftRow,
  type RapDraftRowPatch,
  rapDraftRowPatchSchema,
} from "./rap-draft";

export function rapEditableFields(row: RapDraftRow): RapDraftFields {
  return {
    area: row.area,
    requiredQuantity: row.requiredQuantity,
    bufferQuantity: row.bufferQuantity,
    estimatedUnitCost: row.estimatedUnitCost,
  };
}

/** Only input fields change; identities, budget usage and reference context remain server proof. */
export function applyRapDraftPatches(
  proposal: RapDraftProposal,
  patches: readonly RapDraftRowPatch[],
): RapDraftProposal {
  const changes = new Map<string, RapDraftFields>();
  for (const patch of patches) {
    const parsed = rapDraftRowPatchSchema.parse(patch);
    if (changes.has(parsed.rowId) || !proposal.rows.some((row) => row.rowId === parsed.rowId))
      throw new Error("Baris koreksi tidak valid atau berulang.");
    changes.set(parsed.rowId, parsed.fields);
  }
  const identities = new Set<string>();
  const rows = proposal.rows.map((row): RapDraftRow => {
    const fields = changes.get(row.rowId) ?? rapEditableFields(row);
    const identity = `${row.materialId}:${fields.area.trim().toLocaleLowerCase("id-ID")}`;
    if (identities.has(identity))
      throw new Error(
        "Material berulang pada area yang sama. Bedakan area sebelum menerapkan koreksi.",
      );
    identities.add(identity);
    const calculated = calculateRapMaterialCost(fields);
    const changedPrice = fields.estimatedUnitCost !== row.estimatedUnitCost;
    return {
      ...row,
      ...fields,
      totalQuantity: Number(calculated.totalQuantity),
      estimatedTotalCost: Number(calculated.estimatedTotalCost),
      priceSource: changedPrice ? "USER" : row.priceSource,
      priceSourceLabel: changedPrice ? "Estimasi dari pengguna" : row.priceSourceLabel,
    };
  });
  const addition = sumRapAmounts(rows.map((row) => row.estimatedTotalCost.toFixed(2)));
  const afterPlan = sumRapAmounts([proposal.budget.existingPlan.toFixed(2), addition.toFixed(2)]);
  const stock = proposal.stock.map((item) => {
    const matches = (row: RapDraftRow): boolean =>
      item.materialId
        ? row.materialId === item.materialId
        : row.materialName === item.materialName && row.unit === item.unit;
    const previous = sumRapAmounts(
      proposal.rows.filter(matches).map((row) => row.totalQuantity.toFixed(2)),
    );
    const next = sumRapAmounts(rows.filter(matches).map((row) => row.totalQuantity.toFixed(2)));
    const planQuantity = sumRapAmounts([
      item.planQuantity.toFixed(2),
      (-previous).toFixed(2),
      next.toFixed(2),
    ]);
    return {
      ...item,
      planQuantity,
      shortage: Math.max(0, Number((planQuantity - item.available).toFixed(2))),
    };
  });
  return {
    ...proposal,
    rows,
    stock,
    budget: {
      ...proposal.budget,
      addition,
      afterPlan,
      overAllocation: Math.max(0, Number((afterPlan - proposal.budget.allocated).toFixed(2))),
    },
  };
}
