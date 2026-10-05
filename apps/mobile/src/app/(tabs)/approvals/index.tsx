import { useScreenQuery, useOnline } from "@/lib/use-screen-query";
import { useScreenScroll, useScreenSelection } from "@/lib/use-screen-memory";
import { isAccessRevoked } from "@/lib/access-error";
import { ScreenQueryState, ScreenRefreshNotice } from "@/components/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import {
  AdaptiveSelect,
  ApprovalsSkeleton,
  Button,
  ExclusiveSearchFilterBar,
  FactRow,
  FormField,
  FormSection,
  GroupedSurface,
  MoneyValue,
  ScreenMessage,
  SegmentedTabs,
  StatusBadge,
  SummarySurface,
  TextInput,
  type SelectOption,
} from "@/components/ui";
import { approvalIsCritical } from "@atria/core/finance/approval-summary";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";
import { TAB_BAR_CLEARANCE } from "@/constants/scroll-insets";

type ApprovalTab = "queue" | "payment";
type ApprovalFilter = "ALL" | "FIELD" | "VENDOR" | "STOCK" | "CRITICAL";

export default function ApprovalsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const [tab, setTab] = useScreenSelection<ApprovalTab>("approvals", "queue");
  const scroll = useScreenScroll("approvals");
  const [candidateId, setCandidateId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [filter, setFilter] = useScreenSelection<ApprovalFilter>("approvals-filter", "ALL");
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const previousFilter = useRef<ApprovalFilter>(filter);
  const scrollRef = useRef<ScrollView>(null);
  const readingPosition = useRef(scroll.contentOffset.y);
  const searchOrigin = useRef(0);
  const online = useOnline();
  const [isPaying, setIsPaying] = useState(false);
  const query = useScreenQuery("approvals", (signal) =>
    trpcClient.screen.approvals.query(undefined, { signal }),
  );

  if (!permissions.includes("view:approval_queue")) {
    return <Redirect href="/" />;
  }
  if (query.data === undefined || isAccessRevoked(query.error))
    return (
      <ScrollView
        {...scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + TAB_BAR_CLEARANCE },
        ]}
      >
        <ScreenQueryState
          query={query}
          skeleton={<ApprovalsSkeleton tab={tab} />}
          onRetry={() => void query.refetch()}
        />
      </ScrollView>
    );
  if (!query.data || query.data.status === "restricted") {
    return (
      <ScreenMessage
        description="Peran Anda tidak memiliki akses ke antrean ini."
        icon="lock"
        title="Akses dibatasi"
      />
    );
  }

  const candidateOptions: readonly SelectOption[] = query.data.paymentCandidates.map((item) => ({
    value: item.id,
    label: item.description,
    description: `${item.projectName} · Rp ${new Intl.NumberFormat("id-ID").format(Number(item.amount))}`,
  }));
  const bankOptions: readonly SelectOption[] = query.data.bankAccounts.map((account) => ({
    value: account.id,
    label: account.name,
    description: `${account.bankName} · •••• ${account.accountNumber.slice(-4)}`,
  }));
  const selectedCandidate = query.data.paymentCandidates.find((item) => item.id === candidateId);
  const totalPending = query.data.approvals.reduce((sum, item) => sum + item.amount, 0);
  const normalizedSearch = searchText.trim().toLocaleLowerCase("id-ID");
  const visibleApprovals = query.data.approvals.filter((item) => {
    if (normalizedSearch)
      return `${item.description} ${item.projectName} ${item.requestedBy} ${item.priorityReason}`
        .toLocaleLowerCase("id-ID")
        .includes(normalizedSearch);
    if (filter === "FIELD") return item.type === "project_cost";
    if (filter === "VENDOR") return item.type === "vendor_payment";
    if (filter === "STOCK") return item.type === "inventory_opening";
    if (filter === "CRITICAL") return approvalIsCritical(item);
    return true;
  });

  function changeSearchMode(open: boolean): void {
    if (open) {
      previousFilter.current = filter;
      searchOrigin.current = readingPosition.current;
      setFilter("ALL");
    } else {
      setFilter(previousFilter.current);
      setSearchText("");
      requestAnimationFrame(() => {
        requestAnimationFrame(() =>
          scrollRef.current?.scrollTo({ y: searchOrigin.current, animated: false }),
        );
      });
    }
    setSearchOpen(open);
  }

  async function payCost(): Promise<void> {
    if (!online) {
      toast.error("Hubungkan ke internet untuk mencatat pembayaran.");
      return;
    }
    if (!candidateId || !bankAccountId || !referenceNumber.trim()) {
      toast.error("Pilih biaya, rekening, dan isi referensi bank.");
      return;
    }
    setIsPaying(true);
    try {
      const result = await trpcClient.finance.payFieldRequest.mutate({
        projectCostId: candidateId,
        bankAccountId,
        referenceNumber,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Pembayaran tercatat dan saldo rekening diperbarui.");
      setCandidateId("");
      setReferenceNumber("");
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["screen", "ledger"] }),
        queryClient.invalidateQueries({ queryKey: ["screen", "expenses"] }),
      ]);
    } catch {
      toast.error("Status pembayaran belum dapat dipastikan. Periksa transaksi sebelum mengulangi.");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <ScrollView
      {...scroll}
      ref={scrollRef}
      onScroll={(event) => {
        scroll.onScroll(event);
        readingPosition.current = event.nativeEvent.contentOffset.y;
      }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + TAB_BAR_CLEARANCE },
      ]}
      refreshControl={
        <RefreshControl refreshing={query.isRefreshing} onRefresh={() => void query.refresh()} />
      }
    >
      <ScreenRefreshNotice query={query} />
      <SegmentedTabs
        accessibilityLabel="Bagian persetujuan"
        onChange={(next) => {
          if (searchOpen) {
            setFilter(previousFilter.current);
            setSearchText("");
            setSearchOpen(false);
          }
          setTab(next);
        }}
        options={[
          { value: "queue", label: "Menunggu", badge: query.data.approvals.length },
          { value: "payment", label: "Siap dibayar", badge: query.data.paymentCandidates.length },
        ]}
        value={tab}
      />

      {tab === "queue" ? (
        <>
          <ExclusiveSearchFilterBar
            query={searchText}
            onQueryChange={setSearchText}
            onOpenChange={changeSearchMode}
            accessibilityLabel="Cari antrean persetujuan"
            searchPlaceholder="Cari proyek, pengaju, keterangan"
          >
            <SegmentedTabs
              accessibilityLabel="Filter persetujuan"
              value={filter}
              onChange={setFilter}
              scrollable
              options={[
                { value: "ALL", label: "Semua" },
                { value: "FIELD", label: "Lapangan" },
                { value: "VENDOR", label: "Vendor" },
                { value: "STOCK", label: "Stok" },
                { value: "CRITICAL", label: "Risiko" },
              ]}
            />
          </ExclusiveSearchFilterBar>
          <SummarySurface amount={totalPending} label="Nilai menunggu keputusan">
            <FactRow label="Jumlah pengajuan" value={String(query.data.approvals.length)} />
          </SummarySurface>
          <GroupedSurface>
            {visibleApprovals.length === 0 ? (
              <FactRow
                label="Antrean"
                value={
                  query.data.approvals.length === 0
                    ? "Tidak ada keputusan tertunda"
                    : "Tidak ada pengajuan yang cocok"
                }
              />
            ) : (
              visibleApprovals.map((item) => (
                <View key={item.id} style={styles.listRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.description}</Text>
                    <Text style={styles.rowDescription}>
                      {item.projectName} · {item.requestedBy}
                    </Text>
                    <Text style={styles.reason}>{item.priorityReason}</Text>
                  </View>
                  <View style={styles.rowEnd}>
                    <MoneyValue
                      align="right"
                      amount={item.amount}
                      size="sm"
                      variant="compactWithFull"
                    />
                    <StatusBadge status={item.priority} />
                  </View>
                </View>
              ))
            )}
          </GroupedSurface>
          <Text style={styles.helper}>
            Keputusan approval yang mengubah status tetap dilakukan melalui alur web pada fase ini.
          </Text>
        </>
      ) : (
        <>
          <FormSection
            helper="Pembayaran hanya dapat diproses untuk biaya berstatus disetujui."
            title="Realisasi pembayaran"
          >
            <AdaptiveSelect
              label="Biaya disetujui"
              onChange={setCandidateId}
              options={candidateOptions}
              disabled={isPaying}
              required
              value={candidateId}
            />
            <AdaptiveSelect
              label="Rekening sumber"
              onChange={setBankAccountId}
              options={bankOptions}
              disabled={isPaying}
              required
              value={bankAccountId}
            />
            <FormField label="Referensi bank" required>
              <TextInput
                accessibilityLabel="Nomor referensi bank"
                autoCapitalize="characters"
                onChangeText={setReferenceNumber}
                placeholder="Contoh: TRX-2026-001"
                value={referenceNumber}
              />
            </FormField>
          </FormSection>
          {selectedCandidate ? (
            <GroupedSurface>
              <FactRow label="Proyek" value={selectedCandidate.projectName} />
              <FactRow
                label="Nominal"
                value={
                  <MoneyValue
                    amount={Number(selectedCandidate.amount)}
                    size="sm"
                    variant="compactWithFull"
                  />
                }
              />
              <FactRow
                label="Guardrail"
                value={selectedCandidate.budgetOverrun ? "Melebihi budget" : "Approval terpenuhi"}
              />
            </GroupedSurface>
          ) : null}
          <Button disabled={!online} loading={isPaying} onPress={() => void payCost()}>
            Catat pembayaran
          </Button>
          <Text style={styles.helper}>
            Sistem memeriksa approval Owner untuk nominal Rp5 juta ke atas atau budget overrun,
            menulis mutasi kas dan audit log dalam satu transaksi.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.marginMobile,
    paddingTop: theme.spacing.md,
  },
  listRow: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  rowDescription: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  reason: {
    color: theme.colors.warningOnContainer,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.meta,
  },
  rowEnd: { maxWidth: "44%", alignItems: "flex-end", gap: theme.spacing.base },
  helper: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    paddingHorizontal: theme.spacing.base,
    ...theme.typography.meta,
  },
});
