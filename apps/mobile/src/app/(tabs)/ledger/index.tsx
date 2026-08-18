import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import type {
  DashboardPageTab,
  FinanceDashboardAction,
  FinanceDashboardCategory,
} from "@atria/core/finance/dashboard-overview";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppIcon,
  BudgetSplitIndicator,
  DuotoneIconTile,
  FactRow,
  GroupedSurface,
  MetricPill,
  MoneyValue,
  ScreenMessage,
  ScreenSkeleton,
  SegmentedTabs,
  StatusBadge,
  SummarySurface,
} from "@/components/ui";
import { trpcClient } from "@/lib/trpc-client";
import { TAB_SCREEN_BOTTOM_SPACE } from "@/constants/scroll-insets";
import { theme } from "@/theme";

const tabs: readonly {
  readonly icon: string;
  readonly label: string;
  readonly value: DashboardPageTab;
}[] = [
  { value: "overview", label: "Ringkasan", icon: "space_dashboard" },
  { value: "approvals", label: "Persetujuan", icon: "approval" },
  { value: "budget", label: "Budget", icon: "monitoring" },
  { value: "cash", label: "Jatuh tempo", icon: "event_busy" },
  { value: "accounts", label: "Rekening", icon: "account_balance" },
  { value: "materials", label: "Material", icon: "inventory_2" },
];

/** Sama dengan `priorityActionIcon` web — memetakan id blocker dashboard ke ikon. */
function priorityActionIcon(id: string): string {
  if (id === "approvals") return "approval";
  if (id === "project-risk") return "analytics";
  if (id === "overdue-payables") return "request_quote";
  if (id === "overdue-receivables") return "payments";
  if (id === "material-risk") return "inventory_2";
  return "notification_important";
}

/** Tujuan tab dashboard yang relevan untuk tiap blocker id — pengganti `href` web. */
function priorityActionTab(id: string): DashboardPageTab {
  if (id === "approvals") return "approvals";
  if (id === "project-risk") return "budget";
  if (id === "material-risk") return "materials";
  return "cash";
}

function approvalPreviewIcon(type: ApprovalDetail["type"]): string {
  if (type === "project_cost") return "receipt_long";
  if (type === "inventory_opening") return "inventory";
  return "request_quote";
}

type CashDueItem = {
  readonly id: string;
  readonly type: "payable" | "receivable";
  readonly outstandingAmount: number;
  readonly projectName: string;
  readonly counterpartyName: string;
  readonly bucket: string;
};

type BankAccountItem = {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly balance: number;
};

type MaterialIssue = {
  readonly id: string;
  readonly type: string;
  readonly materialName: string;
  readonly description: string;
  readonly severity: string;
};

function percent(value: number): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function SectionTitle({ children }: { readonly children: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function LedgerScreen(): React.JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<DashboardPageTab>("overview");
  const query = useQuery({
    queryKey: ["screen", "ledger"],
    queryFn: () => trpcClient.screen.ledger.query(),
  });

  if (query.isPending) return <ScreenSkeleton rows={5} />;
  if (query.isError) {
    return (
      <ScreenMessage
        description="Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi."
        onAction={() => void query.refetch()}
        title="Data belum tersedia"
      />
    );
  }
  if (!query.data || query.data.status === "restricted") {
    return (
      <ScreenMessage
        description="Dashboard keuangan hanya tersedia untuk Owner dan Admin Keuangan."
        icon="lock"
        title="Akses dibatasi"
      />
    );
  }
  if (query.data.status === "error") {
    return (
      <ScreenMessage
        description={query.data.message}
        onAction={() => void query.refetch()}
        title="Dashboard belum siap"
      />
    );
  }

  const { overview, userName } = query.data;
  const counts = overview.dashboardTabs.counts;
  const tabOptions = tabs.map((item) => ({
    ...item,
    badge:
      item.value === "overview"
        ? undefined
        : item.value === "cash"
          ? counts.cash
          : counts[item.value],
  }));

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-lg px-margin-mobile pt-md"
      contentContainerStyle={{ paddingBottom: TAB_SCREEN_BOTTOM_SPACE }}
      refreshControl={
        <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      }
    >
      <View className="gap-base">
        <Text className="font-sans-extrabold text-title tracking-[-0.5px] text-on-surface">
          Selamat datang, {userName.split(" ")[0]}
        </Text>
        <Text className="font-sans text-support text-on-surface-variant">
          Kondisi keuangan dan material yang perlu Anda putuskan.
        </Text>
      </View>

      <SegmentedTabs
        accessibilityLabel="Bagian dashboard"
        onChange={setTab}
        options={tabOptions}
        scrollable
        value={tab}
      />

      {tab === "overview" ? (
        <>
          <View
            className="rounded-owner bg-surface-inverse p-md"
            style={{ boxShadow: theme.shadows.inverse }}
          >
            <Text className="font-sans-bold text-eyebrow tracking-[1.2px] text-white/52 uppercase">
              Kas tersedia
            </Text>
            <MoneyValue
              amount={overview.summary.cashAvailable}
              size="hero"
              tone="inverse"
              variant="fullDynamic"
            />

            <View className="mt-md flex-row gap-sm">
              <View className="min-w-0 flex-1 gap-base rounded-inset bg-white/10 p-sm">
                <Text className="font-sans-bold text-eyebrow tracking-[1px] text-white/52 uppercase">
                  Piutang
                </Text>
                <MoneyValue
                  amount={overview.summary.receivablesOutstanding}
                  size="sm"
                  tone="inverse"
                  variant="compact"
                />
              </View>
              <View className="min-w-0 flex-1 gap-base rounded-inset bg-white/10 p-sm">
                <Text className="font-sans-bold text-eyebrow tracking-[1px] text-white/52 uppercase">
                  Hutang
                </Text>
                <MoneyValue
                  amount={overview.summary.payablesOutstanding}
                  size="sm"
                  tone="inverse"
                  variant="compact"
                />
              </View>
              <View className="min-w-0 flex-1 gap-base rounded-inset bg-white/10 p-sm">
                <Text className="font-sans-bold text-eyebrow tracking-[1px] text-white/52 uppercase">
                  ≤ 7 hari
                </Text>
                <MoneyValue
                  amount={overview.summary.payablesDueSoon}
                  size="sm"
                  textStyle={
                    overview.summary.payablesDueSoon > overview.summary.cashAvailable
                      ? { color: theme.colors.criticalOnInverse }
                      : undefined
                  }
                  tone="inverse"
                  variant="compact"
                />
              </View>
            </View>

            <View className="mt-md rounded-inset bg-white/10 p-sm">
              <View className="flex-row justify-between">
                <Text className="font-sans-bold text-eyebrow tracking-[0.6px] text-white/50 uppercase">
                  Budget aktif terpakai
                </Text>
                <Text className="font-sans-bold text-eyebrow tracking-[0.6px] text-white/50 uppercase">
                  Sisa budget
                </Text>
              </View>
              <View className="mt-base flex-row items-end justify-between">
                <Text
                  className={`font-sans-extrabold text-section tabular-nums ${
                    overview.summary.remainingBudget < 0 || overview.summary.usedPercentage >= 100
                      ? "text-critical-on-inverse"
                      : "text-on-surface-inverse"
                  }`}
                >
                  {overview.summary.usedPercentage.toFixed(1)}%
                </Text>
                <MoneyValue
                  align="right"
                  amount={overview.summary.remainingBudget}
                  size="sm"
                  tone={
                    overview.summary.remainingBudget < 0 || overview.summary.usedPercentage >= 100
                      ? "danger"
                      : "inverse"
                  }
                  variant="compact"
                />
              </View>
              <BudgetSplitIndicator
                danger={
                  overview.summary.remainingBudget < 0 || overview.summary.usedPercentage >= 100
                }
                inverse
                remainingAmount={overview.summary.remainingBudget}
                usedAmount={overview.summary.actualCost}
                value={overview.summary.usedPercentage}
              />
              <View className="mt-sm flex-row justify-between">
                <Text className="font-sans-semibold text-meta text-white/58">Project aktif</Text>
                <Text className="font-sans-semibold text-meta text-white/58">
                  Margin proyeksi {overview.summary.projectedMarginPercentage.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-sm">
            <SectionTitle>
              {overview.role === "OWNER" ? "Perlu keputusan" : "Prioritas finance"}
            </SectionTitle>
            <GroupedSurface>
              {overview.actions.length === 0 ? (
                <FactRow label="Kondisi" value="Tidak ada tindakan mendesak" />
              ) : (
                overview.actions.map((action: FinanceDashboardAction) => {
                  const critical = action.severity === "CRITICAL";
                  return (
                    <Pressable
                      key={action.id}
                      className="min-h-16 flex-row items-center gap-sm px-md py-sm"
                      onPress={() => setTab(priorityActionTab(action.id))}
                    >
                      <DuotoneIconTile
                        name={priorityActionIcon(action.id)}
                        tone={critical ? "critical" : "attention"}
                      />
                      <View className="min-w-0 flex-1 gap-0.5">
                        <Text
                          className="font-sans-bold text-support text-on-surface"
                          numberOfLines={1}
                        >
                          {action.title}
                        </Text>
                        <Text
                          className="font-sans text-meta text-on-surface-variant"
                          numberOfLines={1}
                        >
                          {action.description}
                        </Text>
                      </View>
                      <View className="min-w-[76px] shrink-0 items-end gap-base">
                        <Text
                          className={`font-sans-semibold text-eyebrow ${
                            critical ? "text-critical" : "text-warning"
                          }`}
                        >
                          {critical ? "Kritis" : "Perhatian"}
                        </Text>
                        <AppIcon
                          color={theme.colors.onSurfaceVariant}
                          name="chevron_right"
                          size={16}
                        />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </GroupedSurface>
          </View>
        </>
      ) : null}

      {tab === "approvals" ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionTitle>Antrean keputusan</SectionTitle>
            <Pressable onPress={() => router.push("/approvals")} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Buka semua</Text>
            </Pressable>
          </View>
          <SummarySurface
            amount={overview.dashboardDetails.approvalSummary.totalAmount}
            label="Nilai menunggu"
          >
            <View style={styles.metricRow}>
              <MetricPill
                amount={overview.dashboardDetails.approvalSummary.totalCount}
                format="count"
                label="Total item"
              />
              <MetricPill
                amount={overview.dashboardDetails.approvalSummary.criticalCount}
                format="count"
                label="Kritis"
                tone="danger"
              />
            </View>
          </SummarySurface>
          <GroupedSurface>
            {overview.dashboardDetails.approvals.length === 0 ? (
              <FactRow label="Antrean" value="Tidak ada persetujuan" />
            ) : (
              overview.dashboardDetails.approvals.map((item: ApprovalDetail) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push("/approvals")}
                  style={styles.decisionRow}
                >
                  <DuotoneIconTile
                    name={approvalPreviewIcon(item.type)}
                    tone={item.priority === "CRITICAL" ? "critical" : "attention"}
                  />
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {item.description}
                    </Text>
                    <Text numberOfLines={1} style={styles.rowDescription}>
                      {item.projectName} · {item.requestedBy}
                    </Text>
                  </View>
                  <View style={styles.decisionTrailing}>
                    <MoneyValue align="right" amount={item.amount} size="sm" variant="compact" />
                    <AppIcon color={theme.colors.onSurfaceVariant} name="chevron_right" size={16} />
                  </View>
                </Pressable>
              ))
            )}
          </GroupedSurface>
        </View>
      ) : null}

      {tab === "budget" ? (
        <View style={styles.section}>
          <SectionTitle>Budget per kategori</SectionTitle>
          <GroupedSurface>
            {overview.categories.map((category: FinanceDashboardCategory) => (
              <View key={category.code} style={styles.listRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{category.name}</Text>
                  <Text style={styles.rowDescription}>
                    {percent(category.usedPercentage)} terpakai
                  </Text>
                </View>
                <View style={styles.rowEnd}>
                  <MoneyValue
                    align="right"
                    amount={category.remainingAmount}
                    size="sm"
                    variant="compactWithFull"
                  />
                  <StatusBadge status={category.status} />
                </View>
              </View>
            ))}
          </GroupedSurface>
        </View>
      ) : null}

      {tab === "cash" ? (
        <View style={styles.section}>
          <SectionTitle>Jatuh tempo</SectionTitle>
          <GroupedSurface>
            {overview.dashboardDetails.cashDue.length === 0 ? (
              <FactRow label="Dokumen" value="Tidak ada tagihan terbuka" />
            ) : (
              overview.dashboardDetails.cashDue.map((item: CashDueItem) => (
                <View key={`${item.type}-${item.id}`} style={styles.listRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.counterpartyName}</Text>
                    <Text style={styles.rowDescription}>
                      {item.projectName} · {formatBusinessLabel(item.bucket)}
                    </Text>
                  </View>
                  <MoneyValue
                    align="right"
                    amount={item.outstandingAmount}
                    size="sm"
                    variant="compactWithFull"
                  />
                </View>
              ))
            )}
          </GroupedSurface>
        </View>
      ) : null}

      {tab === "accounts" ? (
        <View style={styles.section}>
          <SectionTitle>Rekening aktif</SectionTitle>
          <GroupedSurface>
            {overview.bankAccounts.map((account: BankAccountItem) => (
              <View key={account.id} style={styles.listRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{account.name}</Text>
                  <Text style={styles.rowDescription}>
                    {account.bankName} · •••• {account.accountNumber.slice(-4)}
                  </Text>
                </View>
                <MoneyValue
                  align="right"
                  amount={account.balance}
                  size="sm"
                  variant="compactWithFull"
                />
              </View>
            ))}
          </GroupedSurface>
        </View>
      ) : null}

      {tab === "materials" ? (
        <View style={styles.section}>
          <SummarySurface amount={overview.stockIssues.totalStockValue} label="Nilai stok">
            <View style={styles.metricRow}>
              <MetricPill
                amount={overview.stockIssues.materialShortageCount}
                format="count"
                label="Kekurangan"
                tone="danger"
              />
              <MetricPill
                amount={overview.stockIssues.lowStockCount}
                format="count"
                label="Stok rendah"
                tone="warning"
              />
            </View>
          </SummarySurface>
          <SectionTitle>Isu material</SectionTitle>
          <GroupedSurface>
            {overview.dashboardDetails.materials.length === 0 ? (
              <FactRow label="Material" value="Tidak ada isu aktif" />
            ) : (
              overview.dashboardDetails.materials.map((item: MaterialIssue) => (
                <View key={`${item.type}-${item.id}`} style={styles.listRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.materialName}</Text>
                    <Text style={styles.rowDescription}>{item.description}</Text>
                  </View>
                  <StatusBadge status={item.severity} />
                </View>
              ))
            )}
          </GroupedSurface>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  metricRow: { flexDirection: "row", gap: theme.spacing.sm },
  listRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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
  linkButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: theme.spacing.sm },
  linkLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  decisionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  decisionTrailing: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: theme.spacing.base,
    minWidth: 76,
  },
});
