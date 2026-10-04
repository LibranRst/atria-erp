import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { approvalIsCritical } from "@atria/core/finance/approval-summary";
import {
  getApprovalBudgetImpact,
  RISK_LIMIT_THRESHOLD,
  RISK_WARNING_THRESHOLD,
} from "@atria/core/finance/budget-indicator";
import {
  AppIcon,
  BottomSheet,
  Button,
  FactRow,
  GroupedSurface,
  MoneyValue,
  LoadingImage,
  RowAction,
  ScreenRefreshNotice,
  StatusBadge,
  SummarySurface,
} from "@/components/ui";
import { DetailQueryState } from "@/features/home-detail/detail-state";
import { isAccessRevoked } from "@/lib/access-error";
import { receiptImageSource } from "@/lib/receipt-ocr";
import { trpcClient } from "@/lib/trpc-client";
import { useScreenQuery } from "@/lib/use-screen-query";
import { useAtriaNavigation } from "@/lib/use-atria-navigation";
import { useAuth } from "@/providers/auth-provider";
import { getApiBaseURL, getWebBaseURL } from "@/lib/runtime-config";
import { theme } from "@/theme";

function shortDate(value: Date): string {
  return value.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function resolveProofUrl(value: string): string | null {
  try {
    const source = value.trim();
    if (!source) return null;
    const base = source.startsWith("/api/") ? getApiBaseURL() : getWebBaseURL();
    const url = new URL(source, base);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password)
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

function ApprovalProof({ url }: { readonly url: string | null }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!url) {
    return (
      <GroupedSurface>
        <View style={[styles.row, styles.heading]}>
          <AppIcon name="image" color={theme.colors.onSurfaceVariant} size={24} />
          <View style={styles.copy}>
            <Text style={styles.title}>Tidak ada bukti terlampir</Text>
            <Text style={styles.meta}>Dokumen pendukung belum dilampirkan pada pengajuan ini.</Text>
          </View>
        </View>
      </GroupedSurface>
    );
  }
  const proofUrl = resolveProofUrl(url);
  if (!proofUrl) {
    return (
      <GroupedSurface>
        <View style={styles.row}>
          <Text style={styles.title}>Tautan bukti tidak tersedia</Text>
          <Text style={styles.meta}>Buka pengajuan di web untuk memeriksa dokumen pendukung.</Text>
        </View>
      </GroupedSurface>
    );
  }
  if (failed) {
    return (
      <GroupedSurface>
        <View style={styles.row}>
          <Text style={styles.title}>Bukti belum dapat ditampilkan</Text>
          <Text style={styles.meta}>Periksa koneksi lalu muat ulang bukti pengajuan.</Text>
          <Button
            variant="secondary"
            onPress={() => {
              setAttempt((value) => value + 1);
              setFailed(false);
            }}
          >
            Muat ulang bukti
          </Button>
        </View>
      </GroupedSurface>
    );
  }
  return (
    <GroupedSurface>
      <RowAction
        accessibilityLabel={expanded ? "Perkecil bukti pengajuan" : "Perbesar bukti pengajuan"}
        accessibilityHint="Pratinjau dokumen pendukung, tanpa mengubah pengajuan"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.proofAction}
      >
        <LoadingImage
          key={attempt}
          source={receiptImageSource(proofUrl)}
          contentFit={expanded ? "contain" : "cover"}
          style={[styles.proof, expanded && styles.proofExpanded]}
          onError={() => setFailed(true)}
          accessible={false}
        />
        <View style={styles.proofCaption}>
          <Text style={styles.title}>{expanded ? "Perkecil bukti" : "Pratinjau bukti"}</Text>
          <AppIcon
            name={expanded ? "close" : "north_east"}
            size={17}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </RowAction>
    </GroupedSurface>
  );
}

function ApprovalImpact({ item }: { readonly item: ApprovalDetail }): React.JSX.Element {
  if (item.type === "inventory_opening") {
    return (
      <>
        <Text style={styles.section}>Rincian saldo awal stok</Text>
        <GroupedSurface>
          {item.inventoryItems.length === 0 ? (
            <View style={styles.row}>
              <Text style={styles.meta}>Rincian material belum tersedia pada pengajuan ini.</Text>
            </View>
          ) : null}
          {item.inventoryItems.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <View style={styles.heading}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{entry.materialName}</Text>
                  <Text style={styles.meta}>{entry.locationName}</Text>
                </View>
                <MoneyValue
                  amount={entry.totalValue}
                  variant="fullDynamic"
                  size="sm"
                  align="right"
                  style={styles.money}
                />
              </View>
              <View style={styles.heading}>
                <Text style={[styles.meta, styles.copy]}>
                  {new Intl.NumberFormat("id-ID").format(entry.quantity)} {entry.unit}
                </Text>
                <View style={styles.unitCost}>
                  <Text style={styles.meta}>Harga pokok per unit</Text>
                  <MoneyValue
                    amount={entry.unitCost}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                  />
                </View>
              </View>
            </View>
          ))}
        </GroupedSurface>
        <Text style={styles.section}>Dampak setelah disetujui</Text>
        <GroupedSurface>
          <View style={styles.row}>
            <Text style={styles.title}>Menambah persediaan sesuai jumlah fisik</Text>
            <Text style={styles.meta}>
              Tidak membuat kas keluar, utang vendor, atau realisasi biaya proyek.
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.title}>Riwayat tetap tercatat</Text>
            <Text style={styles.meta}>
              Persetujuan mencatat pergerakan saldo awal stok dan riwayat audit.
            </Text>
          </View>
        </GroupedSurface>
      </>
    );
  }
  const delta = item.consumesBudgetActual ? item.amount : 0;
  const after = item.actualSpent + delta;
  const impact = getApprovalBudgetImpact(item.allocatedAmount, item.actualSpent, delta);
  const critical = item.budgetOverrun || impact.afterPercentage >= RISK_LIMIT_THRESHOLD;
  const warning = !critical && impact.afterPercentage >= RISK_WARNING_THRESHOLD;
  const status = !item.consumesBudgetActual
    ? "Menjadi nilai persediaan, bukan realisasi"
    : item.allocatedAmount <= 0 && delta > 0
      ? "Belum ada alokasi budget"
      : critical
        ? impact.overflowPercentage > 0
          ? `Melewati budget ${impact.overflowPercentage.toFixed(0)}%`
          : "Mencapai batas budget"
        : warning
          ? `Tersisa ${(RISK_LIMIT_THRESHOLD - impact.afterPercentage).toFixed(0)}% sebelum batas`
          : "Tetap dalam batas budget";
  return (
    <>
      <Text style={styles.section}>Dampak ke budget</Text>
      <GroupedSurface>
        <FactRow label="Kategori" value={item.budgetItemName} />
        <FactRow
          label="Plafon alokasi"
          value={
            item.allocatedAmount > 0 ? (
              <MoneyValue
                amount={item.allocatedAmount}
                variant="fullDynamic"
                size="sm"
                align="right"
              />
            ) : (
              "Tanpa plafon alokasi"
            )
          }
        />
        <FactRow
          label="Realisasi sekarang"
          value={
            <MoneyValue amount={item.actualSpent} variant="fullDynamic" size="sm" align="right" />
          }
        />
        <FactRow
          label="Tambahan realisasi"
          value={
            <MoneyValue
              amount={delta}
              variant="fullDynamic"
              size="sm"
              align="right"
              prefix={delta > 0 ? "+" : undefined}
            />
          }
        />
        <FactRow
          label="Realisasi sesudah"
          value={
            <MoneyValue
              amount={after}
              variant="fullDynamic"
              size="sm"
              align="right"
              tone={critical ? "danger" : "default"}
            />
          }
        />
        <View style={styles.row}>
          {item.consumesBudgetActual && item.allocatedAmount > 0 ? (
            <Text style={styles.meta}>
              {impact.beforePercentage.toFixed(0)}% sekarang · {impact.afterPercentage.toFixed(0)}%
              sesudah
            </Text>
          ) : null}
          {!item.consumesBudgetActual ? <Text style={styles.meta}>{status}</Text> : null}
          <StatusBadge
            label={item.consumesBudgetActual ? status : "Realisasi tetap"}
            status={status}
            tone={critical ? "critical" : warning ? "warning" : "neutral"}
          />
        </View>
      </GroupedSurface>
    </>
  );
}

export default function ApprovalDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ approval?: string | string[] }>();
  const id = Array.isArray(params.approval) ? params.approval[0] : params.approval;
  const router = useRouter();
  const navigate = useAtriaNavigation();
  const { permissions } = useAuth();
  const canRead = permissions.includes("view:approval_queue");
  const query = useScreenQuery(
    "ledger",
    (signal) => trpcClient.screen.ledger.query(undefined, { signal }),
    [],
    canRead,
  );
  if (!canRead) {
    return (
      <BottomSheet
        title="Akses dibatasi"
        description="Peran Anda tidak memiliki akses ke antrean persetujuan."
      ></BottomSheet>
    );
  }
  if (query.data === undefined || isAccessRevoked(query.error)) {
    return (
      <DetailQueryState
        kind="approval"
        query={query}
        title="Detail persetujuan"
        onRetry={() => void query.refetch()}
        onClose={() => router.back()}
      />
    );
  }
  const item =
    query.data.status === "ready"
      ? query.data.overview.dashboardDetails.approvals.find((entry) => entry.id === id)
      : undefined;
  if (!item) {
    return (
      <BottomSheet
        title="Persetujuan tidak tersedia"
        description="Pengajuan ini sudah ditangani atau tidak tersedia dalam akses Anda."
      ></BottomSheet>
    );
  }
  const critical = approvalIsCritical(item);
  const warning = !critical && item.priority === "WARNING";
  const typeLabel =
    item.type === "project_cost"
      ? "Biaya lapangan"
      : item.type === "inventory_opening"
        ? "Saldo awal stok"
        : "Tagihan vendor";
  const cleanNotes = item.notes?.replace(/^\[Kategori:\s*[^\]]+\]\s*/i, "").trim();
  return (
    <BottomSheet
      title="Detail persetujuan"
      footer={
        <Button
          onPress={() =>
            navigate(
              item.type === "inventory_opening" ? "/materials/opening" : "/ledger?tab=approvals",
              true,
            )
          }
        >
          Buka persetujuan di web
        </Button>
      }
    >
      <ScreenRefreshNotice query={query} />
      <SummarySurface
        label={typeLabel}
        icon={item.type === "inventory_opening" ? "inventory" : "approval"}
        status={critical ? "Risiko tinggi" : warning ? "Perlu perhatian" : "Siap ditinjau"}
        statusTone={critical ? "critical" : warning ? "warning" : "neutral"}
      >
        <View style={styles.row}>
          <Text style={styles.subject}>{item.description}</Text>
          <Text style={styles.meta}>Diajukan {shortDate(item.createdAt)}</Text>
          <Text style={styles.meta}>Nilai pengajuan</Text>
          <MoneyValue amount={item.amount} variant="fullDynamic" size="2xl" />
          <Text style={styles.priority}>{item.priorityReason}</Text>
        </View>
      </SummarySurface>
      <Text style={styles.section}>Konteks pengajuan</Text>
      <GroupedSurface>
        <FactRow
          label={item.type === "inventory_opening" ? "Ruang kerja" : "Proyek"}
          value={item.projectName}
        />
        <FactRow label="Pengaju" value={item.requestedBy} />
        <FactRow
          label={item.type === "inventory_opening" ? "Cakupan" : "Kategori"}
          value={item.budgetItemName}
        />
        <FactRow
          label="Jatuh tempo"
          value={item.dueDate ? shortDate(item.dueDate) : "Tidak ditentukan"}
        />
        {cleanNotes ? (
          <View style={styles.row}>
            <Text style={styles.meta}>Catatan</Text>
            <Text selectable style={styles.title}>
              {cleanNotes}
            </Text>
          </View>
        ) : null}
      </GroupedSurface>
      <Text style={styles.section}>Dokumen pendukung</Text>
      <ApprovalProof key={item.id} url={item.receiptImageUrl} />
      <ApprovalImpact item={item} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { padding: theme.spacing.md, gap: theme.spacing.xs },
  heading: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  money: { maxWidth: "45%", flexShrink: 1 },
  unitCost: { alignItems: "flex-end", maxWidth: "62%", gap: theme.spacing.base },
  title: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.row,
  },
  subject: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.section,
  },
  section: {
    paddingHorizontal: theme.spacing.base,
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.row,
  },
  meta: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.support,
  },
  priority: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  proofAction: { padding: theme.spacing.sm, gap: theme.spacing.xs },
  proof: {
    height: 190,
    width: "100%",
    borderRadius: theme.radii.inset,
    backgroundColor: theme.colors.surfaceContainer,
  },
  proofExpanded: { height: 420 },
  proofCaption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.xs,
    padding: theme.spacing.base,
  },
});
