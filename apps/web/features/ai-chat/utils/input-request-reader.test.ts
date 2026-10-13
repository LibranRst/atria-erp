import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { readActiveInputRequest } from "./input-request-reader";
import { buildSubmissionMessage } from "./input-request-fields";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
const payload = requestUserInputSchema.parse({
  actionTitle: "Buat Proyek",
  fields: [{ key: "name", label: "Nama", type: "text" }],
});
const request: UIMessage = {
  id: "request",
  role: "assistant",
  parts: [
    {
      type: "tool-requestUserInput",
      toolCallId: "r-1",
      state: "output-available",
      input: payload,
      output: payload,
    },
  ],
};
const answer: UIMessage = {
  id: "answer",
  role: "assistant",
  parts: [{ type: "text", text: "Target margin dari pengaturan adalah 10%." }],
};
test("an unanswered wizard survives normal messages and assistant replies", () => {
  const chat: UIMessage = {
    id: "chat",
    role: "user",
    parts: [{ type: "text", text: "Apa target margin perusahaan?" }],
  };
  expect(readActiveInputRequest([request, chat, answer], new Set())?.toolCallId).toBe("r-1");
});
test("formatted submission and cancellation prevent resurrection after reload", () => {
  const submitted: UIMessage = {
    id: "submitted",
    role: "user",
    parts: [{ type: "text", text: buildSubmissionMessage(payload, { name: "Proyek A" }) }],
  };
  const cancelled: UIMessage = {
    id: "cancel",
    role: "user",
    parts: [{ type: "text", text: "Saya batalkan pengisian data untuk Buat Proyek." }],
  };
  expect(readActiveInputRequest([request, submitted, answer], new Set())).toBeNull();
  expect(readActiveInputRequest([request, cancelled, answer], new Set())).toBeNull();
});
test("a newer request replaces the older one without reviving it when dismissed", () => {
  const newer: UIMessage = {
    ...request,
    id: "newer",
    parts: [
      {
        type: "tool-requestUserInput",
        toolCallId: "r-2",
        state: "output-available",
        input: payload,
        output: payload,
      },
    ],
  };
  expect(readActiveInputRequest([request, newer], new Set())?.toolCallId).toBe("r-2");
  expect(readActiveInputRequest([request, newer], new Set(["r-2"]))).toBeNull();
});
