import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { isCashInflow } from "@atria/core/finance/cash-direction";
import { formatIdr, formatShortIdr } from "@atria/core/utils/money";
import {
  formatDashboardMaterialQuantity,
  hasDashboardMaterialStockContext,
} from "@atria/core/presentation/dashboard-material-quantity";
import {
  AppIcon,
  BudgetSplitIndicator,
  Button,
  DuotoneIconTile,
  GroupedSurface,
  MoneyValue,
  RowAction,
  StatusBadge,
} from "@/components/ui";
import { resolveAppDestination } from "@/lib/app-destination";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { theme } from "@/theme";
import type {
  CashDue,
  CashTransaction,
  DashboardOverview,
  MaterialIssue,
  RiskyProject,
} from "./types";

export function DashboardSection({
  title,
  destination,
  actionLabel = "Lihat semua",
  action,
  children,
  grouped = true,
  count,
}: {
  readonly title: string;
  readonly destination?: string;
  readonly actionLabel?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly grouped?: boolean;
  readonly count?: number;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const web = destination && resolveAppDestination(destination)?.kind === "web";
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {count !== undefined && count > 0 ? (
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCount}>{count}</Text>
            </View>
          ) : null}
        </View>
        {action ??
          (destination ? (
            <Button
              variant="section"
              size="compact"
              trailingSystemImage="chevron.right"
              trailing={
                <AppIcon name="chevron_right" size={11} color={theme.colors.onSurfaceVariant} />
              }
              accessibilityLabel={actionLabel + ", " + title}
              accessibilityHint={web ? "Membuka halaman web." : undefined}
              onPress={() => navigate(destination)}
              style={styles.sectionAction}
            >
              {actionLabel}
            </Button>
          ) : null)}
      </View>
      {grouped ? (
        <GroupedSurface>{children}</GroupedSurface>
      ) : (
        <View style={styles.independentItems}>{children}</View>
      )}
    </View>
  );
}

export function DashboardEmpty({ children }: { readonly children: string }): React.JSX.Element {
  return <Text style={styles.empty}>{children}</Text>;
}

export function ProjectRiskRow({
  project,
  compact = false,
}: {
  readonly project: RiskyProject;
  readonly compact?: boolean;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const overBudget = project.remainingBudget < 0;
  const health =
    project.effectiveHealth === "CRITICAL"
      ? "Kritis"
      : project.effectiveHealth === "WARNING"
        ? "Perhatian"
        : "Terkendali";
  return (
    <RowAction
      accessibilityLabel={
        "Buka project " +
        project.projectName +
        ", " +
        health +
        ". Aktual " +
        formatIdr(project.actualCost) +
        ", internal budget " +
        formatIdr(project.internalBudget) +
        ", sisa " +
        formatIdr(project.remainingBudget) +
        ". Margin proyeksi " +
        project.projectedMarginPercentage.toFixed(1) +
        " persen."
      }
      onPress={() => navigate("/projects/" + project.projectId + "?tab=overview")}
      style={styles.row}
    >
      <View style={styles.rowHeading}>
        <DuotoneIconTile
          name="monitoring"
          tone={overBudget ? "critical" : "attention"}
          iconSize={18}
          style={styles.identityTile}
        />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {project.projectName}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {project.riskReason}
          </Text>
        </View>
        <Text style={[styles.statusText, overBudget ? styles.danger : styles.warning]}>
          {health}
        </Text>
        <AppIcon name="chevron_right" size={14} color={theme.colors.muted} />
      </View>
      <View style={styles.metrics}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Aktual</Text>
          <MoneyValue amount={project.actualCost} variant="fullDynamic" size="md" />
        </View>
        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, styles.right]}>Internal budget</Text>
          <MoneyValue
            amount={project.internalBudget}
            variant="fullDynamic"
            size="md"
            align="right"
          />
        </View>
      </View>
      <View style={styles.insetLine}>
        <Text style={styles.meta}>Terpakai {project.usedPercentage.toFixed(0)}%</Text>
        <Text selectable style={[styles.meta, overBudget ? styles.danger : styles.valueText]}>
          {overBudget ? "Melebihi " : "Sisa "}
          {formatShortIdr(Math.abs(project.remainingBudget))}
        </Text>
      </View>
      {!compact ? (
        <>
          <View style={styles.rowHeading}>
            <Text style={styles.meta}>
              Margin target {project.targetMarginPercentage.toFixed(1)}%
            </Text>
            <Text
              selectable
              style={[
                styles.meta,
                project.projectedMarginPercentage < project.targetMarginPercentage && styles.danger,
              ]}
            >
              Proyeksi {project.projectedMarginPercentage.toFixed(1)}%
            </Text>
          </View>
          {project.riskyCategories.length > 0 ? (
            <View style={styles.badges}>
              {project.riskyCategories.map((category) => (
                <StatusBadge
                  key={category.code}
                  status="WATCH"
                  tone="warning"
                  label={category.name + " " + category.usedPercentage.toFixed(0) + "%"}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </RowAction>
  );
}

export function BudgetCategoryRow({
  category,
}: {
  readonly category: DashboardOverview["categories"][number];
}): React.JSX.Element {
  const danger = category.status === "CRITICAL" || category.status === "OVER_BUDGET";
  const warning = category.status === "WATCH";
  const label =
    category.status === "OVER_BUDGET"
      ? "Melebihi budget"
      : danger
        ? "Kritis"
        : warning
          ? "Perhatian"
          : "Terkendali";
  return (
    <View style={styles.row}>
      <View style={styles.rowHeading}>
        <DuotoneIconTile
          name="category"
          tone={danger ? "critical" : warning ? "attention" : "neutral"}
          iconSize={18}
          style={styles.identityTile}
        />
        <View style={styles.copy}>
          <View style={styles.rowHeading}>
            <Text style={styles.title}>{category.name}</Text>
            <Text style={[styles.statusText, danger && styles.danger, warning && styles.warning]}>
              {label}
            </Text>
          </View>
          <Text selectable style={styles.meta}>
            Alokasi {formatShortIdr(category.allocatedAmount)}
          </Text>
        </View>
      </View>
      <View style={styles.indented}>
        <BudgetSplitIndicator
          value={category.usedPercentage}
          danger={danger}
          usedAmount={category.actualAmount}
          remainingAmount={category.remainingAmount}
        />
      </View>
    </View>
  );
}

export function CashDueRow({
  item,
  compact = false,
}: {
  readonly item: CashDue;
  readonly compact?: boolean;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const timing =
    item.dayOffset < 0
      ? "Terlambat " + Math.abs(item.dayOffset) + " hari"
      : item.dayOffset === 0
        ? "Hari ini"
        : item.dayOffset === 1
          ? "Besok"
          : item.dayOffset + " hari lagi";
  const typeLabel = item.type === "payable" ? "Hutang vendor" : "Piutang klien";
  const web = resolveAppDestination(item.href)?.kind === "web";
  return (
    <RowAction
      accessibilityLabel={
        typeLabel +
        ", " +
        item.documentNumber +
        ", " +
        item.projectName +
        ", " +
        timing +
        ", outstanding " +
        formatIdr(item.outstandingAmount)
      }
      accessibilityHint={web ? "Membuka detail di web." : "Membuka detail dokumen."}
      onPress={() => navigate(item.href)}
      style={[styles.row, styles.dueRow]}
    >
      <View style={styles.dateTile} accessible={false}>
        <Text style={styles.day}>
          {item.dueDate.toLocaleDateString("id-ID", { day: "2-digit", timeZone: "Asia/Jakarta" })}
        </Text>
        <Text style={styles.dateMonth}>
          {item.dueDate.toLocaleDateString("id-ID", { month: "short", timeZone: "Asia/Jakarta" })}
        </Text>
        <View
          style={[
            styles.dateMarker,
            {
              backgroundColor:
                item.dayOffset < 0
                  ? theme.colors.critical
                  : item.dayOffset <= 7
                    ? theme.colors.warning
                    : theme.colors.outline,
            },
          ]}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.rowHeading}>
          <View style={styles.copy}>
            <Text style={[styles.meta, item.type === "payable" && styles.danger]}>{typeLabel}</Text>
            <Text numberOfLines={1} style={styles.title}>
              {item.documentNumber}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {item.projectName + " • " + item.counterpartyName}
            </Text>
          </View>
          <View style={styles.dueAmount}>
            <MoneyValue amount={item.outstandingAmount} variant="compact" size="sm" align="right" />
            <View style={styles.inline}>
              <Text
                style={[
                  styles.statusText,
                  item.dayOffset < 0
                    ? styles.danger
                    : item.dayOffset <= 7
                      ? styles.warning
                      : undefined,
                ]}
              >
                {timing}
              </Text>
              <AppIcon name="chevron_right" size={14} color={theme.colors.muted} />
            </View>
          </View>
        </View>
        {!compact ? (
          <View style={styles.rowHeading}>
            <Text style={styles.meta}>
              Jatuh tempo{" "}
              {item.dueDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                timeZone: "Asia/Jakarta",
              })}
            </Text>
            <View style={styles.amount}>
              <Text style={styles.meta}>Dibayar</Text>
              <MoneyValue amount={item.paidAmount} variant="compact" size="sm" align="right" />
            </View>
          </View>
        ) : null}
      </View>
    </RowAction>
  );
}

export function MaterialIssueRow({
  item,
  compact = false,
}: {
  readonly item: MaterialIssue;
  readonly compact?: boolean;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const label =
    item.type === "RAP_SHORTAGE"
      ? "RAP belum terpenuhi"
      : item.type === "LOW_STOCK"
        ? "Stok rendah"
        : item.type === "REVERSAL_REQUEST"
          ? "Perlu keputusan"
          : item.type === "WASTE"
            ? "Material terbuang"
            : "Penyesuaian stok";
  const quantityLabel = formatDashboardMaterialQuantity(item, compact);
  const stockContext = hasDashboardMaterialStockContext(item);
  const context = item.projectName ?? item.locationName;
  const target =
    item.type === "RAP_SHORTAGE"
      ? item.requiredStock
      : item.type === "LOW_STOCK"
        ? item.minimumStock
        : null;
  return (
    <RowAction
      accessibilityLabel={
        item.materialName +
        ", " +
        label +
        ". " +
        (quantityLabel ? quantityLabel + ". " : "") +
        item.description +
        (stockContext
          ? ". Tersedia " + item.availableStock.toLocaleString("id-ID") + " " + item.unit
          : context
            ? ". " + context
            : "") +
        (target !== null
          ? (item.type === "LOW_STOCK" ? ", minimum " : ", dibutuhkan ") +
            (target ?? 0).toLocaleString("id-ID") +
            " " +
            item.unit
          : "")
      }
      accessibilityHint="Membuka detail material di web."
      onPress={() => navigate(item.href)}
      style={styles.row}
    >
      <View style={styles.rowHeading}>
        <DuotoneIconTile
          name={
            compact
              ? "inventory_2"
              : item.type === "WASTE" || item.type === "ADJUSTMENT"
                ? "history"
                : "inventory_2"
          }
          tone={
            item.severity === "CRITICAL"
              ? "critical"
              : item.severity === "WARNING"
                ? "attention"
                : "neutral"
          }
          iconSize={18}
          style={styles.identityTile}
        />
        <View style={styles.copy}>
          <View style={styles.rowHeading}>
            <Text
              style={[
                styles.statusText,
                item.severity === "CRITICAL"
                  ? styles.danger
                  : item.severity === "WARNING"
                    ? styles.warning
                    : undefined,
              ]}
            >
              {label}
            </Text>
            {quantityLabel !== null ? (
              <Text selectable style={styles.quantity}>
                {quantityLabel}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {item.materialName}
          </Text>
          <Text numberOfLines={compact ? 1 : 2} style={styles.meta}>
            {item.description}
          </Text>
        </View>
        {!compact ? <AppIcon name="chevron_right" size={14} color={theme.colors.muted} /> : null}
      </View>
      {compact ? (
        <View style={styles.insetLine}>
          <Text selectable style={styles.meta}>
            {stockContext
              ? "Tersedia " + item.availableStock.toLocaleString("id-ID") + " " + item.unit
              : (context ?? "Tinjau")}
          </Text>
          {target !== null ? (
            <Text selectable style={styles.meta}>
              {item.type === "LOW_STOCK" ? "Minimum" : "Dibutuhkan"}{" "}
              {(target ?? 0).toLocaleString("id-ID")} {item.unit}
            </Text>
          ) : null}
          <AppIcon name="chevron_right" size={14} color={theme.colors.muted} />
        </View>
      ) : (
        <View style={[styles.rowHeading, styles.indented]}>
          <Text numberOfLines={1} style={styles.meta}>
            {item.projectName ?? item.locationName ?? "—"}
          </Text>
          <Text style={styles.meta}>
            {item.type === "RAP_SHORTAGE"
              ? "Tersedia " + item.availableStock.toLocaleString("id-ID")
              : item.type === "LOW_STOCK"
                ? "Minimum " + (item.minimumStock ?? 0).toLocaleString("id-ID")
                : item.createdAt
                  ? item.createdAt.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Asia/Jakarta",
                    })
                  : "Tinjau"}
          </Text>
        </View>
      )}
    </RowAction>
  );
}

export function CashTransactionRow({
  item,
}: {
  readonly item: CashTransaction;
}): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const inflow = isCashInflow(item.type);
  return (
    <RowAction
      accessibilityLabel={
        item.description +
        ", " +
        (inflow ? "Kas masuk " : "Kas keluar ") +
        formatIdr(item.amount) +
        ", Detail transaksi kas"
      }
      onPress={() =>
        navigate("/modal/activity?kind=CASH_TRANSACTION&id=" + encodeURIComponent(item.id))
      }
      style={[styles.row, styles.rowHeading]}
    >
      <DuotoneIconTile
        name={inflow ? "south_west" : "north_east"}
        tone={inflow ? "neutral" : "critical"}
        iconSize={16}
        style={styles.cashTile}
      />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {item.description}
        </Text>
        <Text style={styles.meta}>
          {item.createdAt.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Jakarta",
          })}
        </Text>
      </View>
      <View style={styles.amount}>
        <MoneyValue
          amount={item.amount}
          prefix={inflow ? "+" : "-"}
          variant="fullDynamic"
          size="sm"
          align="right"
          tone={inflow ? "primary" : "default"}
        />
      </View>
      <AppIcon name="chevron_right" size={14} color={theme.colors.muted} />
    </RowAction>
  );
}

export function ApprovalQueueRow({ item }: { readonly item: ApprovalDetail }): React.JSX.Element {
  const navigate = useAtriaNavigation();
  const critical = item.priority === "CRITICAL";
  const typeLabel =
    item.type === "project_cost"
      ? "Dana Lapangan"
      : item.type === "inventory_opening"
        ? "Saldo Stok"
        : "Vendor Payment";
  return (
    <RowAction
      accessibilityLabel={
        item.description +
        ", " +
        formatIdr(item.amount) +
        ", " +
        item.projectName +
        ", " +
        item.priorityReason +
        ", Detail persetujuan"
      }
      onPress={() => navigate("/modal/approval?approval=" + encodeURIComponent(item.id))}
      style={styles.row}
    >
      <View style={styles.rowHeading}>
        <DuotoneIconTile
          name={
            item.type === "project_cost"
              ? "receipt_long"
              : item.type === "inventory_opening"
                ? "inventory"
                : "request_quote"
          }
          tone={critical ? "critical" : "attention"}
          iconSize={18}
          style={styles.identityTile}
        />
        <View style={styles.copy}>
          <View style={styles.rowHeading}>
            <MoneyValue
              amount={item.amount}
              variant="fullDynamic"
              size="lg"
              style={styles.flexMoney}
            />
            <Text
              numberOfLines={2}
              style={[
                styles.statusText,
                styles.approvalReason,
                critical ? styles.danger : styles.warning,
              ]}
            >
              {item.priority === "NORMAL" ? typeLabel : item.priorityReason}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {item.description}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {item.projectName}
          </Text>
        </View>
        <AppIcon name="chevron_right" size={14} color={theme.colors.muted} />
      </View>
      <View style={[styles.badges, styles.indented]}>
        <Text numberOfLines={1} style={styles.meta}>
          {item.requestedBy}
        </Text>
        <Text style={styles.meta}>•</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {item.budgetItemName}
        </Text>
        {item.receiptImageUrl ? (
          <View style={styles.inline}>
            <AppIcon name="receipt_long" size={12} color={theme.colors.primary} />
            <Text style={styles.meta}>Nota</Text>
          </View>
        ) : null}
      </View>
    </RowAction>
  );
}

export const styles = StyleSheet.create({
  section: { gap: theme.spacing.base },
  independentItems: { gap: theme.spacing.sm },
  sectionHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.base,
  },
  sectionTitle: {
    flexShrink: 1,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.section,
  },
  sectionHeading: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  sectionCountBadge: {
    flexShrink: 0,
    minWidth: 22,
    minHeight: 22,
    paddingHorizontal: 6,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCount: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
    fontVariant: ["tabular-nums"],
  },
  sectionAction: { flexShrink: 0, minWidth: 48 },
  empty: {
    padding: theme.spacing.md,
    color: theme.colors.muted,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
  row: { minHeight: 52, padding: theme.spacing.sm, gap: theme.spacing.xs },
  rowHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    justifyContent: "space-between",
  },
  inline: { flexDirection: "row", alignItems: "center", gap: theme.spacing.base },
  copy: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.row,
  },
  meta: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
    flexShrink: 1,
  },
  statusText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.eyebrow,
    flexShrink: 1,
  },
  warning: { color: theme.colors.warningOnContainer },
  danger: { color: theme.colors.critical },
  valueText: { color: theme.colors.onSurface },
  right: { textAlign: "right" },
  metrics: { flexDirection: "row", gap: theme.spacing.xs },
  metricCell: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.base,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  metricLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.eyebrow,
    textTransform: "uppercase",
  },
  insetLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  indented: { marginLeft: 44 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.base, alignItems: "center" },
  identityTile: { width: 36, height: 36 },
  cashTile: { width: 32, height: 32 },
  amount: { minWidth: 76, maxWidth: "40%", alignItems: "flex-end", gap: theme.spacing.base },
  flexMoney: { flex: 1, minWidth: 0 },
  approvalReason: { maxWidth: "42%", textAlign: "right" },
  dueRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  dueAmount: {
    maxWidth: "44%",
    alignItems: "flex-end",
    gap: theme.spacing.xs,
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  dateTile: {
    position: "relative",
    width: 32,
    gap: theme.spacing.base,
    paddingTop: theme.spacing.base,
  },
  day: { color: theme.colors.onSurface, fontFamily: theme.fonts.mono, ...theme.typography.row },
  dateMonth: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.bold,
    ...theme.typography.eyebrow,
    textTransform: "uppercase",
  },
  dateMarker: {
    position: "absolute",
    top: theme.spacing.xs,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: theme.radii.capsule,
    borderWidth: 2,
    borderColor: theme.colors.surfaceContainerLowest,
  },
  quantity: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.mono,
    ...theme.typography.meta,
    flexShrink: 1,
  },
});
