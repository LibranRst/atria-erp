import type { ReactNode } from "react";
import { ChromeSurface } from "@/components/ui";
import { theme } from "@/theme";

export function HeaderActionGroup({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <ChromeSurface style={{ flexDirection: "row", gap: theme.spacing.xs, width: 104, height: 48 }}>
      {children}
    </ChromeSurface>
  );
}
