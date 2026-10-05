import { getHeaderMenuItems } from "@atria/core/navigation/header-menu";
import { buildFabActions } from "@atria/core/navigation/quick-actions";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import {
  ActionMenu,
  AppIcon,
  ChromeButton,
  ChromeSurface,
  HeaderLeadingControls,
  type NativeMenuItem,
} from "@/components/ui";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { workspaceChromeLocation } from "@/lib/main-navigation-state";
import { resolveAppDestination } from "@/lib/app-destination";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/constants/scroll-insets";
import { HeaderActionGroup } from "./header-action-group";

const symbols: Readonly<Record<string, NativeMenuItem["systemImage"]>> = {
  dashboard: "chart.bar",
  folder: "folder",
  folder_open: "folder.badge.plus",
  inventory_2: "shippingbox",
  receipt_long: "doc.text",
  request_quote: "doc.text",
  description: "doc.text",
  fact_check: "checkmark.shield",
  verified_user: "checkmark.seal",
  person: "person",
  tune: "gearshape",
  sparkle: "sparkles",
  lock: "lock",
  arrow_downward: "arrow.down",
  inventory: "shippingbox",
  warehouse: "shippingbox",
  undo: "arrow.uturn.backward",
  report_problem: "exclamationmark.triangle",
  sync_alt: "arrow.left.arrow.right",
  construction: "hammer",
  add_location_alt: "mappin.and.ellipse",
};

const selectedSymbols: Readonly<Record<string, NativeMenuItem["systemImage"]>> = {
  dashboard: "chart.bar.fill",
  folder: "folder.fill",
  inventory_2: "shippingbox.fill",
  receipt_long: "doc.text.fill",
  fact_check: "checkmark.shield.fill",
  verified_user: "checkmark.seal.fill",
  person: "person.fill",
  tune: "gearshape.fill",
};

function menuLabel(label: string): string {
  const shortLabels: Readonly<Record<string, string>> = {
    "Pengaturan ERP": "Pengaturan",
    "Profil Saya": "Profil",
    "Asisten AI": "Asisten",
    "Expense Lapangan": "Catat biaya",
    "Expense Proyek": "Biaya proyek",
    "Tagihan Vendor": "Tagihan vendor",
    "Invoice Klien": "Invoice klien",
    "Project Baru": "Proyek baru",
    "Penyesuaian Darurat": "Sesuaikan stok",
  };
  return shortLabels[label] ?? label;
}

function useWorkspaceMenuItems(): NativeMenuItem[] {
  const { permissions, signOut } = useAuth();
  const navigate = useAtriaNavigation();
  const location = workspaceChromeLocation(useRootNavigationState(), usePathname());
  const { pathname, sheetPresented } = location;
  return useMemo(() => {
    const items: NativeMenuItem[] = getHeaderMenuItems(permissions).map((item) => ({
      id: item.href,
      label: menuLabel(item.label),
      disabled: sheetPresented,
      selected: item.match(pathname, new URLSearchParams()),
      icon: item.iconName,
      systemImage: symbols[item.iconName],
      selectedSystemImage: selectedSymbols[item.iconName] ?? symbols[item.iconName],
      destinationTitle:
        resolveAppDestination(item.href)?.kind === "native" ? menuLabel(item.label) : undefined,
      onPress: () => navigate(item.href),
    }));
    items.push({
      id: "sign-out",
      label: "Keluar",
      icon: "logout",
      systemImage: "rectangle.portrait.and.arrow.right",
      disabled: sheetPresented,
      onPress: () => void signOut(),
    });
    return items;
  }, [navigate, pathname, permissions, sheetPresented, signOut]);
}

/** The same native button survives tab/stack switches; only its props change. */
export function PersistentWorkspaceMenu(): React.JSX.Element {
  const currentPathname = usePathname();
  const { permissions } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigate = useAtriaNavigation();
  const currentState = useRootNavigationState();
  const { pathname, hasBack, sheetPresented } = workspaceChromeLocation(
    currentState,
    currentPathname,
  );
  const { width: screenWidth } = useWindowDimensions();
  const canUseAI = permissions.includes("use:ai_chat");
  const width = hasBack && canUseAI ? Math.min(112, screenWidth - 252) : 112;
  const item = getHeaderMenuItems(permissions).find((item) =>
    item.match(pathname, new URLSearchParams()),
  );
  const title = pathname.startsWith("/projects/")
    ? "Detail Proyek"
    : pathname === "/onboarding/review"
      ? "Review saldo"
      : pathname === "/onboarding"
        ? "Setup organisasi"
        : item
          ? menuLabel(item.label)
          : "Atria";
  const hidden = pathname === "/profile/password" || pathname === "/";
  const blocked = hidden || sheetPresented;
  return (
    <>
      <View
        pointerEvents={blocked ? "none" : "box-none"}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
        style={[
          styles.persistentMenu,
          { top: insets.top - 2, width, marginLeft: -width / 2, opacity: hidden ? 0 : 1 },
        ]}
      >
        <WorkspaceHeaderMenu title={title} width={width} />
      </View>
      <View
        pointerEvents={blocked ? "none" : "box-none"}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
        style={{
          position: "absolute",
          left: 0,
          top: insets.top - 2,
          width: 136,
          zIndex: 99,
          height: 48,
          opacity: hidden ? 0 : 1,
        }}
      >
        <HeaderLeadingControls
          hasBack={hasBack}
          canUseAI={canUseAI}
          onBack={() => {
            if (blocked) return;
            if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
          onAI={() => {
            if (!blocked) navigate("/ai");
          }}
        />
      </View>
      <View
        pointerEvents={blocked ? "none" : "box-none"}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
        style={{
          position: "absolute",
          right: Math.max(insets.right, theme.spacing.marginMobile),
          top: insets.top - 2,
          width: 48 * 2 + theme.spacing.xs,
          height: 48,
          zIndex: 99,
          opacity: hidden ? 0 : 1,
        }}
      >
        <HeaderTrailing />
      </View>
    </>
  );
}

/** Page navigation stays in the native anchored, floating title menu. */
function WorkspaceHeaderMenu({
  title,
  width = 112,
}: {
  readonly title: string;
  readonly width?: number;
}): React.JSX.Element {
  const items = useWorkspaceMenuItems();
  return (
    <ActionMenu
      accessibilityLabel={`Menu halaman ${title}`}
      items={items}
      width={width}
      nativeTitle={title}
    >
      <ChromeSurface style={styles.titleTrigger}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </ChromeSurface>
    </ActionMenu>
  );
}

function HeaderLeading(): React.JSX.Element | null {
  const { permissions } = useAuth();
  const navigate = useAtriaNavigation();
  if (!permissions.includes("use:ai_chat")) return null;
  return (
    <ChromeButton
      icon="sparkle"
      systemImage="sparkles"
      label="Buka asisten AI · Buka di web"
      onPress={() => navigate("/ai")}
    />
  );
}

function HeaderTrailing(): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const { user } = useAuth();
  const { sheetPresented } = workspaceChromeLocation(useRootNavigationState(), usePathname());
  const size = 48;
  return (
    <View
      pointerEvents={sheetPresented ? "none" : "auto"}
      accessibilityElementsHidden={sheetPresented}
      importantForAccessibility={sheetPresented ? "no-hide-descendants" : "auto"}
      style={{
        flexDirection: "row",
        gap: theme.spacing.xs,
        width: size * 2 + theme.spacing.xs,
        height: size,
      }}
    >
      <HeaderActionGroup>
        <ChromeButton
          icon="notification_important"
          systemImage="bell"
          surface={false}
          embedded={Platform.OS === "ios"}
          width={size}
          height={size}
          label="Notifikasi · Buka di web"
          onPress={() => {
            if (!sheetPresented) navigate("/notifications");
          }}
        />
        <ChromeButton
          icon="person"
          systemImage="person.crop.circle"
          surface={false}
          embedded={Platform.OS === "ios"}
          imageUri={user?.image}
          width={size}
          height={size}
          label="Profil Saya · Buka di web"
          onPress={() => {
            if (!sheetPresented) navigate("/profile");
          }}
        />
      </HeaderActionGroup>
    </View>
  );
}

type StackOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack>["screenOptions"]>,
  (...args: never[]) => unknown
>;
const workspaceHeaderOptions: StackOptions = {
  contentStyle: { backgroundColor: theme.colors.background },
  headerTransparent: true,
  headerBlurEffect: "none",
  scrollEdgeEffects: { top: "hidden" },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: "transparent" },
  headerTintColor: theme.colors.onSurface,
  headerBackButtonDisplayMode: "minimal",
  headerBackVisible: true,
  headerTitleAlign: "center",
  // null falls back to UIKit's default title behind the persistent pill.
  headerTitle: (props) =>
    Platform.OS === "ios" ? (
      <View accessible={false} style={{ width: 1, height: 1 }} />
    ) : (
      <WorkspaceHeaderMenu title={props.children} />
    ),
};

/** Root-owned iOS chrome survives native page pushes; Android keeps its header. */
export function useWorkspaceHeaderOptions(): StackOptions {
  return useMemo(() => {
    if (Platform.OS !== "ios")
      return {
        ...workspaceHeaderOptions,
        headerLeft: () => <HeaderLeading />,
        headerRight: () => <HeaderTrailing />,
      };
    return {
      ...workspaceHeaderOptions,
      headerBackVisible: false,
      gestureEnabled: true,
      // Both action clusters have persistent owners outside the page headers.
      unstable_headerLeftItems: () => [],
      unstable_headerRightItems: () => [],
    };
  }, []);
}

export function WorkspaceStack({
  title,
  hasProjectDetail = false,
}: {
  readonly title: string;
  readonly hasProjectDetail?: boolean;
}): React.JSX.Element {
  const options = useWorkspaceHeaderOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title, headerBackVisible: false }} />
      {hasProjectDetail ? (
        <Stack.Screen name="[projectId]/index" options={{ title: "Detail Proyek" }} />
      ) : null}
    </Stack>
  );
}

export function useWorkspaceFabItems({
  projectId,
  projectLocked = false,
}: {
  readonly projectId?: string;
  readonly projectLocked?: boolean;
}): NativeMenuItem[] {
  const { permissions } = useAuth();
  const pathname = usePathname();
  const navigate = useAtriaNavigation();
  const actions = buildFabActions({
    permissions,
    pathname,
    isProjectDetail: Boolean(projectId),
    isCurrentProjectLocked: projectLocked,
    withQuery: (key, value = "true", targetPath = pathname): string =>
      `${targetPath}?${new URLSearchParams({ [key]: value })}`,
  }).filter((action) => {
    const url = new URL(action.href, "https://atria.invalid");
    if (url.searchParams.has("new-expense")) return permissions.includes("create:cost");
    if (url.searchParams.has("new-vendor-bill")) return permissions.includes("create:vendor_bill");
    return true;
  });
  return actions.map((action) => ({
    id: action.href,
    label: menuLabel(action.label),
    disabled: action.disabled,
    icon: action.iconName,
    systemImage: symbols[action.iconName],
    onPress: () => navigate(action.href),
  }));
}

export function WorkspaceFab({
  projectId,
  projectLocked = false,
}: {
  readonly projectId?: string;
  readonly projectLocked?: boolean;
}): React.JSX.Element | null {
  const items = useWorkspaceFabItems({ projectId, projectLocked });
  if (items.length === 0) return null;
  return (
    <View>
      <ActionMenu
        accessibilityLabel="Aksi cepat"
        items={items}
        width={TAB_BAR_HEIGHT}
        height={TAB_BAR_HEIGHT}
        nativeIcon="plus"
        tone="primary"
      >
        <ChromeSurface style={styles.fab}>
          <AppIcon name="add" color={theme.colors.primary} size={28} />
        </ChromeSurface>
      </ActionMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  persistentMenu: {
    position: "absolute",
    zIndex: 100,
    left: "50%",
    marginLeft: -56,
    width: 112,
    height: 48,
  },
  titleTrigger: {
    width: 112,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
    color: theme.colors.onSurface,
  },
  fab: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
