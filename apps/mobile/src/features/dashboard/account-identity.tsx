import { StyleSheet, Text, View } from "react-native";
import { AppIcon, MoneyValue, RowAction } from "@/components/ui";
import { formatIdr } from "@atria/core/utils/money";
import { theme } from "@/theme";
import type { DashboardOverview } from "./types";

export function AccountIdentity({
  account,
  onPress,
}: {
  readonly account: DashboardOverview["bankAccounts"][number];
  readonly onPress?: () => void;
}): React.JSX.Element {
  const inverse = account.cardTextColor === "light";
  const color = inverse ? theme.colors.onSurfaceInverse : theme.colors.onSurface;
  const insetColor = inverse ? theme.opacityColors.white10 : theme.colors.ringControl;
  const body = (
    <>
      <View style={styles.heading}>
        <View style={[styles.iconTile, { backgroundColor: insetColor }]}>
          <AppIcon name="account_balance" size={20} color={color} />
        </View>
        <View style={styles.copy}>
          <View style={styles.heading}>
            <Text numberOfLines={1} style={[styles.name, { color }]}>
              {account.name}
            </Text>
            {!account.isActive ? (
              <Text style={[styles.inactiveLabel, { color, backgroundColor: insetColor }]}>
                Tidak aktif
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={1} style={[styles.bank, { color }]}>
            {account.bankName}
          </Text>
        </View>
        <AppIcon name="contactless" size={23} color={color} />
      </View>
      <View style={styles.balance}>
        <Text style={[styles.label, { color }]}>Saldo tersedia</Text>
        <MoneyValue
          amount={account.balance}
          variant="fullDynamic"
          size="lg"
          tone={account.balance < 0 ? "danger" : inverse ? "inverse" : "default"}
        />
      </View>
      <View style={styles.heading}>
        <Text selectable style={[styles.number, { color }]}>
          •••• {account.accountNumber.slice(-4)}
        </Text>
        <Text numberOfLines={1} style={[styles.holder, { color }]}>
          {account.holderName}
        </Text>
      </View>
      {onPress ? (
        <View style={[styles.latest, { backgroundColor: insetColor }]}>
          <AppIcon name="receipt_long" size={15} color={color} />
          <Text numberOfLines={1} style={[styles.latestCopy, { color }]}>
            {account.recentTransactions[0]?.description ?? "Belum ada transaksi"}
          </Text>
          <AppIcon name="chevron_right" size={15} color={color} />
        </View>
      ) : null}
    </>
  );
  const cardStyle = [
    styles.card,
    !account.isActive && styles.inactive,
    {
      backgroundColor: account.cardColorFrom,
      experimental_backgroundImage:
        "linear-gradient(135deg, " + account.cardColorFrom + ", " + account.cardColorTo + ")",
    },
  ];
  return onPress ? (
    <RowAction
      accessibilityLabel={
        "Buka rekening " +
        account.name +
        ", " +
        account.bankName +
        ", saldo " +
        formatIdr(account.balance) +
        ", " +
        (account.isActive ? "Aktif" : "Tidak aktif")
      }
      onPress={onPress}
      style={cardStyle}
    >
      {body}
    </RowAction>
  ) : (
    <View style={cardStyle}>{body}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radii.owner,
    borderCurve: "continuous",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    boxShadow: theme.shadows.surface,
  },
  inactive: { opacity: 0.6 },
  heading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  name: { flexShrink: 1, fontFamily: theme.fonts.semibold, ...theme.typography.row },
  bank: {
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.85,
  },
  balance: { gap: theme.spacing.base, paddingTop: theme.spacing.base },
  label: {
    fontFamily: theme.fonts.semibold,
    ...theme.typography.eyebrow,
    letterSpacing: 1,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  number: {
    flex: 1,
    fontFamily: theme.fonts.mono,
    ...theme.typography.support,
    letterSpacing: 1.8,
    opacity: 0.85,
  },
  holder: {
    maxWidth: "55%",
    fontFamily: theme.fonts.semibold,
    ...theme.typography.eyebrow,
    textTransform: "uppercase",
    textAlign: "right",
    opacity: 0.85,
  },
  inactiveLabel: {
    borderRadius: theme.radii.capsule,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.eyebrow,
  },
  latest: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderRadius: theme.radii.inset,
  },
  latestCopy: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.medium,
    ...theme.typography.eyebrow,
    opacity: 0.85,
  },
});
