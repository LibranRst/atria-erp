import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";
import { useScreenQuery } from "@/lib/use-screen-query";
import { useScreenScroll } from "@/lib/use-screen-memory";
import { isAccessRevoked } from "@/lib/access-error";
import {
  ScreenQueryState,
  ScreenRefreshNotice,
  ScreenMessage,
  DashboardBodySkeleton,
  SkeletonBlock,
  SegmentedTabs,
  type SegmentedTab,
} from "@/components/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/auth-provider";
import { trpcClient } from "@/lib/trpc-client";
import { theme } from "@/theme";
import { TAB_BAR_CLEARANCE, TAB_SCREEN_BOTTOM_SPACE } from "@/constants/scroll-insets";
import { DashboardOverviewTab } from "./dashboard-overview";
import { AccountsTab, ApprovalsTab, BudgetTab, CashDueTab, MaterialsTab } from "./dashboard-tabs";
import { parseDashboardTab } from "./dashboard-navigation";

const tabs: readonly {
  readonly value: DashboardPageTab;
  readonly label: string;
  readonly icon: string;
}[] = [
  { value: "overview", label: "Ringkasan", icon: "space_dashboard" },
  { value: "approvals", label: "Persetujuan", icon: "approval" },
  { value: "budget", label: "Budget", icon: "monitoring" },
  { value: "cash", label: "Jatuh Tempo", icon: "event_busy" },
  { value: "accounts", label: "Rekening", icon: "account_balance" },
  { value: "materials", label: "Material", icon: "inventory_2" },
];

export function DashboardScreen(): React.JSX.Element {
  const { permissions, refresh } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const tab = parseDashboardTab(
    Array.isArray(params.tab) ? params.tab[0] : params.tab,
    permissions,
  );
  const scroll = useScreenScroll("ledger");
  const query = useScreenQuery("ledger", (signal) =>
    trpcClient.screen.ledger.query(undefined, { signal }),
  );
  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <ScreenQueryState
        query={query}
        skeleton={<DashboardSkeleton tab={tab} />}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.data.status === "restricted")
    return (
      <ScreenMessage
        icon="lock"
        title="Akses dibatasi"
        description="Akun ini tidak memiliki akses Dashboard keuangan."
      />
    );
  if (query.data.status === "error")
    return (
      <ScreenMessage
        title="Dashboard belum siap"
        description={query.data.message}
        onAction={() => void query.refetch()}
      />
    );
  const data = query.data;
  const options: readonly SegmentedTab<DashboardPageTab>[] = tabs
    .filter((item) => item.value !== "approvals" || permissions.includes("view:approval_queue"))
    .map((item) => {
      const count =
        item.value === "approvals"
          ? data.overview.dashboardDetails.approvalSummary.totalCount
          : item.value === "overview"
            ? 0
            : data.overview.dashboardTabs.counts[item.value];
      return { ...item, badge: count > 0 ? count : undefined };
    });
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  return (
    <>
      <ScrollView
        {...scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefreshing}
            onRefresh={() => {
              void refresh();
              void query.refresh();
            }}
          />
        }
      >
        <ScreenRefreshNotice query={query} />
        <View style={styles.pageHeader}>
          <View style={styles.headingCopy}>
            <Text style={styles.pageTitle}>
              Halo, {data.userName.trim().split(/\s+/)[0] || "Anda"}
            </Text>
            <Text style={styles.subtitle}>{today}</Text>
          </View>
          <Text style={styles.role}>{formatBusinessLabel(data.overview.role)}</Text>
        </View>
        <SegmentedTabs
          accessibilityLabel="Tab Dashboard"
          options={options}
          scrollable
          value={tab}
          onChange={(next) => router.setParams({ tab: next })}
        />
        {data.overview.dataQuality.partial ? (
          <View style={styles.status}>
            <Text style={styles.statusText}>
              {`Sebagian data belum tersedia: ${data.overview.dataQuality.unavailableSources.map((source) => formatBusinessLabel(source)).join(", ")}.`}
            </Text>
          </View>
        ) : null}
        {tab === "overview" ? (
          <DashboardOverviewTab data={data} />
        ) : tab === "approvals" ? (
          <ApprovalsTab data={data.overview} />
        ) : tab === "budget" ? (
          <BudgetTab data={data.overview} />
        ) : tab === "cash" ? (
          <CashDueTab data={data.overview} />
        ) : tab === "accounts" ? (
          <AccountsTab data={data.overview} />
        ) : (
          <MaterialsTab data={data.overview} />
        )}
      </ScrollView>
    </>
  );
}

export function DashboardSkeleton({
  tab = "overview",
}: {
  readonly tab?: DashboardPageTab;
}): React.JSX.Element {
  const { permissions, roleName, user } = useAuth();
  const router = useRouter();
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const options = tabs.filter(
    (item) => item.value !== "approvals" || permissions.includes("view:approval_queue"),
  );
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <SkeletonBlock width="40%" height={theme.typography.meta.lineHeight} />
      <View style={styles.pageHeader}>
        <View style={styles.headingCopy}>
          <Text style={styles.pageTitle}>Halo, {user?.name.trim().split(/\s+/)[0] || "Anda"}</Text>
          <Text style={styles.subtitle}>{today}</Text>
        </View>
        {roleName ? <Text style={styles.role}>{formatBusinessLabel(roleName)}</Text> : null}
      </View>
      <SegmentedTabs
        accessibilityLabel="Tab Dashboard"
        options={options}
        scrollable
        value={tab}
        onChange={(next) => router.setParams({ tab: next })}
      />
      <DashboardBodySkeleton tab={tab} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: TAB_SCREEN_BOTTOM_SPACE + TAB_BAR_CLEARANCE,
  },
  pageHeader: { flexDirection: "row", gap: theme.spacing.xs, alignItems: "flex-start" },
  headingCopy: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  pageTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    ...theme.typography.title,
  },
  subtitle: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
  },
  role: {
    maxWidth: "35%",
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainerLow,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.base,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
  status: {
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
    padding: theme.spacing.sm,
  },
  statusText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
  },
});
