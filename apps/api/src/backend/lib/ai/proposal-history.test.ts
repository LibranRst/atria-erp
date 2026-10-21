import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { markUnconfirmedProposal } from "./proposal-history";

test("unconfirmed proposal keeps immutable snapshots and explicitly denies a save receipt", (): void => {
  const part: UIMessage["parts"][number] = {
    type: "dynamic-tool",
    toolName: "proposeOwnProfile",
    toolCallId: "qa",
    state: "output-available",
    input: {},
    output: {
      proposal: { before: { name: "Actual" }, after: { name: "Proposed" } },
      instruction: "Preview",
    },
  };
  const original = JSON.stringify(part);
  const result = markUnconfirmedProposal(part);
  expect(JSON.stringify(result)).toContain("BELUM DIKONFIRMASI");
  expect(JSON.stringify(result)).toContain('"isConfirmedByUser":false');
  expect(JSON.stringify(result)).toContain('"after":{"name":"Proposed"}');
  expect(JSON.stringify(part)).toBe(original);
  const text: UIMessage["parts"][number] = { type: "text", text: "Jawaban" };
  expect(markUnconfirmedProposal(text)).toBe(text);
});
