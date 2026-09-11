import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PendingChangeOrdersBanner } from "./pending-change-orders-banner";

describe("PendingChangeOrdersBanner", () => {
  test("returns null when orders array is empty", () => {
    const html = renderToStaticMarkup(<PendingChangeOrdersBanner orders={[]} />);
    expect(html).toBe("");
  });

  test("renders pending change orders with link to project rab tab", () => {
    const html = renderToStaticMarkup(
      <PendingChangeOrdersBanner
        orders={[
          {
            id: "co-1",
            projectId: "proj-bassura",
            projectName: "Bassura City",
            valueDelta: "6000000.00",
            reason: "Add-on Meja Kerja & LED Strip",
            createdByName: "Owner Dekoria",
            createdAt: new Date("2026-09-01T10:00:00Z").toISOString(),
            baseRevision: 1,
            revisedRevision: 2,
          },
        ]}
      />,
    );

    expect(html).toContain("Change Order Menunggu Persetujuan");
    expect(html).toContain("Bassura City");
    expect(html).toContain("R1 → R2");
    expect(html).toContain("Add-on Meja Kerja &amp; LED Strip");
    expect(html).toContain("Diajukan oleh Owner Dekoria");
    expect(html).toContain('href="/projects/proj-bassura?tab=rab"');
    expect(html).toContain("Buka RAB →");
  });
});
