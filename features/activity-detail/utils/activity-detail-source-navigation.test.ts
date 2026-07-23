import { describe, expect, test } from "bun:test";

import { isActivityDetailSourceRepresentedInCurrentContext } from "./activity-detail-source-navigation";

describe("activity detail source navigation", () => {
  test("hides the source action when the current page already presents the activity", () => {
    expect(
      isActivityDetailSourceRepresentedInCurrentContext({
        sourceHref: "/expenses?tab=field-claims",
        pathname: "/expenses",
        activeTab: "vendor-bills",
      }),
    ).toBe(true);
    expect(
      isActivityDetailSourceRepresentedInCurrentContext({
        sourceHref: "/expenses?tab=field-claims",
        pathname: "/projects/project-1",
        activeTab: "expenses",
      }),
    ).toBe(true);
  });

  test("keeps the source action for a different project context", () => {
    expect(
      isActivityDetailSourceRepresentedInCurrentContext({
        sourceHref: "/expenses?tab=field-claims",
        pathname: "/projects/project-1",
        activeTab: "payments",
      }),
    ).toBe(false);
  });
});
