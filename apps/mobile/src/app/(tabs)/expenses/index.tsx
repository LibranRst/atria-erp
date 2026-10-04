import { useScreenQuery } from "@/lib/use-screen-query";
import { useScreenScroll } from "@/lib/use-screen-memory";
import { isAccessRevoked } from "@/lib/access-error";
import {
  ScreenQueryState,
  ScreenRefreshNotice,
  AppIcon,
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  RowAction,
  ScreenMessage,
  ExpenseListSkeleton,
  StatusBadge,
  SummarySurface,
} from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { readLocalExpenseDraft } from "@/lib/draft-storage";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { TAB_BAR_CLEARANCE, TAB_SCREEN_BOTTOM_SPACE } from "@/constants/scroll-insets";
import { theme } from "@/theme";

export default function ExpensesScreen(): React.JSX.Element {
  const router = useRouter();
  const { permissions, user } = useAuth();
  const localDraftQuery = useQuery({
    networkMode: "always",
    enabled: Boolean(user),
    queryKey: ["local-expense-draft", user?.id],
    queryFn: () => (user ? readLocalExpenseDraft(user.id) : Promise.resolve(null)),
  });
  const localDraft = localDraftQuery.data ?? null;
  const query = useScreenQuery("expenses", (signal) =>
    trpcClient.screen.expenses.query(undefined, { signal }),
  );
  const scroll = useScreenScroll("expenses");

  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <ScreenQueryState
        query={query}
        skeleton={
          <ScrollView
            {...scroll}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: TAB_SCREEN_BOTTOM_SPACE + TAB_BAR_CLEARANCE },
            ]}
          >
            <ExpenseListSkeleton
              canCreate={permissions.includes("create:cost")}
              hasDraft={Boolean(localDraft)}
            />
          </ScrollView>
        }
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data || query.data.status === "restricted") {
    return (
      <ScreenMessage
        description="Peran Anda tidak memiliki akses ke workspace biaya."
        icon="lock"
        title="Akses dibatasi"
      />
    );
  }

  const costs = query.data.initialCosts;
  const total = costs.reduce((sum, item) => sum + Number(item.amount), 0);
  const pending = costs.filter(
    (item) => item.status !== "PAID" && item.status !== "REJECTED",
  ).length;

  return (
    <>
      <ScrollView
        {...scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_SCREEN_BOTTOM_SPACE + TAB_BAR_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl refreshing={query.isRefreshing} onRefresh={() => void query.refresh()} />
        }
      >
        <ScreenRefreshNotice query={query} />
        <SummarySurface amount={total} label="Total biaya tercatat">
          <View style={styles.summaryRow}>
            <FactRow label="Jumlah pengajuan" value={String(costs.length)} />
            <FactRow label="Masih diproses" value={String(pending)} />
          </View>
        </SummarySurface>

        {localDraft ? (
          <RowAction
            accessibilityLabel={`Lanjutkan draft biaya, ${localDraft.payload.lines.length} item tersimpan`}
            onPress={() => router.push("/expenses/new")}
            style={styles.draftSurface}
          >
            <View style={styles.draftIcon}>
              <AppIcon color={theme.colors.accent} name="edit_note" size={20} weight="bold" />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Lanjutkan draft biaya</Text>
              <Text style={styles.rowDescription}>
                {localDraft.payload.lines.length} item tersimpan di perangkat ini
              </Text>
            </View>
            <AppIcon color={theme.colors.onSurfaceVariant} name="chevron_right" size={18} />
          </RowAction>
        ) : null}

        {permissions.includes("create:cost") ? (
          <Button
            leading={<AppIcon color={theme.colors.onPrimary} name="add" size={18} weight="bold" />}
            onPress={() => router.push("/expenses/new")}
          >
            Catat biaya proyek
          </Button>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Biaya terbaru</Text>
          <GroupedSurface>
            {costs.length === 0 ? (
              <FactRow label="Biaya" value="Belum ada pengajuan" />
            ) : (
              costs.map((item) => (
                <View key={item.id} style={styles.listRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.description}</Text>
                    <Text style={styles.rowDescription}>
                      {item.project?.name ?? "Proyek tidak tersedia"} ·{" "}
                      {formatBusinessLabel(item.status)}
                    </Text>
                  </View>
                  <View style={styles.rowEnd}>
                    <MoneyValue
                      align="right"
                      amount={Number(item.amount)}
                      size="sm"
                      variant="compactWithFull"
                    />
                    <StatusBadge status={item.status} />
                  </View>
                </View>
              ))
            )}
          </GroupedSurface>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: theme.spacing.md,
  },
  summaryRow: {
    overflow: "hidden",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  draftSurface: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.md,
    boxShadow: theme.shadows.surface,
  },
  draftIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.accentContainer,
  },
  section: { gap: theme.spacing.sm },
  sectionTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  listRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  rowDescription: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  rowEnd: { maxWidth: "48%", alignItems: "flex-end", gap: theme.spacing.base },
});
