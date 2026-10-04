import { Text, View } from "react-native";
import {
  AppIcon,
  Button,
  DuotoneIconTile,
  GroupedSurface,
  RowAction,
  RowGroup,
} from "@/components/ui";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";
import {
  CashDueRow,
  CashTransactionRow,
  DashboardEmpty,
  DashboardSection,
  MaterialIssueRow,
  ProjectRiskRow,
  styles,
} from "./dashboard-rows";
import { FinancialPosition } from "./financial-position";
import type { DashboardReady } from "./types";

export function DashboardOverviewTab({
  data,
}: {
  readonly data: DashboardReady;
}): React.JSX.Element {
  const { permissions } = useAuth();
  const navigate = useAtriaNavigation();
  const { overview, setup } = data;
  const needsSetup =
    setup && (setup.quickStart.state.status !== "COMPLETED" || !setup.allRequiredReady);
  const quickStartIncomplete = setup?.quickStart.state.status !== "COMPLETED";
  const setupTitle = quickStartIncomplete
    ? !setup?.canManageQuickStart
      ? "Quick start menunggu Owner"
      : setup.quickStart.state.status === "PAUSED"
        ? "Quick start dijeda"
        : "Lanjutkan project pertama"
    : `${(setup?.requiredTotal ?? 0) - (setup?.requiredReadyCount ?? 0)} fondasi wajib tersisa`;
  const nextDue = overview.dashboardDetails.cashDueGroups
    .flatMap((group) => group.items)
    .slice(0, 3);
  const materialAttention = overview.dashboardDetails.materials
    .filter((item) => item.severity !== "INFO")
    .slice(0, 3);
  return (
    <>
      <FinancialPosition summary={overview.summary} />
      {needsSetup && setup ? (
        <GroupedSurface>
          <View style={styles.row}>
            <Text style={styles.title}>{setupTitle}</Text>
            <Text style={styles.meta}>
              {quickStartIncomplete
                ? "Lengkapi default finansial dan project pertama."
                : "Lengkapi sesuai peran tanpa menghambat perencanaan project Draft."}
            </Text>
            <Text style={styles.meta}>
              {quickStartIncomplete
                ? `${setup.quickStart.progress.current}/${setup.quickStart.progress.total} tahap`
                : `${setup.requiredReadyCount}/${setup.requiredTotal} wajib siap`}
            </Text>
            <Button
              variant="secondary"
              onPress={() =>
                navigate(
                  quickStartIncomplete && setup.canManageQuickStart
                    ? "/onboarding"
                    : "/settings?tab=readiness",
                )
              }
            >
              {quickStartIncomplete && setup.canManageQuickStart
                ? "Lanjutkan di web"
                : "Lihat checklist di web"}
            </Button>
          </View>
        </GroupedSurface>
      ) : null}
      <DashboardSection
        title={
          permissions.includes("decide:all_approvals") ? "Perlu keputusan" : "Prioritas finance"
        }
        destination={
          permissions.includes("decide:all_approvals")
            ? "/ledger?tab=approvals"
            : "/ledger?tab=cash"
        }
      >
        {overview.actions.length === 0 ? (
          <DashboardEmpty>
            Tidak ada tindakan mendesak. Kondisi utama sudah terkendali.
          </DashboardEmpty>
        ) : (
          <RowGroup>
            {overview.actions.map((action) => (
              <RowAction
                key={action.id}
                accessibilityLabel={`${action.title}, ${action.severity === "CRITICAL" ? "Kritis" : "Perhatian"}`}
                onPress={() => navigate(action.href)}
                style={[styles.row, styles.rowHeading]}
              >
                <DuotoneIconTile
                  name={
                    action.id === "approvals"
                      ? "approval"
                      : action.id === "project-risk"
                        ? "analytics"
                        : action.id === "overdue-payables"
                          ? "request_quote"
                          : action.id === "overdue-receivables"
                            ? "payments"
                            : "inventory_2"
                  }
                  tone={action.severity === "CRITICAL" ? "critical" : "attention"}
                  iconSize={18}
                  style={styles.identityTile}
                />
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.title}>
                    {action.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {action.description}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusText,
                    action.severity === "CRITICAL" ? styles.danger : styles.warning,
                  ]}
                >
                  {action.severity === "CRITICAL" ? "Kritis" : "Perhatian"}
                </Text>
                <AppIcon name="chevron_right" size={14} color={theme.colors.muted} />
              </RowAction>
            ))}
          </RowGroup>
        )}
      </DashboardSection>
      <DashboardSection title="Project berisiko" destination="/ledger?tab=budget">
        {overview.riskyProjects.length === 0 ? (
          <DashboardEmpty>Semua project aktif masih dalam batas budget.</DashboardEmpty>
        ) : (
          <RowGroup>
            {overview.riskyProjects.slice(0, 3).map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} compact />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
      <DashboardSection title="Jatuh tempo terdekat" destination="/ledger?tab=cash">
        {nextDue.length === 0 ? (
          <DashboardEmpty>Tidak ada tagihan atau invoice terbuka.</DashboardEmpty>
        ) : (
          <RowGroup connected>
            {nextDue.map((item) => (
              <CashDueRow key={`${item.type}-${item.id}`} item={item} compact />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
      <DashboardSection title="Perhatian material" destination="/ledger?tab=materials">
        {materialAttention.length === 0 ? (
          <DashboardEmpty>Tidak ada masalah material aktif.</DashboardEmpty>
        ) : (
          <RowGroup>
            {materialAttention.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
      <DashboardSection title="Perubahan kas terbaru" destination="/ledger?tab=accounts">
        {overview.recentTransactions.length === 0 ? (
          <DashboardEmpty>Belum ada transaksi kas.</DashboardEmpty>
        ) : (
          <RowGroup>
            {overview.recentTransactions.slice(0, 3).map((item) => (
              <CashTransactionRow key={item.id} item={item} />
            ))}
          </RowGroup>
        )}
      </DashboardSection>
    </>
  );
}
