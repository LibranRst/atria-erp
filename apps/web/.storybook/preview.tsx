import type { Preview } from "@storybook/nextjs";
import React from "react";

import { ProjectStateProvider } from "../features/projects/detail/components/shared/project-state-context";
import { manrope, jetbrains } from "./fonts";
import "../app/globals.css";
import "../components/ui/desktop/heroui-scoped.css";

// The real app puts the next/font variable classes on <html> (app/layout.tsx), so
// --font-sans (which references var(--font-manrope)) resolves validly at the root and
// inherits correctly. A custom property that fails to resolve at its point of
// declaration becomes permanently invalid for every inheriting descendant even if a
// deeper element later defines the variable it depends on — so these classes must
// live on document.documentElement, not on a nested wrapper div.
function RootFontClassSetter(): null {
  React.useEffect(() => {
    const root = document.documentElement;
    const classes = [manrope.variable, jetbrains.variable, "antialiased"];
    root.classList.add(...classes);
    return () => {
      root.classList.remove(...classes);
    };
  }, []);
  return null;
}

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/ledger",
        query: {},
      },
    },
    backgrounds: {
      options: {
        canvas: { name: "canvas", value: "var(--background)" },
        surface: { name: "surface", value: "var(--surface-container-lowest)" },
      },
    },
    viewport: {
      options: {
        mobileSmall: { name: "iPhone SE (320)", styles: { width: "320px", height: "844px" } },
        mobileMd: { name: "iPhone 12 mini (360)", styles: { width: "360px", height: "844px" } },
        mobileLg: { name: "iPhone 14 (390)", styles: { width: "390px", height: "844px" } },
        mobileXl: { name: "iPhone Pro Max (430)", styles: { width: "430px", height: "932px" } },
      },
    },
    initialGlobals: {
      viewport: { value: "mobileLg" },
      backgrounds: { value: "canvas" },
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-full bg-background font-sans text-base leading-lg font-normal text-on-surface">
        <RootFontClassSetter />
        <ProjectStateProvider>
          <Story />
        </ProjectStateProvider>
      </div>
    ),
  ],
};

export default preview;
