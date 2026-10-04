import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type {
  ActivityFact,
  ActivityStatusTone,
  ActivityValue,
} from "@atria/core/activity-detail/types";
import type { StatusBadgeTone } from "@atria/core/presentation/status-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { cashActivityDetailRequestSchema } from "@atria/core/activity-detail/validation";
import {
  BottomSheet,
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  ScreenRefreshNotice,
  StatusBadge,
} from "@/components/ui";
import { DetailQueryState } from "@/features/home-detail/detail-state";
import { useScreenQuery } from "@/lib/use-screen-query";
import { isAccessRevoked } from "@/lib/access-error";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { trpcClient } from "@/lib/trpc-client";
import { theme } from "@/theme";

const statusTones: Record<ActivityStatusTone, StatusBadgeTone> = {
  NEUTRAL: "neutral",
  PENDING: "pending",
  SUCCESS: "completed",
  WARNING: "warning",
  DANGER: "critical",
};

export default function ActivityDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ kind?: string | string[]; id?: string | string[] }>();
  const router = useRouter();
  const navigate = useAtriaNavigation();
  const parsed = cashActivityDetailRequestSchema.safeParse({
    kind: Array.isArray(params.kind) ? params.kind[0] : params.kind,
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  const query = useScreenQuery(
    "activityDetail",
    async (signal) => {
      if (!parsed.success) return { status: "notFound" };
      const result = await trpcClient.screen.activityDetail.query(parsed.data, { signal });
      if (!result.success) {
        if (result.error.code === "NOT_FOUND") return { status: "notFound" };
        throw new Error(result.error.message);
      }
      return { status: "ready", detail: result.data };
    },
    [Array.isArray(params.id) ? params.id[0] : params.id],
    parsed.success,
  );
  const close = (): void => router.back();
  if (!parsed.success || query.data?.status === "notFound")
    return (
      <BottomSheet
        title="Transaksi tidak tersedia"
        description="Transaksi ini tidak ditemukan atau sumbernya sudah tidak tersedia."
      ></BottomSheet>
    );
  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <DetailQueryState
        kind="activity"
        title="Detail transaksi"
        query={query}
        onRetry={() => void query.refetch()}
        onClose={close}
      />
    );
  const detail = query.data.detail;
  if (!detail) return <BottomSheet title="Transaksi tidak tersedia"></BottomSheet>;
  return (
    <BottomSheet
      title={detail.title}
      description={detail.subtitle}
      footer={
        detail.source ? (
          <Button
            variant="secondary"
            onPress={() => navigate(detail.source?.href ?? "/ledger?tab=accounts")}
          >
            {detail.source.label}
          </Button>
        ) : undefined
      }
    >
      <ScreenRefreshNotice query={query} />
      <View style={styles.status}>
        <StatusBadge
          status={detail.status}
          label={formatBusinessLabel(detail.status)}
          tone={statusTones[detail.statusTone]}
        />
        <Text style={styles.meta}>{dateLabel(detail.occurredAt)}</Text>
      </View>
      <FactSection title="Informasi transaksi" facts={detail.facts} />
      <FactSection title="Dampak" facts={detail.impacts} />
      {detail.comparisons.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Perubahan</Text>
          <GroupedSurface>
            {detail.comparisons.map((item) => (
              <View key={item.label} style={styles.comparison}>
                <Text style={styles.heading}>{item.label}</Text>
                <FactRow label="Sebelum" value={<FactValue value={item.before} />} />
                <FactRow label="Sesudah" value={<FactValue value={item.after} />} />
              </View>
            ))}
          </GroupedSurface>
        </View>
      ) : null}
      <FactSection title="Catatan dan pemeriksaan" facts={detail.notes} />
      <GroupedSurface>
        <FactRow label="Dicatat oleh" value={detail.actorName} />
        {detail.evidenceIncomplete ? (
          <Text style={styles.notice}>
            Jejak audit belum lengkap. Periksa sumber transaksi sebelum mengambil tindakan.
          </Text>
        ) : null}
      </GroupedSurface>
    </BottomSheet>
  );
}

function FactSection({
  title,
  facts,
}: {
  readonly title: string;
  readonly facts: readonly ActivityFact[];
}): React.JSX.Element | null {
  if (facts.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <GroupedSurface>
        {facts.map((item, index) => (
          <FactRow
            key={`${item.label}-${index}`}
            label={item.label}
            value={<FactValue value={item.value} />}
          />
        ))}
      </GroupedSurface>
    </View>
  );
}

function FactValue({ value }: { readonly value: ActivityValue }): React.JSX.Element {
  if (value.type === "MONEY")
    return <MoneyValue amount={value.value} variant="fullDynamic" size="md" align="right" />;
  const text =
    value.type === "DATE"
      ? dateLabel(value.value)
      : value.type === "QUANTITY"
        ? `${value.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${value.unit ? ` ${value.unit}` : ""}`
        : /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(value.value)
          ? formatBusinessLabel(value.value)
          : value.value;
  return (
    <Text selectable style={styles.value}>
      {text}
    </Text>
  );
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tanggal belum tersedia"
    : date.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });
}

const styles = StyleSheet.create({
  section: { gap: theme.spacing.xs },
  heading: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    justifyContent: "space-between",
  },
  meta: { color: theme.colors.muted, fontFamily: theme.fonts.medium, ...theme.typography.meta },
  value: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
    textAlign: "right",
  },
  comparison: { padding: theme.spacing.sm, gap: theme.spacing.base },
  notice: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.medium,
    ...theme.typography.support,
    padding: theme.spacing.md,
  },
});
