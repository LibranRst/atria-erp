import { StyleSheet, Text, View } from "react-native";
import { getDashboardCashSummary } from "@atria/core/finance/dashboard-cash-summary";
import {
  BudgetSplitIndicator,
  Button,
  MoneyValue,
  RowGroup,
  StatusBadge,
  SummaryFact,
  SummarySurface,
} from "@/components/ui";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";
import {
  ApprovalQueueRow,
  BudgetCategoryRow,
  CashDueRow,
  DashboardEmpty,
  DashboardSection,
  MaterialIssueRow,
  ProjectRiskRow,
  styles,
} from "./dashboard-rows";
import { AccountIdentity } from "./account-identity";
import type { DashboardOverview } from "./types";

export function BudgetTab({ data }: { readonly data: DashboardOverview }): React.JSX.Element {
  const { summary } = data;
  const danger = summary.remainingBudget < 0 || summary.usedPercentage >= 100;
  const criticalCategories = data.categories.filter(
    (category) => category.status === "CRITICAL" || category.status === "OVER_BUDGET",
  );
  return (
    <>
      <SummarySurface
        accessibilityLabel="Posisi budget portfolio"
        eyebrow="Portfolio budget"
        icon="account_balance_wallet"
        status={danger ? "Perlu tindakan" : "Terkendali"}
        statusTone={danger ? "critical" : "positive"}
      >
        <View style={tabStyles.summaryBody}>
          <View style={styles.metrics}>
            <View style={tabStyles.comparison}>
              <Text style={styles.metricLabel}>Internal budget</Text>
              <MoneyValue amount={summary.internalBudget} variant="compact" size="lg" />
            </View>
            <View style={tabStyles.comparison}>
              <Text style={[styles.metricLabel, styles.right]}>Aktual terpakai</Text>
              <MoneyValue
                amount={summary.actualCost}
                variant="compact"
                size="lg"
                align="right"
                tone={danger ? "danger" : "default"}
              />
            </View>
          </View>
          <BudgetSplitIndicator
            value={summary.usedPercentage}
            danger={danger}
            usedAmount={summary.actualCost}
            remainingAmount={summary.remainingBudget}
          />
        </View>
        <View style={tabStyles.summaryFacts}>
          <SummaryFact
            label="Sisa"
            amount={summary.remainingBudget}
            tone={danger ? "danger" : "positive"}
          />
          <SummaryFact
            label="Margin proyeksi"
            value={summary.projectedMarginPercentage.toFixed(1) + "%"}
            tone={summary.projectedMarginPercentage < 0 ? "danger" : "default"}
          />
        </View>
      </SummarySurface>
      <DashboardSection
        title="Project berisiko"
        destination="/projects?filter=WARNING"
        actionLabel="Buka project"
        count={data.dashboardTabs.counts.budget}
      >
        {data.dashboardDetails.budgetRisks.length === 0 ? (
          <DashboardEmpty>Semua project aktif masih dalam batas budget.</DashboardEmpty>
        ) : (
          <RowGroup>
            {data.dashboardDetails.budgetRisks.map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
      <DashboardSection
        title="Kesehatan kategori"
        destination="/projects"
        actionLabel="Lihat project"
      >
        {data.categories.length === 0 ? (
          <DashboardEmpty>Budget kategori project aktif belum tersedia.</DashboardEmpty>
        ) : (
          <>
            <Text style={tabStyles.sectionNote}>
              {criticalCategories.length > 0
                ? criticalCategories.length + " kategori perlu perhatian di seluruh project."
                : "Semua kategori masih terkendali."}
            </Text>
            <RowGroup>
              {data.categories.map((category) => (
                <BudgetCategoryRow key={category.code} category={category} />
              ))}
            </RowGroup>
          </>
        )}
      </DashboardSection>
    </>
  );
}

export function CashDueTab({ data }: { readonly data: DashboardOverview }): React.JSX.Element {
  const groups = data.dashboardDetails.cashDueGroups;
  const cash = getDashboardCashSummary(
    groups,
    data.summary.cashAvailable,
    data.summary.payablesDueSoon,
  );
  const coverage = cash.cashCoverageRatio;
  const groupsWithItems = groups.filter((group) => group.count > 0);
  return (
    <>
      <SummarySurface
        accessibilityLabel="Urgensi jatuh tempo"
        eyebrow="Jadwal kas terdekat"
        icon="event_upcoming"
        status={
          cash.overdueCount > 0 ? cash.overdueCount + " terlambat" : "Tidak ada keterlambatan"
        }
        statusTone={cash.overdueCount > 0 ? "critical" : "positive"}
      >
        <View style={[tabStyles.summaryBody, styles.rowHeading]}>
          <View style={tabStyles.comparison}>
            <Text style={styles.metricLabel}>Outstanding 7 hari</Text>
            <MoneyValue
              amount={cash.outstandingAmount}
              variant="fullDynamic"
              size="lg"
              tone={cash.payablesAmount > data.summary.cashAvailable ? "danger" : "default"}
            />
          </View>
          <View style={tabStyles.coverage}>
            <Text style={[styles.metricLabel, styles.right]}>Cakupan kas</Text>
            <Text
              selectable
              style={[
                styles.title,
                styles.right,
                coverage !== null && coverage < 1 && styles.danger,
              ]}
            >
              {coverage === null
                ? "Tidak ada hutang"
                : coverage.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "×"}
            </Text>
          </View>
        </View>
        <View style={tabStyles.summaryFacts}>
          <SummaryFact
            label="Terlambat"
            value={String(cash.overdueCount)}
            tone={cash.overdueCount > 0 ? "danger" : "default"}
          />
          <SummaryFact
            label="Hari ini"
            value={String(cash.todayCount)}
            tone={cash.todayCount > 0 ? "warning" : "default"}
          />
          <SummaryFact
            label="7 hari"
            value={String(cash.nextSevenDaysCount)}
            tone={cash.nextSevenDaysCount > 0 ? "warning" : "positive"}
          />
        </View>
        <Text style={tabStyles.explanation}>
          Outstanding mencakup hutang dan piutang; cakupan kas membandingkan kas dengan hutang jatuh
          tempo.
        </Text>
      </SummarySurface>
      {groupsWithItems.length === 0 ? (
        <DashboardSection title="Jadwal pembayaran">
          <DashboardEmpty>Tidak ada tagihan atau invoice terbuka.</DashboardEmpty>
        </DashboardSection>
      ) : (
        groupsWithItems.map((group) => (
          <DashboardSection
            key={group.bucket}
            title={group.label}
            destination={group.bucket === "LATER" ? "/expenses?view=vendor-bills" : undefined}
          >
            <View style={tabStyles.groupTotal}>
              <Text style={styles.meta}>{group.count} dokumen</Text>
              <MoneyValue
                amount={group.totalOutstanding}
                variant="compact"
                size="sm"
                align="right"
                tone={group.bucket === "OVERDUE" ? "danger" : "default"}
              />
            </View>
            <RowGroup connected>
              {group.items.map((item) => (
                <CashDueRow key={item.type + "-" + item.id} item={item} />
              ))}
            </RowGroup>
          </DashboardSection>
        ))
      )}
    </>
  );
}

export function MaterialsTab({ data }: { readonly data: DashboardOverview }): React.JSX.Element {
  const budget = data.categories.find((item) => item.code === "MATERIAL");
  const shortages = data.dashboardDetails.materials.filter(
    (item) => item.type === "RAP_SHORTAGE" || item.type === "LOW_STOCK",
  );
  const reviews = data.dashboardDetails.materials.filter(
    (item) => item.type === "REVERSAL_REQUEST",
  );
  const activity = data.dashboardDetails.materials.filter(
    (item) => item.type === "WASTE" || item.type === "ADJUSTMENT",
  );
  const attention =
    data.stockIssues.materialShortageCount > 0 || data.stockIssues.lowStockCount > 0;
  return (
    <>
      <SummarySurface
        accessibilityLabel="Posisi stok material"
        eyebrow="Posisi stok"
        icon="inventory_2"
        status={attention ? "Perlu perhatian" : "Terkendali"}
        statusTone={attention ? "warning" : "positive"}
      >
        <View style={[tabStyles.summaryBody, styles.metrics]}>
          <View style={tabStyles.comparison}>
            <Text style={styles.metricLabel}>Stok tersedia</Text>
            <MoneyValue amount={data.stockIssues.reusableStockValue} variant="compact" size="lg" />
          </View>
          <View style={tabStyles.comparison}>
            <Text style={[styles.metricLabel, styles.right]}>Total nilai stok</Text>
            <MoneyValue
              amount={data.stockIssues.totalStockValue}
              variant="compact"
              size="lg"
              align="right"
            />
          </View>
        </View>
        {budget ? (
          <View style={tabStyles.materialBudget}>
            <View style={styles.rowHeading}>
              <View style={styles.copy}>
                <Text style={styles.metricLabel}>Budget kategori Material</Text>
                <Text style={styles.meta}>{budget.usedPercentage.toFixed(0)}% terpakai</Text>
              </View>
              <MoneyValue
                amount={budget.allocatedAmount}
                variant="compact"
                size="sm"
                align="right"
              />
            </View>
            <BudgetSplitIndicator
              value={budget.usedPercentage}
              danger={budget.remainingAmount < 0}
              usedAmount={budget.actualAmount}
              remainingAmount={budget.remainingAmount}
            />
          </View>
        ) : null}
        <View style={tabStyles.materialStatus}>
          <Text style={[styles.meta, data.stockIssues.materialShortageCount > 0 && styles.warning]}>
            {data.stockIssues.materialShortageCount > 0
              ? data.stockIssues.materialShortageCount + " kebutuhan RAP belum terpenuhi"
              : "Kebutuhan RAP terpenuhi"}
          </Text>
          <StatusBadge
            status={data.stockIssues.lowStockCount > 0 ? "WATCH" : "HEALTHY"}
            tone={data.stockIssues.lowStockCount > 0 ? "warning" : "healthy"}
            marker={false}
            label={data.stockIssues.lowStockCount + " stok rendah"}
          />
        </View>
      </SummarySurface>
      <DashboardSection
        title="Risiko pemenuhan"
        destination="/materials?tab=needs"
        actionLabel="Buka kebutuhan"
        count={shortages.length}
      >
        {shortages.length === 0 ? (
          <DashboardEmpty>Tidak ada kekurangan RAP atau stok rendah aktif.</DashboardEmpty>
        ) : (
          <RowGroup>
            {shortages.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
      {reviews.length > 0 ? (
        <DashboardSection
          title="Perlu keputusan"
          destination="/materials?tab=overview"
          actionLabel="Tinjau"
          count={reviews.length}
        >
          <RowGroup>
            {reviews.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        </DashboardSection>
      ) : null}
      <DashboardSection
        title="Waste dan penyesuaian"
        destination="/materials?tab=activity"
        actionLabel="Buka aktivitas"
      >
        {activity.length === 0 ? (
          <DashboardEmpty>Tidak ada waste atau penyesuaian terbaru.</DashboardEmpty>
        ) : (
          <RowGroup>
            {activity.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
    </>
  );
}

export function AccountsTab({ data }: { readonly data: DashboardOverview }): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const { permissions } = useAuth();
  if (!permissions.includes("view:bank_account")) {
    return (
      <DashboardSection title="Rekening">
        <DashboardEmpty>Akun ini tidak memiliki izin melihat rekening.</DashboardEmpty>
      </DashboardSection>
    );
  }
  const total = data.bankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const unreconciled = data.bankAccounts.reduce(
    (sum, account) =>
      sum + account.recentTransactions.filter((transaction) => !transaction.reconciled).length,
    0,
  );
  const coverage = data.summary.payablesDueSoon > 0 ? total / data.summary.payablesDueSoon : null;
  const canCreate = permissions.includes("create:bank_account");
  return (
    <>
      <SummarySurface
        accessibilityLabel="Posisi kas rekening"
        eyebrow="Posisi kas"
        icon="account_balance"
        status={unreconciled > 0 ? unreconciled + " belum rekonsiliasi" : "Rekonsiliasi selesai"}
        statusTone={unreconciled > 0 ? "warning" : "positive"}
      >
        <View style={tabStyles.summaryBody}>
          <Text style={styles.metricLabel}>Total saldo kas</Text>
          <MoneyValue
            amount={total}
            variant="fullDynamic"
            size="hero"
            tone={total < 0 ? "danger" : "default"}
          />
        </View>
        <View style={tabStyles.summaryFacts}>
          <SummaryFact
            label="Rekening aktif"
            value={String(data.bankAccounts.filter((item) => item.isActive).length)}
          />
          <SummaryFact
            label="Rekonsiliasi"
            value={unreconciled > 0 ? unreconciled + " terbuka" : "Selesai"}
            tone={unreconciled > 0 ? "warning" : "positive"}
          />
          <SummaryFact
            label="Cakupan dekat"
            value={coverage === null ? "Aman" : coverage.toFixed(1) + "×"}
            tone={coverage !== null && coverage < 1 ? "danger" : "positive"}
          />
        </View>
      </SummarySurface>
      <DashboardSection
        title="Posisi rekening"
        grouped={data.bankAccounts.length === 0}
        action={
          canCreate ? (
            <Button
              variant="secondary"
              size="compact"
              accessibilityHint="Membuka pengelolaan rekening di web."
              onPress={() => navigate("/ledger?tab=accounts&bank-action=create", true)}
            >
              Tambah rekening
            </Button>
          ) : undefined
        }
      >
        {data.bankAccounts.length === 0 ? (
          <DashboardEmpty>
            {canCreate
              ? "Belum ada rekening tercatat. Tambahkan rekening untuk mulai mengelola kas."
              : "Belum ada rekening tercatat. Owner dapat menambahkan rekening."}
          </DashboardEmpty>
        ) : (
          <>
            <Text style={tabStyles.accountGuide}>
              Pilih rekening untuk melihat transaksi dan tindakan.
            </Text>
            {data.bankAccounts.map((account) => (
              <AccountIdentity
                key={account.id}
                account={account}
                onPress={() =>
                  navigate("/ledger?tab=accounts&account=" + encodeURIComponent(account.id))
                }
              />
            ))}
          </>
        )}
      </DashboardSection>
    </>
  );
}

export function ApprovalsTab({ data }: { readonly data: DashboardOverview }): React.JSX.Element {
  const summary = data.dashboardDetails.approvalSummary;
  return (
    <>
      <SummarySurface
        accessibilityLabel="Antrean keputusan"
        eyebrow="Antrean keputusan"
        icon="approval"
        status={summary.totalCount > 0 ? "Perlu ditinjau" : "Selesai"}
        statusTone={summary.totalCount > 0 ? "warning" : "positive"}
      >
        <View style={[tabStyles.summaryBody, styles.rowHeading]}>
          <View style={tabStyles.comparison}>
            <Text selectable style={tabStyles.queueCount}>
              {summary.totalCount}
            </Text>
            <Text style={styles.meta}>persetujuan menunggu keputusan</Text>
          </View>
          <View style={tabStyles.queueAmount}>
            <Text style={[styles.metricLabel, styles.right]}>Total antrean</Text>
            <MoneyValue amount={summary.totalAmount} variant="compact" size="lg" align="right" />
          </View>
        </View>
        <View style={tabStyles.summaryFacts}>
          <SummaryFact
            label="Prioritas kritis"
            value={String(summary.criticalCount)}
            tone={summary.criticalCount > 0 ? "danger" : "default"}
          />
          <SummaryFact
            label="Menunggu ≥3 hari"
            value={String(summary.waitingLongCount)}
            tone={summary.waitingLongCount > 0 ? "warning" : "positive"}
          />
        </View>
      </SummarySurface>
      <DashboardSection title="Urutan prioritas" destination="/approvals" actionLabel="Buka semua">
        {data.dashboardDetails.approvals.length === 0 ? (
          <DashboardEmpty>
            Tidak ada persetujuan tertunda. Semua keputusan saat ini sudah ditangani.
          </DashboardEmpty>
        ) : (
          <>
            <Text style={tabStyles.priorityNote}>
              Diurutkan berdasarkan risiko budget, jatuh tempo, lama menunggu, dan nominal.
            </Text>
            <RowGroup>
              {data.dashboardDetails.approvals.map((item) => (
                <ApprovalQueueRow key={item.id} item={item} />
              ))}
            </RowGroup>
          </>
        )}
      </DashboardSection>
    </>
  );
}

const tabStyles = StyleSheet.create({
  summaryBody: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.base,
  },
  comparison: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  summaryFacts: { flexDirection: "row", gap: theme.spacing.xs, padding: theme.spacing.xs },
  coverage: { maxWidth: "38%", gap: theme.spacing.base },
  explanation: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  sectionNote: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
    padding: theme.spacing.sm,
  },
  groupTotal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
    margin: theme.spacing.sm,
    padding: theme.spacing.xs,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  materialBudget: {
    marginHorizontal: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLowest,
    gap: theme.spacing.xs,
  },
  materialStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceContainerLowest,
    margin: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderRadius: theme.radii.inset,
  },
  accountGuide: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.xs,
  },
  queueCount: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.extrabold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  queueAmount: { maxWidth: "45%", minWidth: 0, gap: theme.spacing.base },
  priorityNote: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
    padding: theme.spacing.xs,
    margin: theme.spacing.sm,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
});
