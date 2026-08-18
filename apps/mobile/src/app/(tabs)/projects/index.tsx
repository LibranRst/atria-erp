import { actorHasPermission } from "@atria/core/auth/permissions";
import {
  PROJECT_FILTERS,
  matchesFilter,
  summarizeProjectPortfolio,
} from "@atria/core/project/project-list";
import type { FilterId, ProjectItem } from "@atria/core/types/projects";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import {
  AppIcon,
  Button,
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
import { TAB_SCREEN_BOTTOM_SPACE } from "@/constants/scroll-insets";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

/**
 * Menekan baris membuka ringkasan detail proyek (`[projectId]/index`, P2.4).
 * Tombol "Ubah" sengaja area sentuh terpisah dari baris, bukan bersarang di
 * dalamnya — menekan baris menuju ringkasan baca, menekan "Ubah" membuka form
 * sheet identitas. Keduanya tidak boleh saling menimpa maksud pengguna.
 */
function ProjectRow({
  canEdit,
  onEdit,
  onPress,
  project,
}: {
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onPress: () => void;
  readonly project: ProjectItem;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${project.name}, klien ${project.clientName}, manajer ${project.pmName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {project.name}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {project.clientName} · {project.pmName}
        </Text>
        <View style={styles.rowBadges}>
          <StatusBadge status={project.status} />
          {project.effectiveHealth === "HEALTHY" ? null : (
            <StatusBadge status={project.effectiveHealth} />
          )}
        </View>
      </View>
      <View style={styles.rowValue}>
        <MoneyValue
          align="right"
          amount={project.totalContractValue}
          size="sm"
          variant="compactWithFull"
        />
        <Text style={styles.rowUsage}>
          {Math.max(0, project.usedPercentage).toFixed(1)}% terpakai
        </Text>
        {canEdit ? (
          <Pressable
            accessibilityLabel={`Ubah identitas proyek ${project.name}`}
            accessibilityRole="button"
            hitSlop={4}
            onPress={onEdit}
            style={({ pressed }) => [styles.editAction, pressed && styles.editActionPressed]}
          >
            <AppIcon color={theme.colors.onSurfaceVariant} name="edit" size={14} weight="bold" />
            <Text style={styles.editActionLabel}>Ubah</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ProjectsScreen(): React.JSX.Element {
  const router = useRouter();
  const { roleName } = useAuth();
  const [filter, setFilter] = useState<FilterId>("ALL");
  const query = useQuery({
    queryKey: ["screen", "projects"],
    queryFn: () => trpcClient.screen.projects.query(),
  });

  const projects = useMemo(
    () => (query.data?.status === "ready" ? query.data.projects : []),
    [query.data],
  );
  const summary = useMemo(() => summarizeProjectPortfolio(projects), [projects]);
  const visibleProjects = useMemo(
    () => projects.filter((project) => matchesFilter(project, filter)),
    [filter, projects],
  );
  const canUpdateProjects = roleName ? actorHasPermission(roleName, "update:budget") : false;

  /**
   * Filter yang tidak punya satu pun proyek disembunyikan supaya strip tidak
   * penuh pilihan kosong. "Semua" selalu ada sebagai jalan kembali.
   */
  const filterOptions = useMemo(
    () =>
      PROJECT_FILTERS.filter(
        (option) =>
          option.id === "ALL" || projects.some((project) => matchesFilter(project, option.id)),
      ).map((option) => ({
        badge: projects.filter((project) => matchesFilter(project, option.id)).length,
        label: option.label,
        value: option.id,
      })),
    [projects],
  );

  if (query.isPending) return <ScreenSkeleton rows={5} />;
  if (query.isError) {
    return (
      <ScreenMessage
        description="Daftar proyek belum dapat dimuat. Periksa koneksi lalu coba lagi."
        onAction={() => void query.refetch()}
        title="Data belum tersedia"
      />
    );
  }
  if (!query.data || query.data.status === "restricted") {
    return (
      <ScreenMessage
        description="Peran Anda tidak memiliki akses ke daftar proyek."
        icon="lock"
        title="Akses dibatasi"
      />
    );
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: TAB_SCREEN_BOTTOM_SPACE }]}
      data={visibleProjects}
      keyExtractor={(project) => project.id}
      ListEmptyComponent={
        <ScreenMessage
          description={
            projects.length === 0
              ? "Belum ada proyek yang tercatat untuk akun ini."
              : "Tidak ada proyek pada filter ini."
          }
          icon="folder"
          title={projects.length === 0 ? "Belum ada proyek" : "Filter kosong"}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <SummarySurface amount={summary.activeContractValue} label="Nilai kontrak proyek aktif">
            <View style={styles.metrics}>
              <MetricPill amount={summary.activeInternalBudget} label="Budget internal" />
              <MetricPill
                amount={summary.activeRemainingBudget}
                label="Sisa budget"
                tone={summary.activeRemainingBudget < 0 ? "danger" : "default"}
              />
            </View>
          </SummarySurface>

          <GroupedSurface>
            <FactRow label="Proyek aktif" value={String(summary.activeCount)} />
            <FactRow label="Perlu perhatian" value={String(summary.attentionCount)} />
          </GroupedSurface>

          {query.data.isAllowedToCreate ? (
            <Button
              leading={
                <AppIcon color={theme.colors.onPrimary} name="add" size={18} weight="bold" />
              }
              onPress={() => router.push("/modal/project")}
            >
              Proyek baru
            </Button>
          ) : null}

          <SegmentedTabs
            accessibilityLabel="Filter proyek"
            onChange={setFilter}
            options={filterOptions}
            scrollable
            value={filter}
          />
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
      }
      renderItem={({ item }) => (
        <ProjectRow
          canEdit={canUpdateProjects && item.status !== "COMPLETED" && item.status !== "CANCELLED"}
          onEdit={() => router.push({ pathname: "/modal/project", params: { projectId: item.id } })}
          onPress={() => router.push(`/projects/${item.id}`)}
          project={item}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.marginMobile,
  },
  header: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  metrics: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  row: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.radii.inset,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 72,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowPressed: { opacity: 0.85 },
  rowBadges: {
    flexDirection: "row",
    gap: theme.spacing.base,
    marginTop: theme.spacing.base,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    marginTop: 2,
  },
  rowTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    fontSize: theme.typography.row.fontSize,
    lineHeight: theme.typography.row.lineHeight,
  },
  rowUsage: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    fontSize: theme.typography.meta.fontSize,
    lineHeight: theme.typography.meta.lineHeight,
    marginTop: 2,
  },
  rowValue: {
    alignItems: "flex-end",
  },
  editAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.base,
    paddingHorizontal: theme.spacing.xs,
  },
  editActionPressed: { opacity: 0.68 },
  editActionLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.bold,
    ...theme.typography.meta,
  },
});
