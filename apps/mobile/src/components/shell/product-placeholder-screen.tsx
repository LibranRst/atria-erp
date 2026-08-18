import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, Button, FactRow, GroupedSurface } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

export type PlaceholderAction = {
  readonly href: Href;
  readonly label: string;
};

const roleLabels: Record<string, string> = {
  DESIGNER: "Desainer",
  FINANCE_ADMIN: "Admin Keuangan",
  MARKETING: "Pemasaran",
  OWNER: "Pemilik",
  PROJECT_MANAGER: "Manajer Proyek",
  PURCHASING: "Pembelian",
  SALES: "Penjualan",
};

export function ProductPlaceholderScreen({
  actions = [],
  description,
  iconName,
  rows,
  title,
}: {
  readonly actions?: readonly PlaceholderAction[];
  readonly description: string;
  readonly iconName: string;
  readonly rows: readonly string[];
  readonly title: string;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roleName, signOut, user } = useAuth();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + 80 },
      ]}
    >
      <View style={styles.intro}>
        <View style={styles.iconSurface}>
          <AppIcon color={theme.colors.primary} name={iconName} size={22} weight="bold" />
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>

      <GroupedSurface>
        {rows.map((row) => (
          <FactRow key={row} label={row} value="Siap" />
        ))}
      </GroupedSurface>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              onPress={() => router.push(action.href)}
              variant={index === 0 ? "primary" : "secondary"}
            >
              {action.label}
            </Button>
          ))}
        </View>
      ) : null}

      <GroupedSurface>
        <FactRow label="Akun" value={user?.name ?? "Pengguna Atria"} />
        <FactRow
          label="Akses"
          value={roleName ? (roleLabels[roleName] ?? "Pengguna") : "Pengguna"}
        />
      </GroupedSurface>
      <Button onPress={() => void signOut()} variant="ghost">
        Keluar
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: theme.spacing.md,
  },
  intro: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  iconSurface: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.primaryContainer,
  },
  introCopy: { flex: 1, minWidth: 0, gap: theme.spacing.base },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
  actions: { gap: theme.spacing.sm },
});
