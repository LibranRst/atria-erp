import type { NativeMenuItem } from "./action-menu.types";

export type NativeNavigationTab = {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly systemImage: NonNullable<NativeMenuItem["systemImage"]>;
  readonly selectedSystemImage: NonNullable<NativeMenuItem["systemImage"]>;
};
export type NativeNavigationDockProps = {
  readonly tabs: readonly NativeNavigationTab[];
  readonly selectedId: string;
  readonly actions: readonly NativeMenuItem[];
  readonly onSelect: (id: string) => void;
  readonly width: number;
  readonly height: number;
};
