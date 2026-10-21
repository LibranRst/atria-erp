import { getRoleNavItems } from "@atria/core/navigation/role-navigation";
import type { BottomTabBarProps } from "expo-router/tabs";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useMainNavigation } from "@/providers/main-navigation-provider";
import { useScreenQuery } from "@/lib/use-screen-query";
import { isAccessRevoked } from "@/lib/access-error";
import { Keyboard, Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeNavigationDock, type NativeNavigationTab } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { trpcClient } from "@/lib/trpc-client";
import { theme } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/constants/scroll-insets";
import { useWorkspaceFabItems } from "./workspace-chrome";

const symbols = {
  "/ledger": "square.grid.2x2",
  "/projects": "folder",
  "/expenses": "doc.text",
  "/materials": "shippingbox",
} as const;
const selectedSymbols = {
  "/ledger": "square.grid.2x2.fill",
  "/projects": "folder.fill",
  "/expenses": "doc.text.fill",
  "/materials": "shippingbox.fill",
} as const;

/** Satu layout memiliki baseline tab bar dan FAB; scroll tidak mengubah ukurannya. */
export function WorkspaceBottomBar({
  state,
  navigation,
}: BottomTabBarProps): React.JSX.Element | null {
  const { permissions } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const canCreateProject = permissions.includes("create:project");
  useEffect(() => {
    // Prepare the permitted native sheet before first selection. Its query
    // stays focus-gated, and shared header options wait for the real route.
    if (Platform.OS === "ios" && canCreateProject) router.prefetch("/modal/project");
  }, [canCreateProject, router]);
  const projectId = /^\/projects\/([^/]+)$/.exec(pathname)?.[1];
  const overview = useScreenQuery(
    "projectOverview",
    (signal) => {
      if (!projectId) throw new Error("Proyek belum dipilih.");
      return trpcClient.screen.projectOverview.query({ projectId }, { signal });
    },
    [projectId],
    Boolean(projectId),
  );
  const main = useMainNavigation();
  const selectTab = useCallback(
    (name: string, params?: Readonly<Record<string, string>>): boolean => {
      const current = navigation.getState();
      const route = current.routes.find((entry) => entry.name === name);
      if (!route) return false;
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (event.defaultPrevented) return true;
      if (params && Object.keys(params).length) {
        navigation.navigate(route.name, { screen: "index", params, initial: false });
      } else if (current.routes[current.index]?.key !== route.key) {
        navigation.navigate(route.name, route.params);
      }
      return true;
    },
    [navigation],
  );
  useEffect(() => main.register(selectTab), [main, selectTab]);
  const [keyboard, setKeyboard] = useState(false);
  const actions = useWorkspaceFabItems({
    projectId,
    projectLocked:
      !isAccessRevoked(overview.error) && overview.data?.status === "ready"
        ? overview.data.isLocked
        : true,
  });
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;
  const items = getRoleNavItems(permissions);
  const tabs: NativeNavigationTab[] = items.flatMap((item) => {
    const route = state.routes.find((entry) => entry.name === item.href.slice(1));
    if (!route) return [];
    return [
      {
        id: route.key,
        label:
          item.href === "/projects"
            ? "Proyek"
            : item.href === "/materials"
              ? "Material"
              : item.href === "/expenses"
                ? "Biaya"
                : "Dashboard",
        icon: item.iconName,
        systemImage: symbols[item.href],
        selectedSystemImage: selectedSymbols[item.href],
      },
    ];
  });
  return (
    <View
      pointerEvents="box-none"
      style={[styles.position, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}
    >
      <NativeNavigationDock
        width={Math.min(width - theme.spacing.marginMobile * 2, 312)}
        height={TAB_BAR_HEIGHT}
        tabs={tabs}
        selectedId={state.routes[state.index]?.key ?? ""}
        actions={actions}
        onSelect={(id) => {
          const route = state.routes.find((entry) => entry.key === id);
          if (!route) return;
          selectTab(route.name);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.marginMobile,
    alignItems: "center",
  },
});
