import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DuotoneIconTile } from "./icon-tile";

describe("calm luxury icon treatments", () => {
  test("uses a tactile duotone icon inside the semantic icon radius", () => {
    const html = renderToStaticMarkup(<DuotoneIconTile name="approval" />);

    expect(html).toContain("rounded-icon");
    expect(html).toContain("bg-surface-container-low");
    expect(html).toContain('opacity="0.2"');
  });
});
