import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
import { deriveToolActivity, activityToolState } from "./tool-activity";
import { activitySummary } from "./activity-summary";
import { readActiveInputRequest } from "./input-request-reader";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
type Part = UIMessage["parts"][number];
const message = (parts: Part[]): UIMessage => ({ id: "assistant", role: "assistant", parts });
const fail = (name: string, input: unknown, errorText = "Layanan sementara gagal."): Part => ({
  type: `tool-${name}`,
  toolCallId: "failed",
  state: "output-error",
  input,
  errorText,
});
const done = (name: string, input: unknown, output: unknown): Part => ({
  type: `tool-${name}`,
  toolCallId: "done",
  state: "output-available",
  input,
  output,
});
const payload = requestUserInputSchema.parse({
  actionTitle: "Pilih proyek",
  fields: [
    {
      key: "projectId",
      label: "Proyek",
      type: "select",
      options: [
        { value: a, label: "Proyek A" },
        { value: b, label: "Proyek B" },
      ],
    },
  ],
});
const request: Part = {
  type: "tool-requestUserInput",
  toolCallId: "choose",
  state: "output-available",
  input: payload,
  output: payload,
};
const legacy: Part = {
  type: "tool-listProjects",
  toolCallId: "legacy",
  state: "output-error",
  input: undefined,
  rawInput: { query: "X" },
  errorText: "Maaf, asisten sedang tidak bisa menjawab. Coba lagi sebentar lagi.",
};
const list = done(
  "listProjects",
  { limit: 10 },
  {
    projects: [
      { projectId: a, name: "Proyek A" },
      { projectId: b, name: "Proyek B" },
    ],
  },
);
test("an exact read retry is recovered, retains counts, and never counts failed attempts as sources", () => {
  const traces = deriveToolActivity(
    message([
      fail("getProjectBudget", { projectId: a }),
      done("getProjectBudget", { projectId: a }, { budget: {} }),
    ]),
    false,
  );
  expect(traces.map((r) => r.state)).toEqual(["recovered", "done"]);
  expect(activitySummary(traces, false)).toEqual({
    state: "done",
    label: "1 sumber diperiksa · 1 percobaan dipulihkan",
    detail: "",
  });
});
test("different tools, targets, filters/pages, missing result and error results cannot prove recovery", () => {
  for (const success of [
    done("getProjectHealth", { projectId: a }, {}),
    done("getProjectBudget", { projectId: b }, {}),
    done("getProjectBudget", { projectId: a, offset: 20 }, {}),
    done("getProjectBudget", { projectId: a }, undefined),
    done("getProjectBudget", { projectId: a }, { error: "Tidak tersedia" }),
    done("getProjectBudget", { projectId: a }, { success: false, error: { code: "FORBIDDEN" } }),
  ]) {
    expect(
      deriveToolActivity(message([fail("getProjectBudget", { projectId: a }), success]), false)[0]
        .state,
    ).toBe("failed");
  }
});
test("permission failures and proposals stay failed even after a same-input success", () => {
  for (const error of ["FORBIDDEN", "Anda tidak memiliki akses ke proyek ini.", "Izin diperlukan"])
    expect(
      deriveToolActivity(
        message([
          fail("getProjectBudget", { projectId: a }, error),
          done("getProjectBudget", { projectId: a }, {}),
        ]),
        false,
      )[0].state,
    ).toBe("failed");
  expect(
    deriveToolActivity(
      message([
        fail("proposeProjectManagement", { projectId: a }),
        done("proposeProjectManagement", { projectId: a }, { proposal: {} }),
      ]),
      false,
    )[0].state,
  ).toBe("failed");
});
test("a tool error envelope is a blocking failure, with safe details and no raw error exposure", () => {
  const part = done(
    "getProjectBudget",
    { projectId: a },
    { error: "FORBIDDEN: private-fixture-secret" },
  );
  expect(activityToolState(part, false)).toBe("failed");
  const traces = deriveToolActivity(message([part]), false);
  expect(traces[0].detail).toContain("Akses data ditolak");
  expect(JSON.stringify(traces)).not.toContain("private-fixture-secret");
});
test("legacy short-query validation recovers only from a verified project-choice handoff", () => {
  const msg = message([
    legacy,
    done("listProjects", { query: "proyek X", limit: 10 }, { projects: [] }),
    list,
    request,
  ]);
  const pending = readActiveInputRequest([msg], new Set());
  const traces = deriveToolActivity(msg, false, pending);
  expect(traces[0].state).toBe("recovered");
  expect(traces[0].label).toBe("Pencarian awal diulang");
  expect(activitySummary(traces, false).label).toBe("Pilih proyek untuk melanjutkan");
  expect(activitySummary(traces, false).detail).toContain("1 percobaan dipulihkan");
  expect(deriveToolActivity(message([legacy, list]), false)[0].state).toBe("failed");
  const alien = {
    ...payload,
    fields: [
      { ...payload.fields[0], options: [{ value: "foreign", label: "Tidak berasal dari daftar" }] },
    ],
  };
  expect(
    deriveToolActivity(message([legacy, list, done("requestUserInput", alien, alien)]), false)[0]
      .state,
  ).toBe("failed");
  expect(
    deriveToolActivity(
      message([
        legacy,
        done(
          "listProjects",
          { limit: 10, status: "ACTIVE" },
          {
            projects: [
              { projectId: a, name: "Proyek A" },
              { projectId: b, name: "Proyek B" },
            ],
          },
        ),
        request,
      ]),
      false,
    )[0].state,
  ).toBe("failed");
});
test("submitted/cancelled/dismissed requests stop waiting while historical recovery remains true", () => {
  const msg = message([legacy, list, request]);
  for (const text of [
    "Berikut data untuk Pilih proyek:\nProyek: Proyek A",
    "Saya batalkan pengisian data untuk Pilih proyek.",
  ]) {
    const user: UIMessage = { id: "answer", role: "user", parts: [{ type: "text", text }] };
    const traces = deriveToolActivity(msg, false, readActiveInputRequest([msg, user], new Set()));
    expect(activitySummary(traces, false).state).toBe("done");
    expect(traces[0].state).toBe("recovered");
  }
  expect(
    activitySummary(
      deriveToolActivity(msg, false, readActiveInputRequest([msg], new Set(["choose"]))),
      false,
    ).state,
  ).toBe("done");
});
test("a selected project moves waiting to the remaining form; an invalid local value does not satisfy the choice", () => {
  const msg = message([list, request]);
  const pending = readActiveInputRequest([msg], new Set());
  if (!pending) throw new Error("Missing request");
  expect(
    activitySummary(deriveToolActivity(msg, false, { ...pending, values: { projectId: a } }), false)
      .label,
  ).toBe("Menunggu isian Anda");
  expect(
    activitySummary(
      deriveToolActivity(msg, false, { ...pending, values: { projectId: "foreign" } }),
      false,
    ).label,
  ).toBe("Pilih proyek untuk melanjutkan");
});
test("active generation, unresolved errors and interruption have priority over waiting", () => {
  const msg = message([list, request]);
  const pending = readActiveInputRequest([msg], new Set());
  expect(activitySummary(deriveToolActivity(msg, true, pending), true).state).toBe("running");
  expect(
    activitySummary(
      deriveToolActivity(
        message([list, request, fail("getProjectBudget", { projectId: b })]),
        false,
        pending,
      ),
      false,
    ).state,
  ).toBe("failed");
  const stopped: Part = {
    type: "tool-getProjectBudget",
    toolCallId: "stop",
    state: "input-available",
    input: { projectId: a },
  };
  expect(
    activitySummary(deriveToolActivity(message([list, request, stopped]), false, pending), false)
      .state,
  ).toBe("interrupted");
});

test("an invalid aggregate preview limit recovers only after a complete unfiltered count", () => {
  const invalid: Part = {
    ...legacy,
    rawInput: { limit: 100, _introduction: "Aku akan memeriksa proyek perusahaan." },
  };
  const output = {
    matchedCount: 37,
    hasMore: true,
    projects: [{ projectId: a, name: "Proyek A" }],
  };
  const success = done("listProjects", { limit: 20 }, output);
  const traces = deriveToolActivity(message([invalid, success]), false);
  expect(traces.map((trace) => trace.state)).toEqual(["recovered", "done"]);
  expect(activitySummary(traces, false).state).toBe("done");
  for (const unrelated of [
    done("listProjects", { limit: 20, query: "Proyek A" }, output),
    done("listProjects", { limit: 20, status: "ACTIVE" }, output),
    done("listProjects", { limit: 20 }, { projects: output.projects }),
    done("listProjects", { limit: 20 }, { ...output, hasMore: false }),
    done("listProjects", { limit: 20 }, { error: "Tidak tersedia" }),
  ])
    expect(deriveToolActivity(message([invalid, unrelated]), false)[0].state).toBe("failed");
  expect(deriveToolActivity(message([success, invalid]), false).at(-1)?.state).toBe("failed");
  expect(
    deriveToolActivity(message([{ ...invalid, errorText: "FORBIDDEN" }, success]), false)[0].state,
  ).toBe("failed");
});
