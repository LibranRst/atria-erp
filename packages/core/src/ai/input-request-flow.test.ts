import { expect, test } from "bun:test";
import { requestUserInputSchema } from "./input-request";
import {
  normalizeInputRequestPayload,
  wizardPrimarySteps,
  wizardStepFields,
} from "./input-request-flow";

const legacy = requestUserInputSchema.parse({
  actionTitle: "Buat proyek",
  fields: [
    { key: "projectName", label: "Nama proyek", type: "text" },
    { key: "contractValue", label: "Nilai kontrak", type: "currency" },
    {
      key: "clientId",
      label: "Klien",
      type: "select",
      options: [
        { value: "existing", label: "Klien terdaftar" },
        { value: "new", label: "+ Klien Baru (tulis di bawah)" },
      ],
    },
    { key: "newClientName", label: "Nama klien baru", type: "text", required: false },
    { key: "newClientPhone", label: "Nomor klien baru", type: "text", required: false },
    { key: "startDate", label: "Tanggal mulai", type: "date" },
  ],
});

test("legacy new-client fields belong to the client step and its name becomes required", () => {
  const payload = normalizeInputRequestPayload(legacy);
  expect(wizardPrimarySteps(payload, { clientId: "new" })).toEqual([0, 1, 2, 5]);
  expect(
    wizardStepFields(payload, "clientId", { clientId: "new" }).map((field) => field.key),
  ).toEqual(["clientId", "newClientName", "newClientPhone"]);
  expect(payload.fields[3].required).toBe(true);
  expect(legacy.fields[3].required).toBe(false);
  expect(normalizeInputRequestPayload(payload)).toEqual(payload);
});
test("registered-client branch hides both new-client fields", () => {
  expect(
    wizardStepFields(normalizeInputRequestPayload(legacy), "clientId", {
      clientId: "existing",
      newClientName: "Previously typed",
    }).map((field) => field.key),
  ).toEqual(["clientId"]);
});
test("legacy create choice without a name field gains an inline required name", () => {
  const payload = normalizeInputRequestPayload({
    ...legacy,
    fields: legacy.fields.filter((field) => !field.key.startsWith("newClient")),
  });
  expect(
    wizardStepFields(payload, "clientId", { clientId: "new" }).map((field) => field.key),
  ).toEqual(["clientId", "newClientName"]);
});
test("stored project creation wizard omits stale manual cap and margin fields", () => {
  const payload = normalizeInputRequestPayload({
    ...legacy,
    fields: [
      ...legacy.fields,
      {
        key: "budgetCapRatio",
        label: "Plafon budget RAP",
        type: "number",
        required: true,
        defaultValue: "0.85",
      },
      { key: "targetGrossPercentage", label: "Target margin", type: "number", required: true },
    ],
  });
  expect(payload.workflow).toBe("CREATE_PROJECT");
  expect(
    payload.fields.some(
      (field) => field.key === "budgetCapRatio" || field.key === "targetGrossPercentage",
    ),
  ).toBe(false);
  expect(payload.fields.some((field) => field.key === "contractValue")).toBe(true);
});
test("explicit setup-budget wizard retains its requested ratio", () => {
  const payload = requestUserInputSchema.parse({
    actionTitle: "Atur budget proyek",
    fields: [
      { key: "budgetCapRatio", label: "Plafon budget", type: "number", defaultValue: "0.8" },
    ],
  });
  expect(normalizeInputRequestPayload(payload)).toEqual(payload);
});
test("typed create-project workflow removes Settings-owned fields without a client selector", () => {
  const payload = requestUserInputSchema.parse({
    workflow: "CREATE_PROJECT",
    actionTitle: "Proyek baru",
    fields: [
      { key: "name", label: "Nama", type: "text" },
      { key: "rap_ratio", label: "Rasio RAP", type: "number" },
    ],
  });
  expect(normalizeInputRequestPayload(payload).fields.map((field) => field.key)).toEqual(["name"]);
});
