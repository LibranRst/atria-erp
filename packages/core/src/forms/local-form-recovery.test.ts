import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { parseLocalFormRecovery, serializeLocalFormRecovery } from "./local-form-recovery";

const schema = z.object({ amount: z.string(), note: z.string() });

describe("local form recovery", () => {
  test("round trips a valid versioned payload", () => {
    const raw = serializeLocalFormRecovery({
      payload: { amount: "125000", note: "Pembayaran termin" },
      schemaVersion: 2,
      changedAt: new Date("2026-07-13T00:00:00.000Z"),
    });
    expect(parseLocalFormRecovery({ raw, schema, schemaVersion: 2 })).toEqual({
      schemaVersion: 2,
      changedAt: "2026-07-13T00:00:00.000Z",
      payload: { amount: "125000", note: "Pembayaran termin" },
    });
  });

  test("rejects stale versions and invalid payloads", () => {
    const raw = serializeLocalFormRecovery({
      payload: { amount: "125000", note: "x" },
      schemaVersion: 1,
    });
    expect(parseLocalFormRecovery({ raw, schema, schemaVersion: 2 })).toBeNull();
    expect(
      parseLocalFormRecovery({ raw: '{"schemaVersion":2,"payload":{}}', schema, schemaVersion: 2 }),
    ).toBeNull();
  });
});
