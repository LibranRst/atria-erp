import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import type { ExpenseDraftPayloadInput } from "@atria/core/validations/expense-draft";
import type { ExpenseLine } from "@atria/core/types/expenses";
import { createClientId } from "@atria/core/utils/client-id";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { toast } from "sonner-native";

import {
  AppIcon,
  Button,
  FormField,
  FormSection,
  MoneyInput,
  QuantityStepper,
  ScreenMessage,
  ScreenSkeleton,
  SelectionSheet,
  SheetSelect,
  TextInput,
  WorkflowFormSheet,
  type SelectOption,
} from "@/components/ui";
import {
  clearLocalExpenseDraft,
  readLocalExpenseDraft,
  writeLocalExpenseDraft,
} from "@/lib/draft-storage";
import { uploadAndParseReceipt } from "@/lib/receipt-ocr";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

type SelectionTarget =
  | { readonly kind: "project" }
  | { readonly kind: "category"; readonly lineKey: string }
  | { readonly kind: "material"; readonly lineKey: string }
  | { readonly kind: "stock"; readonly lineKey: string }
  | { readonly kind: "location"; readonly lineKey: string }
  | null;

function blankLine(): ExpenseLine {
  return {
    key: createClientId("expense-line"),
    projectBudgetCategoryId: "",
    projectBudgetItemId: "",
    materialId: "",
    projectRapItemId: "",
    projectCategoryPlanItemId: "",
    stockHandling: "EXPENSE_ONLY",
    inventoryLocationId: "",
    quantity: 1,
    unitPrice: "",
    amount: "",
    description: "",
  };
}

function blankPayload(): ExpenseDraftPayloadInput {
  return {
    projectId: "",
    inputMode: "MANUAL",
    receipt: null,
    lines: [blankLine()],
    ocrWarning: null,
  };
}

const stockOptions: readonly SelectOption[] = [
  { value: "EXPENSE_ONLY", label: "Biaya saja", description: "Tidak mengubah stok." },
  { value: "STOCK_IN", label: "Masuk stok", description: "Tambah barang ke lokasi stok." },
  { value: "DIRECT_USE", label: "Langsung dipakai", description: "Dipakai langsung untuk proyek." },
  { value: "RESERVE_FOR_PROJECT", label: "Reservasi", description: "Tahan stok untuk proyek ini." },
];

export default function NewExpenseScreen(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { roleName, user } = useAuth();
  const permissions = roleName ? (ROLE_PERMISSIONS[roleName] ?? []) : [];
  const [payload, setPayload] = useState<ExpenseDraftPayloadInput>(blankPayload);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const query = useQuery({
    queryKey: ["screen", "new-expense"],
    queryFn: () => trpcClient.screen.newExpense.query(),
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void readLocalExpenseDraft(user.id).then((draft) => {
      if (!active) return;
      if (draft) {
        setPayload(draft.payload);
        setDraftId(draft.draftId);
        setRevision(draft.revision);
      }
      setDraftHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !draftHydrated) return;
    void writeLocalExpenseDraft(user.id, {
      draftId,
      revision,
      payload,
      savedAt: new Date().toISOString(),
    });
  }, [draftHydrated, draftId, payload, revision, user]);

  const selectedProject = query.data?.projects.find((project) => project.id === payload.projectId);
  const categories = useMemo(
    () =>
      selectedProject?.canonicalBudgets
        ?.find((budget) => budget.status === "ACTIVE" || budget.status === "APPROVED")
        ?.categories?.slice()
        .sort((a, b) => a.sortOrder - b.sortOrder) ?? [],
    [selectedProject],
  );
  const projectOptions: readonly SelectOption[] =
    query.data?.projects.map((project) => ({ value: project.id, label: project.name })) ?? [];
  const categoryOptions: readonly SelectOption[] = categories.map((category) => ({
    value: category.id,
    label: category.name,
    description: `Sisa Rp ${new Intl.NumberFormat("id-ID").format(Number(category.remainingAmount))}`,
  }));
  const materialOptions: readonly SelectOption[] =
    selectedProject?.materialOptions?.map((material) => ({
      value: material.id,
      label: material.name,
      description: `${material.availableStock} ${material.unit} tersedia`,
    })) ?? [];
  const locationOptions: readonly SelectOption[] =
    query.data?.inventoryLocations.map((location) => ({
      value: location.id,
      label: location.name,
    })) ?? [];

  function updateLine(lineKey: string, patch: Partial<ExpenseLine>): void {
    setPayload((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.key === lineKey
          ? {
              ...line,
              ...patch,
              amount:
                "quantity" in patch || "unitPrice" in patch
                  ? Number(patch.quantity ?? line.quantity) *
                    Number(patch.unitPrice ?? line.unitPrice)
                  : (patch.amount ?? line.amount),
            }
          : line,
      ),
    }));
  }

  async function saveDraft(): Promise<{ readonly id: string; readonly revision: number } | null> {
    if (!user) return null;
    setIsSaving(true);
    try {
      const result = await trpcClient.finance.saveExpenseDraft.mutate({
        draftId: draftId ?? undefined,
        expectedRevision: revision ?? undefined,
        payload,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return null;
      }
      setDraftId(result.data.id);
      setRevision(result.data.revision);
      await writeLocalExpenseDraft(user.id, {
        draftId: result.data.id,
        revision: result.data.revision,
        payload: result.data.payload,
        savedAt: result.data.lastSavedAt.toISOString(),
      });
      toast.success("Draft tersimpan di perangkat dan server.");
      return { id: result.data.id, revision: result.data.revision };
    } catch {
      toast.error("Draft tetap tersimpan di perangkat. Server belum dapat dijangkau.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDraft(): Promise<void> {
    if (!user) return;
    if (!payload.projectId) {
      toast.error("Pilih proyek sebelum mengajukan biaya.");
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const result = await trpcClient.finance.submitExpenseDraft.mutate({
        draftId: saved.id,
        expectedRevision: saved.revision,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      await clearLocalExpenseDraft(user.id);
      await queryClient.invalidateQueries({ queryKey: ["screen", "expenses"] });
      toast.success(`${result.data.itemCount} biaya berhasil diajukan.`);
      router.back();
    } catch {
      toast.error("Pengajuan belum terkirim. Draft tetap aman untuk dicoba kembali.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function scanAsset(source: "camera" | "library"): Promise<void> {
    if (!selectedProject) {
      toast.error("Pilih proyek sebelum memindai bukti transaksi.");
      return;
    }
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.error("Izin kamera diperlukan untuk memindai bukti transaksi.");
        return;
      }
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;

    setIsScanning(true);
    try {
      const parsed = await uploadAndParseReceipt(result.assets[0], categories);
      setPayload((current) => ({
        ...current,
        inputMode: "RECEIPT",
        receipt: parsed.attachment,
        lines: parsed.lines.length > 0 ? [...parsed.lines] : current.lines,
        ocrWarning: parsed.warning,
      }));
      toast.success("Bukti tersimpan. Periksa hasil pembacaan sebelum mengajukan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bukti belum berhasil diproses.");
    } finally {
      setIsScanning(false);
    }
  }

  function openScanner(): void {
    Alert.alert("Tambahkan bukti transaksi", "Pilih sumber gambar yang ingin dipakai.", [
      { text: "Kamera", onPress: () => void scanAsset("camera") },
      { text: "Galeri", onPress: () => void scanAsset("library") },
      { text: "Batal", style: "cancel" },
    ]);
  }

  function selectionProps(): {
    readonly title: string;
    readonly value: string;
    readonly options: readonly SelectOption[];
  } {
    if (!selection) return { title: "Pilih", value: "", options: [] };
    if (selection.kind === "project") {
      return { title: "Pilih proyek", value: payload.projectId, options: projectOptions };
    }
    const line = payload.lines.find((item) => item.key === selection.lineKey);
    if (selection.kind === "category") {
      return {
        title: "Pilih kategori budget",
        value: line?.projectBudgetCategoryId ?? "",
        options: categoryOptions,
      };
    }
    if (selection.kind === "material") {
      return { title: "Pilih material", value: line?.materialId ?? "", options: materialOptions };
    }
    if (selection.kind === "location") {
      return {
        title: "Pilih lokasi stok",
        value: line?.inventoryLocationId ?? "",
        options: locationOptions,
      };
    }
    return {
      title: "Pilih perlakuan stok",
      value: line?.stockHandling ?? "EXPENSE_ONLY",
      options: stockOptions,
    };
  }

  function applySelection(value: string): void {
    if (!selection) return;
    if (selection.kind === "project") {
      setPayload((current) => ({
        ...current,
        projectId: value,
        lines: current.lines.map((line) => ({
          ...line,
          projectBudgetCategoryId: "",
          materialId: "",
          inventoryLocationId: "",
          stockHandling: "EXPENSE_ONLY",
        })),
      }));
      return;
    }
    if (selection.kind === "category")
      updateLine(selection.lineKey, { projectBudgetCategoryId: value });
    if (selection.kind === "material") updateLine(selection.lineKey, { materialId: value });
    if (selection.kind === "location")
      updateLine(selection.lineKey, { inventoryLocationId: value });
    if (selection.kind === "stock") {
      updateLine(selection.lineKey, { stockHandling: value as ExpenseLine["stockHandling"] });
    }
  }

  if (!permissions.includes("create:cost")) return <Redirect href="/" />;
  if (query.isPending) return <ScreenSkeleton rows={5} />;
  if (query.isError || !query.data) {
    return (
      <ScreenMessage
        description="Pilihan proyek dan budget belum dapat dimuat."
        onAction={() => void query.refetch()}
        title="Form belum siap"
      />
    );
  }

  const picker = selectionProps();
  return (
    <>
      <WorkflowFormSheet
        description="Pilih budget kategori yang benar. Draft tersimpan otomatis di perangkat."
        footer={
          <>
            <Button
              loading={isSaving}
              onPress={() => void saveDraft()}
              style={styles.footerButton}
              variant="secondary"
            >
              Simpan draft
            </Button>
            <Button
              loading={isSubmitting}
              onPress={() => void submitDraft()}
              style={styles.footerButton}
            >
              Ajukan biaya
            </Button>
          </>
        }
        title="Catat biaya proyek"
      >
        <FormSection title="Konteks proyek">
          <SheetSelect
            label="Proyek"
            onPress={() => setSelection({ kind: "project" })}
            options={projectOptions}
            required
            value={payload.projectId}
          />
        </FormSection>

        <View style={styles.receiptSection}>
          {payload.receipt ? (
            <Image contentFit="cover" source={payload.receipt.url} style={styles.receiptImage} />
          ) : (
            <View style={styles.receiptIcon}>
              <AppIcon color={theme.colors.onSurfaceVariant} name="receipt_long" size={24} />
            </View>
          )}
          <View style={styles.receiptCopy}>
            <Text style={styles.receiptTitle}>
              {payload.receipt ? "Bukti sudah tersimpan" : "Scan bukti transaksi"}
            </Text>
            <Text style={styles.receiptDescription}>
              Kamera atau galeri dapat mengisi rincian item dengan OCR.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isScanning}
            onPress={openScanner}
            style={styles.scanButton}
          >
            <AppIcon
              color={theme.colors.accent}
              name={isScanning ? "progress_activity" : "photo_camera"}
              size={19}
              weight="bold"
            />
          </Pressable>
        </View>
        {payload.ocrWarning ? <Text style={styles.warning}>{payload.ocrWarning}</Text> : null}

        {payload.lines.map((line, index) => {
          const category = categories.find((item) => item.id === line.projectBudgetCategoryId);
          const isMaterial = category?.code === "MATERIAL";
          return (
            <FormSection
              key={line.key}
              action={
                payload.lines.length > 1 ? (
                  <Pressable
                    accessibilityLabel={`Hapus item ${index + 1}`}
                    onPress={() =>
                      setPayload((current) => ({
                        ...current,
                        lines: current.lines.filter((item) => item.key !== line.key),
                      }))
                    }
                    style={styles.removeButton}
                  >
                    <AppIcon color={theme.colors.critical} name="delete" size={16} />
                  </Pressable>
                ) : null
              }
              title={`Item ${index + 1}`}
            >
              <SheetSelect
                label="Kategori budget"
                onPress={() => setSelection({ kind: "category", lineKey: line.key })}
                options={categoryOptions}
                required
                value={line.projectBudgetCategoryId}
              />
              <FormField label="Deskripsi" required>
                <TextInput
                  accessibilityLabel={`Deskripsi item ${index + 1}`}
                  onChangeText={(description) => updateLine(line.key, { description })}
                  placeholder="Contoh: pembelian cat interior"
                  value={line.description}
                />
              </FormField>
              <FormField label="Kuantitas" required>
                <QuantityStepper
                  onChange={(quantity) => updateLine(line.key, { quantity })}
                  value={Number(line.quantity) || 1}
                />
              </FormField>
              <FormField label="Harga satuan" required>
                <MoneyInput
                  accessibilityLabel={`Harga satuan item ${index + 1}`}
                  onChange={(unitPrice) => updateLine(line.key, { unitPrice })}
                  value={line.unitPrice}
                />
              </FormField>
              <FormField label="Total" readOnly>
                <MoneyInput
                  accessibilityLabel={`Total item ${index + 1}`}
                  onChange={() => undefined}
                  value={line.amount}
                />
              </FormField>
              {isMaterial ? (
                <>
                  <SheetSelect
                    label="Perlakuan stok"
                    onPress={() => setSelection({ kind: "stock", lineKey: line.key })}
                    options={stockOptions}
                    value={line.stockHandling}
                  />
                  {line.stockHandling !== "EXPENSE_ONLY" ? (
                    <>
                      <SheetSelect
                        label="Material"
                        onPress={() => setSelection({ kind: "material", lineKey: line.key })}
                        options={materialOptions}
                        required
                        value={line.materialId}
                      />
                      <SheetSelect
                        label="Lokasi stok"
                        onPress={() => setSelection({ kind: "location", lineKey: line.key })}
                        options={locationOptions}
                        required
                        value={line.inventoryLocationId}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </FormSection>
          );
        })}

        <Button
          leading={<AppIcon color={theme.colors.onSurface} name="add" size={18} weight="bold" />}
          onPress={() =>
            setPayload((current) => ({ ...current, lines: [...current.lines, blankLine()] }))
          }
          variant="secondary"
        >
          Tambah item
        </Button>
      </WorkflowFormSheet>

      <SelectionSheet
        onClose={() => setSelection(null)}
        onSelect={applySelection}
        options={picker.options}
        title={picker.title}
        value={picker.value}
        visible={selection !== null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  footerButton: { flex: 1 },
  receiptSection: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radii.owner,
    backgroundColor: theme.colors.surfaceContainerLowest,
    padding: theme.spacing.sm,
  },
  receiptIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  receiptImage: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.icon,
    backgroundColor: theme.colors.surfaceContainerLow,
  },
  receiptCopy: { flex: 1, minWidth: 0, gap: 2 },
  receiptTitle: {
    color: theme.colors.onSurface,
    fontFamily: theme.fonts.bold,
    ...theme.typography.support,
  },
  receiptDescription: {
    color: theme.colors.onSurfaceVariant,
    fontFamily: theme.fonts.regular,
    ...theme.typography.meta,
  },
  scanButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.capsule,
    backgroundColor: theme.colors.accentContainer,
  },
  warning: {
    color: theme.colors.warningOnContainer,
    fontFamily: theme.fonts.semibold,
    ...theme.typography.support,
  },
  removeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radii.capsule,
  },
});
