import { test, expect } from "bun:test";
import { financeInputProposalSchema } from "@atria/core/ai/finance-input";
import { readAnyProposal } from "./proposal-reader";
import { proposalReviewFlow } from "./proposal-review-flow";
const id = "00000000-0000-4000-8000-000000000001";
const proposal = financeInputProposalSchema.parse({
  kind: "FINANCE_INPUT",
  input: {
    action: "CREATE_INVOICE",
    projectId: id,
    invoiceNumber: "QA-01",
    amount: 20000000,
    stage: "DP",
    dueDate: "2026-10-30",
  },
  projectId: id,
  entityName: "Proyek QA",
  title: "Invoice klien",
  expectedContext: "a".repeat(64),
  effect: "Belum dibayar",
  summary: [{ label: "Tagihan baru", value: 20000000, money: true }],
  rows: [
    {
      id: "invoice-new",
      title: "QA-01",
      facts: [
        { label: "Nominal", value: 20000000, money: true },
        { label: "Jatuh tempo", value: "30 Oktober 2026" },
      ],
    },
  ],
  changes: [],
});
test("invoice renders only a validated proposal and exposes its full small decision inline", () => {
  expect(readAnyProposal({ proposal })?.kind).toBe("FINANCE_INPUT");
  expect(proposalReviewFlow(proposal)).toEqual({ review: "inline", confirmation: "direct" });
  expect(
    readAnyProposal({ proposal: { ...proposal, input: { ...proposal.input, amount: -1 } } }),
  ).toBeNull();
  expect(readAnyProposal({ proposal: { kind: "FINANCE_INPUT" } })).toBeNull();
});
test("termin lists use dedicated review and global defaults retain a protected decision", () => {
  const schedule = financeInputProposalSchema.parse({
    ...proposal,
    input: {
      action: "CREATE_SCHEDULE",
      projectId: id,
      firstDueDate: "2026-10-30",
      installments: [
        { label: "DP", percentage: 0.3 },
        { label: "Pelunasan", percentage: 0.7 },
      ],
    },
  });
  expect(proposalReviewFlow(schedule)).toEqual({ review: "sheet", confirmation: "direct" });
  const defaults = financeInputProposalSchema.parse({
    ...proposal,
    projectId: null,
    input: {
      action: "BUDGET_DEFAULTS",
      payload: {
        budgetAllocationSettingId: id,
        name: "Default QA",
        budgetCapRatio: 0.85,
        notes: null,
        categories: [
          { budgetAllocationSettingCategoryId: id, ratioPercentage: 1, isEnabled: true },
        ],
      },
    },
    rows: [],
    changes: [
      { label: "Plafon", before: "90%", after: "85%" },
      { label: "Target margin", before: "10%", after: "15%" },
    ],
  });
  expect(proposalReviewFlow(defaults)).toEqual({ review: "inline", confirmation: "dialog" });
  expect(
    proposalReviewFlow({ ...defaults, changes: [...defaults.changes, ...defaults.changes] }),
  ).toEqual({ review: "sheet", confirmation: "dialog" });
});
