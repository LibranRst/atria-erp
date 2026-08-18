import { describe, expect, test } from "bun:test";

import { getStatusPresentation, resolveStatusPresentation } from "./status-presentation";

describe("presentasi status bersama", () => {
  test("mempertahankan label dan tone status keuangan", () => {
    expect(getStatusPresentation("PENDING_APPROVAL")).toEqual({
      label: "Menunggu persetujuan",
      tone: "pending",
    });
    expect(getStatusPresentation("PAID")).toEqual({ label: "Lunas", tone: "completed" });
  });

  test("status asing tetap diterjemahkan di batas presentasi", () => {
    expect(resolveStatusPresentation("WAITING_FOR_OWNER")).toEqual({
      label: "Waiting for owner",
      tone: "neutral",
    });
  });
});
