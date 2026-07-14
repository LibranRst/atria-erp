import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SegmentedTabs } from "./segmented-tabs";

describe("segmented tabs", () => {
  test("marks the active item inside an overflow-capable tablist", () => {
    const html = renderToStaticMarkup(
      <SegmentedTabs
        value="budget"
        onChange={() => undefined}
        ariaLabel="Dashboard tabs"
        scrollable
        options={[
          { value: "overview", label: "Ringkasan" },
          { value: "budget", label: "Budget" },
          { value: "materials", label: "Material" },
        ]}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("overflow-x-auto");
  });
});
