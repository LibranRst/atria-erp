import { expect, mock, test } from "bun:test";
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
    back: () => undefined,
  }),
}));
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CreateProjectProposalCard,
  type CreateProjectProposalData,
} from "./proposal-cards/create-project-proposal-card";
import { readAnyProposal } from "../utils/proposal-reader";
import { normalizeInputRequestPayload } from "@atria/core/ai/input-request-flow";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
import { buildSubmissionMessage } from "../utils/input-request-fields";

const proposal: CreateProjectProposalData = {
  kind: "CREATE_PROJECT",
  name: "Uji proyek",
  clientId: "client",
  clientName: "Klien",
  projectManagerId: "pm",
  projectManagerName: "PM",
  totalContractValue: { amount: 100_000_000, formatted: "Rp 100.000.000" },
  startDate: null,
  endDate: null,
  location: "Jakarta",
  notes: "",
  budgetDefaults: {
    settingId: "active",
    settingName: "Budget aktif",
    budgetCapRatio: 0.92,
    categories: [
      {
        expenseCategoryId: "material",
        code: "MATERIAL",
        name: "Material",
        ratioPercentage: 0.43,
        sortOrder: 1,
      },
    ],
  },
};
test("new project review shows actual Settings cap and target margin before confirmation", () => {
  const html = renderToStaticMarkup(
    <CreateProjectProposalCard
      proposal={proposal}
      toolCallId="test"
      conversationId={null}
      alreadyConfirmed={false}
    />,
  );
  expect(html).toContain("Budget awal · Pengaturan ERP");
  expect(html).toContain("92% nilai kontrak");
  expect(html).toContain("8%");
  expect(html).toContain("Rp 92.000.000");
  expect(html).toContain("Alokasi per kategori");
});
test("malformed model preview cannot provide trusted budget numbers while legacy proposals remain supported", () => {
  const parsed = readAnyProposal({
    proposal: { ...proposal, budgetDefaults: { ...proposal.budgetDefaults, budgetCapRatio: 10 } },
  });
  expect(parsed?.kind).toBe("CREATE_PROJECT");
  if (parsed?.kind !== "CREATE_PROJECT") throw new Error("Missing project proposal");
  expect(parsed.budgetDefaults).toBeUndefined();
});
test("stale cap values retained in local progress never become a project submission", () => {
  const payload = normalizeInputRequestPayload(
    requestUserInputSchema.parse({
      workflow: "CREATE_PROJECT",
      actionTitle: "Buat proyek",
      fields: [
        { key: "projectName", label: "Nama proyek", type: "text" },
        { key: "budgetCapRatio", label: "Plafon RAP", type: "number", defaultValue: "0.85" },
      ],
    }),
  );
  const submission = buildSubmissionMessage(payload, {
    projectName: "Proyek",
    budgetCapRatio: "0.85",
  });
  expect(submission).toContain("Nama proyek: Proyek");
  expect(submission).not.toContain("Plafon");
  expect(submission).not.toContain("0.85");
});
