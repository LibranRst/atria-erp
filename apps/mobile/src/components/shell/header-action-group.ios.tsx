import { Host } from "@expo/ui";
import { HStack } from "@expo/ui/swift-ui";
import { frame, glassEffect } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { theme } from "@/theme";

export function HeaderActionGroup({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <Host colorScheme="light" ignoreSafeArea="all" style={{ width: 104, height: 48 }}>
      <HStack
        spacing={theme.spacing.xs}
        modifiers={[
          frame({ width: 104, height: 48 }),
          glassEffect({
            glass: { variant: "regular", tint: theme.chrome.lightGlassTint, interactive: true },
            shape: "capsule",
          }),
        ]}
      >
        {children}
      </HStack>
    </Host>
  );
}
