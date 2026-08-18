import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppIcon,
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  ScreenMessage,
  ScreenSkeleton,
  StatusBadge,
  SummarySurface,
} from "@/components/ui";
import { readLocalExpenseDraft } from "@/lib/draft-storage";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { TAB_SCREEN_BOTTOM_SPACE } from "@/constants/scroll-insets";
import { theme } from "@/theme";

export default function ExpensesScreen(): React.JSX.Element {
  const router = useRouter();
  const { roleName, user } = useAuth();
  const permissions = roleName ? (ROLE_PERMISSIONS[roleName] ?? []) : [];
  const localDraftQuery = useQuery({
    enabled: Boolean(user),
    queryKey: ["local-expense-draft", user?.id],
    queryFn: () => (user ? readLocalExpenseDraft(user.id) : Promise.resolve(null)),
  });
  const localDraft = localDraftQuery.data ?? null;
  const query = useQuery({
    queryKey: ["screen", "expenses"],
    queryFn: () => trpcClient.screen.expenses.query(),
  });

  if (query.isPending) return <ScreenSkeleton rows={5} />;
  if (query.isError) {
    return (
      <ScreenMessage
        description="Daftar biaya belum dapat dimuat. Periksa koneksi lalu coba lagi."
        onAction={() => void query.refetch()}
        title="Data belum tersedia"
      />
    );
  }
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: TAB_SCREEN_BOTTOM_SPACE }]}
      refreshControl={
        <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      }
    >
      <SummarySurface amount={total} label="Total biaya tercatat">
        <View style={styles.summaryRow}>
          <FactRow label="Jumlah pengajuan" value={String(costs.length)} />
          <FactRow label="Masih diproses" value={String(pending)} />
        </View>
      </SummarySurface>

      {localDraft ? (
        <Pressable onPress={() => router.push("/expenses/new")} style={styles.draftSurface}>
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
        </Pressable>
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
