import { getRoleNavItems } from "@atria/core/navigation/role-navigation";
import { Tabs } from "expo-router";
import { ScreenMessage } from "@/components/ui";
import { WorkspaceBottomBar } from "@/components/shell/workspace-bottom-bar";
import { useAuth } from "@/providers/auth-provider";

export default function TabsLayout(): React.JSX.Element {
  const { permissions, signOut } = useAuth();
  const routes = new Set(getRoleNavItems(permissions).map((item) => item.href));
  if (routes.size === 0)
    return (
      <ScreenMessage
        icon="lock"
        title="Akses belum diberikan"
        description="Minta pengelola memberikan akses proyek, keuangan, atau material untuk akun ini."
        actionLabel="Keluar"
        onAction={() => void signOut()}
      />
    );
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute" },
        animation: "none",
      }}
      tabBar={(props) => <WorkspaceBottomBar {...props} />}
    >
      <Tabs.Screen name="approvals" options={{ href: null }} />
      <Tabs.Screen name="ledger" options={{ href: routes.has("/ledger") ? "/ledger" : null }} />
      <Tabs.Screen
        name="projects"
        options={{ href: routes.has("/projects") ? "/projects" : null }}
      />
      <Tabs.Screen
        name="materials"
        options={{ href: routes.has("/materials") ? "/materials" : null }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ href: routes.has("/expenses") ? "/expenses" : null }}
      />
    </Tabs>
  );
}
