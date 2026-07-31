import { describe, expect, it } from "bun:test";

import { movementPageSchema } from "./warehouse";

const MOVEMENT_ID = "15151515-1515-1515-1515-151515151501";

describe("Warehouse pagination validations", () => {
  it("menerima cursor pergerakan yang stabil dengan waktu dan ID", () => {
    const parsed = movementPageSchema.safeParse({
      cursor: {
        createdAt: "2026-07-27T08:00:00.000Z",
        id: MOVEMENT_ID,
      },
      limit: 30,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.cursor?.createdAt).toBeInstanceOf(Date);
    expect(parsed.data.cursor?.id).toBe(MOVEMENT_ID);
  });

  it("menolak cursor tanpa ID agar aktivitas bertimestamp sama tidak terlewat", () => {
    const parsed = movementPageSchema.safeParse({
      cursor: { createdAt: "2026-07-27T08:00:00.000Z" },
      limit: 30,
    });

    expect(parsed.success).toBe(false);
  });
});
