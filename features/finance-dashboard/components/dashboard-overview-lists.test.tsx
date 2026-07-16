import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OverviewPriorityList } from "./dashboard-overview-lists";

describe("OverviewPriorityList", () => {
  test("preserves sourced decision values and destinations in actionable rows", () => {
    const html = renderToStaticMarkup(
      <OverviewPriorityList
        actions={[
          {
            id: "approvals",
            severity: "CRITICAL",
            title: "11 persetujuan menunggu",
            description: "Keputusan tertunda dapat menahan pekerjaan atau pembayaran.",
            href: "/ledger?tab=approvals",
          },
        ]}
      />,
    );

    expect(html).toContain("11 persetujuan menunggu");
    expect(html).toContain("Keputusan tertunda dapat menahan pekerjaan atau pembayaran.");
    expect(html).toContain('href="/ledger?tab=approvals"');
    expect(html).toContain("approval");
    expect(html).toContain("chevron_right");
    expect(html).not.toContain(">1<");
  });
});
