import { getRoleNavItems } from "@atria/core/navigation/role-navigation";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useMemo } from "react";

import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

export default function TabsLayout(): React.JSX.Element {
  const { roleName } = useAuth();
  const allowedRoutes = useMemo(
    () =>
      new Set(
        getRoleNavItems(roleName ? (ROLE_PERMISSIONS[roleName] ?? []) : []).map(
          (item) => item.href,
        ),
      ),
    [roleName],
  );

  return (
    <NativeTabs
      backBehavior="history"
      backgroundColor={theme.colors.surfaceContainerLowest}
      disableIndicator
      disableTransparentOnScrollEdge
      iconColor={{ default: theme.colors.muted, selected: theme.colors.primary }}
      labelStyle={{ fontFamily: theme.fonts.semibold, fontSize: 10 }}
      labelVisibilityMode="labeled"
      minimizeBehavior="onScrollDown"
      shadowColor={theme.colors.outlineVariant}
      tabBarRespectsIMEInsets
      tintColor={theme.colors.primary}
    >
      <NativeTabs.Trigger
        accessibilityLabel="Dashboard"
        hidden={!allowedRoutes.has("/ledger")}
        name="ledger"
        testID="tab-ledger"
      >
        <NativeTabs.Trigger.Icon
          md="dashboard"
          sf={{ default: "chart.bar.xaxis", selected: "chart.bar.xaxis" }}
        />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        accessibilityLabel="Proyek"
        hidden={!allowedRoutes.has("/projects")}
        name="projects"
        testID="tab-projects"
      >
        <NativeTabs.Trigger.Icon
          md={{ default: "folder", selected: "folder" }}
          sf={{ default: "folder", selected: "folder.fill" }}
        />
        <NativeTabs.Trigger.Label>Proyek</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        accessibilityLabel="Material"
        hidden={!allowedRoutes.has("/materials")}
        name="materials"
        testID="tab-materials"
      >
        <NativeTabs.Trigger.Icon
          md={{ default: "inventory_2", selected: "inventory_2" }}
          sf={{ default: "shippingbox", selected: "shippingbox.fill" }}
        />
        <NativeTabs.Trigger.Label>Material</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        accessibilityLabel="Biaya"
        hidden={!allowedRoutes.has("/expenses")}
        name="expenses"
        testID="tab-expenses"
      >
        <NativeTabs.Trigger.Icon
          md={{ default: "receipt_long", selected: "receipt_long" }}
          sf={{ default: "doc.text", selected: "doc.text.fill" }}
        />
        <NativeTabs.Trigger.Label>Biaya</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
