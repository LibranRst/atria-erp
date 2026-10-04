import { useScreenQuery } from "@/lib/use-screen-query";
import { useScreenScroll, useScreenSelection } from "@/lib/use-screen-memory";
import { isAccessRevoked } from "@/lib/access-error";
import {
  ScreenQueryState,
  ScreenRefreshNotice,
  AppIcon,
  Button,
  FactRow,
  GroupedSurface,
  MetricPill,
  MoneyValue,
  RowAction,
  ScreenMessage,
  ProjectListSkeleton,
  ExclusiveSearchFilterBar,
  SegmentedTabs,
  StatusBadge,
  SummarySurface,
} from "@/components/ui";
import {
  PROJECT_FILTERS,
  matchesFilter,
  summarizeProjectPortfolio,
} from "@atria/core/project/project-list";
import type { FilterId, ProjectItem } from "@atria/core/types/projects";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { TAB_BAR_CLEARANCE, TAB_SCREEN_BOTTOM_SPACE } from "@/constants/scroll-insets";
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
    <View style={styles.row}>
      <RowAction
        accessibilityLabel={`${project.name}, klien ${project.clientName}, manajer ${project.pmName}, ${Math.max(0, project.usedPercentage).toFixed(1)} persen budget terpakai`}
        onPress={onPress}
        style={styles.rowAction}
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
        </View>
      </RowAction>
      {canEdit ? (
        <RowAction
          accessibilityLabel={`Ubah identitas proyek ${project.name}`}
          onPress={onEdit}
          style={styles.editAction}
        >
          <AppIcon color={theme.colors.onSurfaceVariant} name="edit" size={14} weight="bold" />
          <Text style={styles.editActionLabel}>Ubah</Text>
        </RowAction>
      ) : null}
    </View>
  );
}

export default function ProjectsScreen(): React.JSX.Element {
  const router = useRouter();
  const { permissions } = useAuth();
  const [filter, setFilter] = useScreenSelection<FilterId>("projects", "ALL");
  const query = useScreenQuery("projects", (signal) =>
    trpcClient.screen.projects.query(undefined, { signal }),
  );
  const scroll = useScreenScroll("projects");
  const listRef = useRef<FlatList<ProjectItem>>(null);
  const offset = useRef(scroll.contentOffset.y);
  const beforeSearch = useRef(scroll.contentOffset.y);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("id-ID");

  const projects = useMemo(
    () => (query.data?.status === "ready" ? query.data.projects : []),
    [query.data],
  );
  const summary = useMemo(() => summarizeProjectPortfolio(projects), [projects]);
  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          (searchOpen || matchesFilter(project, filter)) &&
          (!normalizedQuery ||
            [project.name, project.clientName, project.pmName].some((value) =>
              value.toLocaleLowerCase("id-ID").includes(normalizedQuery),
            )),
      ),
    [filter, normalizedQuery, projects, searchOpen],
  );
  const canUpdateProjects = permissions.includes("update:budget");

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

  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <ScreenQueryState
        query={query}
        skeleton={
          <FlatList<ProjectItem>
            {...scroll}
            data={[]}
            renderItem={() => null}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: TAB_SCREEN_BOTTOM_SPACE + TAB_BAR_CLEARANCE },
            ]}
            ListHeaderComponent={
              <ProjectListSkeleton canCreate={permissions.includes("create:project")} />
            }
          />
        }
        onRetry={() => void query.refetch()}
      />
    );
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
    <>
      <FlatList
        {...scroll}
        ref={listRef}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          scroll.onScroll(event);
        }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: TAB_SCREEN_BOTTOM_SPACE + TAB_BAR_CLEARANCE },
        ]}
        data={visibleProjects}
        keyExtractor={(project) => project.id}
        ListEmptyComponent={
          <ScreenMessage
            description={
              normalizedQuery
                ? "Tidak ada proyek yang cocok dengan pencarian ini."
                : projects.length === 0
                  ? "Belum ada proyek yang tercatat untuk akun ini."
                  : "Tidak ada proyek pada filter ini."
            }
            icon="folder"
            title={
              normalizedQuery
                ? "Pencarian kosong"
                : projects.length === 0
                  ? "Belum ada proyek"
                  : "Filter kosong"
            }
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenRefreshNotice query={query} />
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

            <ExclusiveSearchFilterBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              accessibilityLabel="Cari proyek"
              searchPlaceholder="Cari nama, klien, atau PM"
              onOpenChange={(open) => {
                if (open) beforeSearch.current = offset.current;
                setSearchOpen(open);
                if (!open)
                  requestAnimationFrame(() =>
                    listRef.current?.scrollToOffset({
                      offset: beforeSearch.current,
                      animated: false,
                    }),
                  );
              }}
            >
              <SegmentedTabs
                accessibilityLabel="Filter proyek"
                onChange={setFilter}
                options={filterOptions}
                scrollable
                value={filter}
              />
            </ExclusiveSearchFilterBar>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={query.isRefreshing} onRefresh={() => void query.refresh()} />
        }
        renderItem={({ item }) => (
          <ProjectRow
            canEdit={
              canUpdateProjects && item.status !== "COMPLETED" && item.status !== "CANCELLED"
            }
            onEdit={() =>
              router.push({ pathname: "/modal/project", params: { projectId: item.id } })
            }
            onPress={() => router.push(`/projects/${item.id}`)}
            project={item}
          />
        )}
      />
    </>
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
    paddingRight: theme.spacing.xs,
  },
  rowAction: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
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
    width: 48,
    minHeight: 48,
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing.base,
    paddingHorizontal: theme.spacing.xs,
  },
  editActionLabel: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.bold,
    ...theme.typography.meta,
  },
});
