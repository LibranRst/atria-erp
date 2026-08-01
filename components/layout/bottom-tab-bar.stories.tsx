import type { Meta, StoryObj } from "@storybook/nextjs";

import type { NavItem } from "./bottom-nav-config";
import { BottomTabBar } from "./bottom-nav-parts";

const navItems: readonly NavItem[] = [
  { label: "Dashboard", href: "/ledger", iconName: "dashboard", match: (path) => path === "/ledger" },
  { label: "Projects", href: "/projects", iconName: "folder", match: (path) => path.startsWith("/projects") },
  {
    label: "Materials",
    href: "/materials",
    iconName: "inventory_2",
    match: (path) => path.startsWith("/materials"),
  },
  {
    label: "Expenses",
    href: "/expenses",
    iconName: "receipt_long",
    match: (path) => path.startsWith("/expenses"),
  },
];

const meta = {
  title: "layout/BottomTabBar",
  component: BottomTabBar,
  args: {
    activeIndex: 1,
    clickedTabHref: null,
    items: navItems,
    pathname: "/projects",
    searchParams: new URLSearchParams(),
    onTabClick: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="h-16 w-80 rounded-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BottomTabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
