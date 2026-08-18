import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatShortDate } from "@atria/core/utils/date";

import {
  AppIcon,
  FactRow,
  GroupedSurface,
  MoneyValue,
  ScreenMessage,
  ScreenSkeleton,
  StatusBadge,
} from "@/components/ui";
import { trpcClient } from "@/lib/trpc-client";
import { theme } from "@/theme";

const READINESS_TONE_COLOR: Record<string, string> = {
  APPROVED: theme.colors.onSurface,
  CRITICAL: theme.colors.critical,
  DRAFT: theme.colors.onSurfaceVariant,
  WARNING: theme.colors.warningOnContainer,
};

const SEVERITY_ICON = {
  CRITICAL: "warning",
  INFO: "info",
  WARNING: "priority_high",
} as const;

const SEVERITY_COLOR: Record<keyof typeof SEVERITY_ICON, string> = {
  CRITICAL: theme.colors.critical,
  INFO: theme.colors.onSurfaceVariant,
  WARNING: theme.colors.warningOnContainer,
};

function formatDateOrDash(value: string | null): string {
  return value ? formatShortDate(new Date(value)) : "-";
}

/**
 * Pintu domain detail proyek. Ringkasan saja — RAP, RAB, stok, dan pembayaran
 * masing-masing punya layar sendiri di unit berikutnya (P2.5+). Kesiapan dan
 * daftar "perlu perhatian" di sini murni informasi; belum ada navigasi ke tab
 * lain karena tabnya belum dibangun.
 */
export default function ProjectOverviewScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ readonly projectId?: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const insets = useSafeAreaInsets();

  const query = useQuery({
    enabled: Boolean(projectId),
    queryFn: () => trpcClient.screen.projectOverview.query({ projectId: projectId as string }),
    queryKey: ["screen", "projectOverview", projectId],
  });

  if (query.isPending) return <ScreenSkeleton rows={6} />;
  if (query.isError) {
    return (
      <ScreenMessage
        description="Ringkasan proyek belum dapat dimuat. Periksa koneksi lalu coba lagi."
        onAction={() => void query.refetch()}
        title="Data belum tersedia"
      />
    );
  }
  if (!query.data || query.data.status !== "ready") {
    return (
      <ScreenMessage
        description={
          query.data?.status === "notFound"
            ? "Proyek tidak ditemukan."
            : "Anda tidak memiliki akses ke proyek ini."
        }
        icon="lock"
        title="Tidak dapat dibuka"
      />
    );
  }

  const { actions, categories, isLocked, project, readiness } = query.data;

  return (
    <>
      <Stack.Screen options={{ title: project.name }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <Text numberOfLines={2} style={styles.title}>
            {project.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {project.clientName} · {project.pmName}
          </Text>
          <View style={styles.badges}>
            <StatusBadge status={project.status} />
            {project.effectiveHealth === "HEALTHY" ? null : (
              <StatusBadge status={project.effectiveHealth} />
            )}
          </View>
          <MoneyValue amount={project.totalContractValue} size="2xl" variant="compactWithFull" />
        </View>

        {isLocked ? (
          <View style={styles.lockedBanner}>
            <AppIcon color={theme.colors.onSurfaceVariant} name="lock" size={16} weight="bold" />
            <Text style={styles.lockedText}>
              Budget belum disetujui — pengeluaran dan pembayaran masih terkunci.
            </Text>
          </View>
        ) : null}

        <GroupedSurface>
          <FactRow label="Mulai" value={formatDateOrDash(project.startDate)} />
          <FactRow label="Selesai" value={formatDateOrDash(project.endDate)} />
          <FactRow label="Lokasi" value={project.location ?? "-"} />
          <FactRow label="Tipe" value={project.projectType ?? "-"} />
        </GroupedSurface>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kesiapan</Text>
          <GroupedSurface>
            {readiness.map((item) => (
              <FactRow
                key={item.id}
                label={item.label}
                value={
                  <View style={styles.readinessValue}>
                    <Text
                      numberOfLines={1}
                      style={[styles.readinessText, { color: READINESS_TONE_COLOR[item.tone] }]}
                    >
                      {item.value}
                    </Text>
                    <Text numberOfLines={1} style={styles.readinessDetail}>
                      {item.detail}
                    </Text>
                  </View>
                }
              />
            ))}
          </GroupedSurface>
        </View>

        {actions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perlu perhatian</Text>
            <GroupedSurface>
              {actions.map((action) => (
                <View key={action.id} style={styles.actionRow}>
                  <AppIcon
                    color={SEVERITY_COLOR[action.severity]}
                    name={SEVERITY_ICON[action.severity]}
                    size={16}
                    weight="bold"
                  />
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </View>
                </View>
              ))}
            </GroupedSurface>
          </View>
        ) : null}

        {categories.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kategori budget</Text>
            <GroupedSurface>
              {categories.map((category) => (
                <FactRow
                  key={category.id}
                  label={category.name}
                  value={
                    <View style={styles.categoryValue}>
                      <MoneyValue
                        align="right"
                        amount={category.actualAmount}
                        size="sm"
                        variant="compactWithFull"
                      />
                      <Text numberOfLines={1} style={styles.categoryMeta}>
                        {Math.max(0, category.usedPercentage).toFixed(0)}% terpakai
                      </Text>
                    </View>
                  }
                />
              ))}
            </GroupedSurface>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  actionCopy: { flex: 1, gap: 2, minWidth: 0 },
  actionDescription: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  actionTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  badges: {
    flexDirection: "row",
    gap: theme.spacing.base,
    marginTop: theme.spacing.base,
  },
  categoryMeta: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    marginTop: 2,
    ...theme.typography.meta,
  },
  categoryValue: { alignItems: "flex-end" },
  content: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  header: {
    gap: theme.spacing.base,
    paddingTop: theme.spacing.sm,
  },
  lockedBanner: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceContainerLow,
    borderRadius: theme.radii.inset,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  lockedText: {
    color: theme.colors.onSurfaceVariant,
    flex: 1,
    fontFamily: theme.fonts.medium,
    ...theme.typography.meta,
  },
  meta: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
  readinessDetail: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    marginTop: 2,
    ...theme.typography.meta,
  },
  readinessText: {
    fontFamily: theme.fonts.bold,
    textAlign: "right",
    ...theme.typography.support,
  },
  readinessValue: { alignItems: "flex-end" },
  section: { gap: theme.spacing.sm },
  sectionTitle: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    ...theme.typography.eyebrow,
  },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
});
