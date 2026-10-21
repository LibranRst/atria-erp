import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { isCashInflow } from "@atria/core/finance/cash-direction";
import { formatIdr } from "@atria/core/utils/money";
import {
  AppIcon,
  BottomSheet,
  ActionMenu,
  type NativeMenuItem,
  DuotoneIconTile,
  FactRow,
  GroupedSurface,
  MoneyValue,
  RowAction,
  ScreenRefreshNotice,
} from "@/components/ui";
import { isAccessRevoked } from "@/lib/access-error";
import { useScreenQuery } from "@/lib/use-screen-query";
import { DetailQueryState } from "@/features/home-detail/detail-state";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { trpcClient } from "@/lib/trpc-client";
import { theme } from "@/theme";
import { AccountIdentity } from "@/features/dashboard/account-identity";
import { useAuth } from "@/providers/auth-provider";

export default function AccountDetailScreen(): React.JSX.Element {
  const viewport = useWindowDimensions();
  const params = useLocalSearchParams<{ account?: string | string[] }>();
  const id = Array.isArray(params.account) ? params.account[0] : params.account;
  const router = useRouter();
  const navigate = useAtriaNavigation();
  const { permissions } = useAuth();
  const canRead = permissions.includes("view:bank_account");
  const query = useScreenQuery(
    "ledger",
    (signal) => trpcClient.screen.ledger.query(undefined, { signal }),
    [],
    canRead,
  );
  if (!canRead)
    return (
      <BottomSheet
        title="Akses dibatasi"
        description="Peran Anda tidak memiliki akses ke rekening."
      ></BottomSheet>
    );
  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <DetailQueryState
        kind="account"
        query={query}
        title="Detail rekening"
        onRetry={() => void query.refetch()}
        onClose={() => router.back()}
      />
    );
  const bankAccounts = query.data.status === "ready" ? query.data.overview.bankAccounts : [];
  const account = bankAccounts.find((item) => item.id === id);
  if (!account)
    return (
      <BottomSheet
        title="Rekening tidak tersedia"
        description="Rekening ini tidak tersedia dalam akses akun Anda."
      ></BottomSheet>
    );
  const canWrite = permissions.includes("create:ledger");
  const canEdit = permissions.includes("update:bank_account");
  const hasTransferDestination = bankAccounts.some(
    (item) => item.isActive && item.id !== account.id,
  );
  const webAccountPath = `/ledger?tab=accounts&account=${encodeURIComponent(account.id)}`;
  const actions: readonly NativeMenuItem[] = [
    ...(canWrite && account.isActive
      ? [
          {
            id: "movement",
            label: "Catat mutasi di web",
            icon: "swap_vert",
            systemImage: "arrow.up.arrow.down" as const,
            onPress: () => navigate(`${webAccountPath}&bank-action=movement`, true),
          },
          {
            id: "transfer",
            label: "Transfer di web",
            icon: "sync_alt",
            systemImage: "arrow.left.arrow.right" as const,
            disabled: !hasTransferDestination,
            description: hasTransferDestination ? undefined : "Membutuhkan rekening aktif lain",
            onPress: () => navigate(`${webAccountPath}&bank-action=transfer`, true),
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: "edit",
            label: "Ubah rekening di web",
            icon: "edit",
            systemImage: "pencil" as const,
            onPress: () => navigate(`${webAccountPath}&bank-action=edit`, true),
          },
        ]
      : []),
    {
      id: "manage",
      label: "Kelola rekening di web",
      icon: "account_balance",
      systemImage: "building.columns" as const,
      onPress: () => navigate(webAccountPath, true),
    },
  ];
  return (
    <BottomSheet
      title="Detail rekening"
      footer={
        <ActionMenu
          accessibilityLabel="Aksi rekening"
          nativeTitle="Aksi rekening"
          nativeIcon="ellipsis"
          tone="neutral"
          height={52}
          width={viewport.width - 32}
          items={actions}
        >
          <View style={styles.menuTrigger}>
            <Text style={styles.menuLabel}>Aksi rekening</Text>
            <AppIcon name="expand_more" color={theme.colors.onPrimary} size={18} />
          </View>
        </ActionMenu>
      }
    >
      <ScreenRefreshNotice query={query} />
      <AccountIdentity account={account} />
      <GroupedSurface>
        <FactRow label="Nomor rekening" value={account.accountNumber} />
        <FactRow label="Atas nama" value={account.holderName} />
        <FactRow label="Status" value={account.isActive ? "Aktif" : "Diarsipkan"} />
      </GroupedSurface>
      {!account.isActive ? (
        <GroupedSurface>
          <View style={styles.row}>
            <Text style={styles.title}>Rekening diarsipkan</Text>
            <Text style={styles.meta}>
              Aktifkan kembali di web untuk mencatat kas masuk, kas keluar, atau transfer.
            </Text>
          </View>
        </GroupedSurface>
      ) : null}
      <View style={styles.sectionHeader}>
        <Text style={styles.title}>Aktivitas terbaru</Text>
        <Text style={styles.meta}>{account.recentTransactions.length} mutasi</Text>
      </View>
      <GroupedSurface>
        {account.recentTransactions.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon name="history" color={theme.colors.onSurfaceVariant} size={22} />
            <Text style={styles.title}>Belum ada mutasi</Text>
            <Text style={styles.emptyDescription}>
              Mutasi kas masuk, keluar, atau transfer akan tercatat di sini.
            </Text>
          </View>
        ) : (
          account.recentTransactions.map((item) => (
            <RowAction
              key={item.id}
              style={[styles.row, styles.heading]}
              accessibilityLabel={`${item.description}, ${isCashInflow(item.type) ? "kas masuk" : "kas keluar"} ${formatIdr(item.amount)}, ${formatBusinessLabel(item.category, "FINANCE")}, ${item.reconciled ? "sudah" : "belum"} direkonsiliasi`}
              accessibilityHint="Membuka rincian transaksi kas"
              onPress={() =>
                router.push({
                  pathname: "/modal/activity",
                  params: { kind: "CASH_TRANSACTION", id: item.id },
                })
              }
            >
              <DuotoneIconTile
                name={isCashInflow(item.type) ? "south_west" : "north_east"}
                tone={isCashInflow(item.type) ? "neutral" : "critical"}
                iconSize={16}
                style={styles.transactionIcon}
              />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.description}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {formatBusinessLabel(item.category, "FINANCE")} ·{" "}
                  {item.createdAt.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Jakarta",
                  })}
                </Text>
              </View>
              <MoneyValue
                amount={item.amount}
                prefix={isCashInflow(item.type) ? "+" : "−"}
                variant="fullDynamic"
                tone={isCashInflow(item.type) ? "default" : "danger"}
                size="sm"
                align="right"
                style={styles.amount}
              />
              <AppIcon name="chevron_right" size={14} color={theme.colors.onSurfaceVariant} />
            </RowAction>
          ))
        )}
      </GroupedSurface>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { padding: theme.spacing.md, gap: theme.spacing.xs },
  menuTrigger: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.primary,
  },
  menuLabel: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.row,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  copy: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  amount: { maxWidth: "42%", flexShrink: 1 },
  transactionIcon: { width: 32, height: 32 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.base,
  },
  title: { color: theme.colors.onSurface, fontFamily: theme.fonts.bold, ...theme.typography.row },
  meta: { color: theme.colors.muted, fontFamily: theme.fonts.medium, ...theme.typography.support },
  empty: { alignItems: "center", padding: theme.spacing.lg, gap: theme.spacing.xs },
  emptyDescription: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    textAlign: "center",
    ...theme.typography.support,
  },
});
