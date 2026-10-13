import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DuotoneIconTile } from "./icon-tile";

describe("calm luxury icon treatments", () => {
  test("uses a free outline icon inside the existing neutral tile", () => {
    const html = renderToStaticMarkup(<DuotoneIconTile name="approval" />);

    expect(html).toContain("rounded-icon");
    expect(html).toContain("bg-surface-container-low");
    expect(html).toContain('stroke-width="1.5"');
    expect(html).toContain('fill="none"');
    expect(html).not.toContain('opacity="0.2"');
  });
});
