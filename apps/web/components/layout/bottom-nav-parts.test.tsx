import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { BottomTabBar, QuickActionFab } from "./bottom-nav-parts";
import type { NavItem } from "./bottom-nav-config";

const mockItems: readonly NavItem[] = [
  {
    href: "/projects",
    iconName: "folder",
    label: "Proyek",
    match: (path) => path.startsWith("/projects"),
  },
  {
    href: "/expenses",
    iconName: "receipt_long",
    label: "Kas & Tagihan",
    match: (path) => path.startsWith("/expenses"),
  },
];

describe("BottomTabBar active feedback contract", () => {
  test("renders tab links with scale-up active animation classes", () => {
    const html = renderToStaticMarkup(
      <BottomTabBar
        activeIndex={0}
        clickedTabHref={null}
        items={mockItems}
        pathname="/projects"
        searchParams={new URLSearchParams()}
        onTabClick={() => {}}
      />,
    );

    expect(html).toContain("active:scale-[1.05]");
    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });
});

describe("QuickActionFab active feedback contract", () => {
  test("renders FAB container with active elevation classes", () => {
    const html = renderToStaticMarkup(
      <QuickActionFab
        actions={[]}
        contentRef={React.createRef<HTMLDivElement>()}
        isOpen={false}
        menuHeight={null}
        onAction={() => {}}
        onOpen={() => {}}
      />,
    );

    expect(html).toContain("active:shadow-raised");
    expect(html).toContain("active:z-10");
  });
});
