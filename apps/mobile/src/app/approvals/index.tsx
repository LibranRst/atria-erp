import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import {
  Button,
  FactRow,
  FormField,
  FormSection,
  GroupedSurface,
  MoneyValue,
  ScreenMessage,
  ScreenSkeleton,
  SegmentedTabs,
  SelectionSheet,
  SheetSelect,
  StatusBadge,
  SummarySurface,
  TextInput,
  type SelectOption,
} from "@/components/ui";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

type ApprovalTab = "queue" | "payment";

export default function ApprovalsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { roleName } = useAuth();
  const permissions = roleName ? (ROLE_PERMISSIONS[roleName] ?? []) : [];
  const [tab, setTab] = useState<ApprovalTab>("queue");
  const [candidateId, setCandidateId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [selection, setSelection] = useState<"candidate" | "bank" | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const query = useQuery({
    queryKey: ["screen", "approvals"],
    queryFn: () => trpcClient.screen.approvals.query(),
  });

  if (!permissions.includes("approve:cost") && !permissions.includes("approve:opening_inventory")) {
    return <Redirect href="/" />;
  }
  if (query.isPending) return <ScreenSkeleton rows={5} />;
  if (query.isError) {
    return (
      <ScreenMessage
        description="Antrean persetujuan belum dapat dimuat."
        onAction={() => void query.refetch()}
        title="Data belum tersedia"
      />
    );
  }
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

  async function payCost(): Promise<void> {
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
      toast.error("Pembayaran belum berhasil. Tidak ada saldo yang diubah.");
    } finally {
      setIsPaying(false);
    }
  }

  const pickerOptions = selection === "candidate" ? candidateOptions : bankOptions;
  const pickerValue = selection === "candidate" ? candidateId : bankAccountId;
  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
        ]}
        refreshControl={
          <RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />
        }
      >
        <SegmentedTabs
          accessibilityLabel="Bagian persetujuan"
          onChange={setTab}
          options={[
            { value: "queue", label: "Menunggu", badge: query.data.approvals.length },
            { value: "payment", label: "Siap dibayar", badge: query.data.paymentCandidates.length },
          ]}
          value={tab}
        />

        {tab === "queue" ? (
          <>
            <SummarySurface amount={totalPending} label="Nilai menunggu keputusan">
              <FactRow label="Jumlah pengajuan" value={String(query.data.approvals.length)} />
            </SummarySurface>
            <GroupedSurface>
              {query.data.approvals.length === 0 ? (
                <FactRow label="Antrean" value="Tidak ada keputusan tertunda" />
              ) : (
                query.data.approvals.map((item) => (
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
              Keputusan approval yang mengubah status tetap dilakukan melalui alur web pada fase
              ini.
            </Text>
          </>
        ) : (
          <>
            <FormSection
              helper="Pembayaran hanya dapat diproses untuk biaya berstatus disetujui."
              title="Realisasi pembayaran"
            >
              <SheetSelect
                label="Biaya disetujui"
                onPress={() => setSelection("candidate")}
                options={candidateOptions}
                required
                value={candidateId}
              />
              <SheetSelect
                label="Rekening sumber"
                onPress={() => setSelection("bank")}
                options={bankOptions}
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
            <Button loading={isPaying} onPress={() => void payCost()}>
              Catat pembayaran
            </Button>
            <Text style={styles.helper}>
              Sistem memeriksa approval Owner untuk nominal Rp5 juta ke atas atau budget overrun,
              menulis mutasi kas dan audit log dalam satu transaksi.
            </Text>
          </>
        )}
      </ScrollView>

      <SelectionSheet
        onClose={() => setSelection(null)}
        onSelect={(value) => {
          if (selection === "candidate") setCandidateId(value);
          if (selection === "bank") setBankAccountId(value);
        }}
        options={pickerOptions}
        title={selection === "candidate" ? "Pilih biaya disetujui" : "Pilih rekening sumber"}
        value={pickerValue}
        visible={selection !== null}
      />
    </>
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
