import { describe, expect, test } from "bun:test";

import { ACTIVITY_DETAIL_KINDS, dateValue, moneyValue, quantityValue, textValue } from "./types";
import { activityDetailRequestSchema } from "./validation";

describe("activity detail contract", () => {
  test("accepts every canonical activity kind with a UUID", () => {
    for (const kind of ACTIVITY_DETAIL_KINDS) {
      expect(
        activityDetailRequestSchema.safeParse({ kind, id: "00000000-0000-4000-8000-000000000001" })
          .success,
      ).toBe(true);
    }
  });

  test("accepts canonical database UUIDs from legacy sandbox records", () => {
    expect(
      activityDetailRequestSchema.safeParse({
        kind: "VENDOR_BILL",
        id: "33033303-3303-3303-3303-330333033301",
      }).success,
    ).toBe(true);
  });

  test("rejects unknown kinds and non UUID references", () => {
    expect(activityDetailRequestSchema.safeParse({ kind: "RAW_AUDIT", id: "1" }).success).toBe(
      false,
    );
    expect(
      activityDetailRequestSchema.safeParse({ kind: "STOCK_MOVEMENT", id: "movement-1" }).success,
    ).toBe(false);
  });

  test("keeps business values typed and serializable", () => {
    const values = [
      textValue("Posted"),
      moneyValue(125_000),
      quantityValue(2.5, "lembar"),
      dateValue("2026-07-18T00:00:00.000Z"),
    ];
    expect(JSON.parse(JSON.stringify(values))).toEqual(values);
  });
});
