import { expect, test } from "bun:test";
import {
  applyRabReview,
  rabDraftInputSchema,
  rabDraftProposalSchema,
  rabDraftSaveSchema,
  rabLineTotal,
  rabReviewTotal,
  type RabDraftPayload,
} from "./rab-draft";
const id = "10000000-0000-4000-8000-000000000001",
  id2 = "10000000-0000-4000-8000-000000000002";
const proposal = rabDraftProposalSchema.parse({
  kind: "RAB_DRAFT",
  projectId: id,
  projectName: "Proyek uji",
  revision: 1,
  supersedesId: null,
  title: "RAB uji",
  clientNotes: "",
  expectedContext: "a".repeat(64),
  rows: [
    {
      rowId: id,
      sourceId: id,
      sourceKind: "MATERIAL",
      sourceName: "Panel",
      sourceRevision: 1,
      clientLabel: "Panel klien",
      description: "",
      quantity: 2.5,
      unit: "lembar",
      unitPrice: 1000.25,
      selected: true,
    },
    {
      rowId: id2,
      sourceId: id2,
      sourceKind: "TUKANG",
      sourceName: "Pemasangan",
      sourceRevision: 1,
      clientLabel: "Pemasangan",
      description: "",
      quantity: 1,
      unit: "paket",
      unitPrice: 50000,
      selected: true,
    },
  ],
});
function payload(): RabDraftPayload {
  return {
    conversationId: id,
    toolCallId: "fixture",
    title: proposal.title,
    clientNotes: "",
    rows: proposal.rows.map((r) => ({
      rowId: r.rowId,
      selected: r.selected,
      clientLabel: r.clientLabel,
      description: r.description,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
    })),
  };
}
test("RAB review rounds fractional line values once and totals only selected rows", () => {
  expect(rabLineTotal(proposal.rows[0])).toBe(2500.63);
  expect(rabReviewTotal(proposal.rows)).toBe(52500.63);
  const changed = payload();
  changed.rows[1].selected = false;
  expect(rabReviewTotal(applyRabReview(proposal, changed).rows)).toBe(2500.63);
  expect(proposal.rows[1].selected).toBe(true);
});
test("RAB corrections cannot introduce foreign or duplicate source rows or business fields", () => {
  const changed = payload();
  changed.rows[1].rowId = id;
  expect(() => applyRabReview(proposal, changed)).toThrow();
  const foreign = payload();
  foreign.rows[0].rowId = "10000000-0000-4000-8000-000000000003";
  expect(() => applyRabReview(proposal, foreign)).toThrow();
  expect(
    rabDraftSaveSchema.safeParse({
      conversationId: id,
      toolCallId: "fixture",
      expectedRevision: 1,
      rows: proposal.rows,
    }).success,
  ).toBe(false);
});
test("RAB source requests reject duplicates, over100, bad precision and private fields", () => {
  const row = { sourceId: id, sourceKind: "MATERIAL", quantity: 1, unitPrice: 10 };
  expect(rabDraftInputSchema.safeParse({ projectId: id, rows: [row, row] }).success).toBe(false);
  expect(
    rabDraftInputSchema.safeParse({ projectId: id, rows: [{ ...row, unitPrice: 1.234 }] }).success,
  ).toBe(false);
  expect(
    rabDraftInputSchema.safeParse({ projectId: id, rows: [{ ...row, internalCost: 10 }] }).success,
  ).toBe(false);
  expect(
    rabDraftInputSchema.safeParse({ projectId: id, rows: Array.from({ length: 101 }, () => row) })
      .success,
  ).toBe(false);
});
