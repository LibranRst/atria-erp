import { useScreenQuery, useOnline } from "@/lib/use-screen-query";
import { isAccessRevoked } from "@/lib/access-error";
import { screenLoadState } from "@/lib/screen-query-state";
import { ScreenQueryState, ScreenRefreshNotice } from "@/components/ui";
import type { ExpenseDraftPayloadInput } from "@atria/core/validations/expense-draft";
import { validateExpenseForm } from "@/features/expenses/expense-form-validation";
import type { ExpenseLine } from "@atria/core/types/expenses";
import { createClientId } from "@atria/core/utils/client-id";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { toast } from "sonner-native";

import {
  AppIcon,
  Button,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  AdaptiveSelect,
  OptionChoiceGroup,
  ExpenseFormSkeleton,
  SkeletonFooter,
  LoadingImage,
  MediaPreviewDialog,
  SuccessDialog,
  RowAction,
  TextInput,
  WorkflowFormSheet,
  BottomSheet,
  useSheetDismissal,
  useSheetFormFields,
  type SelectOption,
} from "@/components/ui";
import {
  type LocalExpenseDraft,
  clearLocalExpenseDraft,
  readLocalExpenseDraft,
  writeLocalExpenseDraft,
} from "@/lib/draft-storage";
import { uploadAndParseReceipt, receiptImageSource } from "@/lib/receipt-ocr";
import { trpcClient } from "@/lib/trpc-client";
import { useAuth } from "@/providers/auth-provider";
import { theme } from "@/theme";

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
  const queryClient = useQueryClient();
  const { permissions, user } = useAuth();
  const userId = user?.id;
  const [payload, setPayload] = useState<ExpenseDraftPayloadInput>(blankPayload);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const initialPayload = useRef(payload);
  const loadedDraft = useRef<LocalExpenseDraft | null>(null);
  const autosaveStopped = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  const [baseline, setBaseline] = useState(JSON.stringify(payload));
  const fields = useSheetFormFields();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const pending = isSaving || isSubmitting || isScanning || submittedCount !== null;
  const dismissal = useSheetDismissal({
    dirty: draftHydrated && JSON.stringify(payload) !== baseline,
    pending,
    fields,
    onDiscard: async (): Promise<void> => {
      if (!userId) return;
      autosaveStopped.current = true;
      await writeQueue.current;
      if (loadedDraft.current) await writeLocalExpenseDraft(userId, loadedDraft.current);
      else await clearLocalExpenseDraft(userId);
    },
  });
  const online = useOnline();
  const query = useScreenQuery("new-expense", (signal) =>
    trpcClient.screen.newExpense.query(undefined, { signal }),
  );

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readLocalExpenseDraft(userId).then((draft) => {
      if (!active) return;
      loadedDraft.current = draft;
      setBaseline(JSON.stringify(draft?.payload ?? initialPayload.current));
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
  }, [userId]);

  useEffect(() => {
    if (!userId || !draftHydrated || autosaveStopped.current) return;
    const snapshot: LocalExpenseDraft = {
      draftId,
      revision,
      payload,
      savedAt: new Date().toISOString(),
    };
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => writeLocalExpenseDraft(userId, snapshot));
  }, [draftHydrated, draftId, payload, revision, userId]);

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
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => {
          const property = field.startsWith(`${lineKey}.`)
            ? field.slice(lineKey.length + 1)
            : undefined;
          return (
            !property ||
            (!(property in patch) &&
              !(property === "amount" && ("quantity" in patch || "unitPrice" in patch)))
          );
        }),
      ),
    );
    setServerError(null);
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
    if (!online) {
      toast.error(
        "Draft tetap tersimpan di perangkat. Hubungkan ke internet untuk menyimpan ke server.",
      );
      return null;
    }
    const controlErrors = fields.validateControls();
    if (Object.keys(controlErrors).length) {
      setFieldErrors({ ...controlErrors });
      const first = Object.keys(controlErrors)[0];
      if (first) fields.focus(first);
      return null;
    }
    setServerError(null);
    setIsSaving(true);
    try {
      const result = await trpcClient.finance.saveExpenseDraft.mutate({
        draftId: draftId ?? undefined,
        expectedRevision: revision ?? undefined,
        payload,
      });
      if (!result.success) {
        setServerError(result.error.message);
        toast.error(result.error.message);
        return null;
      }
      setDraftId(result.data.id);
      setRevision(result.data.revision);
      await writeQueue.current;
      const savedLocal: LocalExpenseDraft = {
        draftId: result.data.id,
        revision: result.data.revision,
        payload: result.data.payload,
        savedAt: result.data.lastSavedAt.toISOString(),
      };
      await writeLocalExpenseDraft(user.id, savedLocal);
      loadedDraft.current = savedLocal;
      setBaseline(JSON.stringify(payload));
      toast.success("Draft tersimpan di perangkat dan server.");
      return { id: result.data.id, revision: result.data.revision };
    } catch {
      setServerError("Server belum dapat dijangkau. Draft tetap tersimpan di perangkat.");
      toast.error("Draft tetap tersimpan di perangkat. Server belum dapat dijangkau.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDraft(): Promise<void> {
    if (!online) {
      toast.error("Hubungkan ke internet untuk mengajukan biaya.");
      return;
    }
    if (!user) return;
    const controlErrors = fields.validateControls();
    if (Object.keys(controlErrors).length) {
      setFieldErrors({ ...controlErrors });
      const first = Object.keys(controlErrors)[0];
      if (first) fields.focus(first);
      return;
    }
    const validation = validateExpenseForm(payload);
    if (validation.firstField) {
      setFieldErrors(validation.errors);
      const first = validation.firstField;
      requestAnimationFrame(() => fields.focus(first));
      return;
    }
    setFieldErrors({});
    setServerError(null);
    setIsSubmitting(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const result = await trpcClient.finance.submitExpenseDraft.mutate({
        draftId: saved.id,
        expectedRevision: saved.revision,
      });
      if (!result.success) {
        setServerError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      autosaveStopped.current = true;
      await writeQueue.current;
      await clearLocalExpenseDraft(user.id);
      await queryClient.invalidateQueries({ queryKey: ["screen", "expenses"] });
      toast.success(`${result.data.itemCount} biaya berhasil diajukan.`);
      setSubmittedCount(result.data.itemCount);
    } catch {
      setServerError("Pengajuan belum terkirim. Draft tetap aman untuk dicoba kembali.");
      toast.error("Pengajuan belum terkirim. Draft tetap aman untuk dicoba kembali.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function scanAsset(source: "camera" | "library"): Promise<void> {
    if (!online) {
      toast.error("Hubungkan ke internet untuk mengunggah dan membaca bukti.");
      return;
    }
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
      const parsed = await uploadAndParseReceipt(result.assets[0], categories, selectedProject.id);
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

  function selectProject(value: string): void {
    setFieldErrors({});
    setServerError(null);
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
  }
  function selectStock(lineKey: string, value: string): void {
    if (
      value === "EXPENSE_ONLY" ||
      value === "STOCK_IN" ||
      value === "DIRECT_USE" ||
      value === "RESERVE_FOR_PROJECT"
    )
      updateLine(lineKey, { stockHandling: value });
  }

  const loading = screenLoadState(query, online) === "loading";
  if (!permissions.includes("create:cost")) return <Redirect href="/" />;
  if (!draftHydrated || query.data === undefined || isAccessRevoked(query.error))
    return (
      <BottomSheet
        title="Catat biaya proyek"
        sizing="maximum"
        dismissal={dismissal}
        description="Pilih budget kategori yang benar. Draft tersimpan otomatis di perangkat."
        contentPhase={loading ? "loading" : "ready"}
        footer={loading ? <SkeletonFooter /> : undefined}
      >
        <ScreenQueryState
          query={query}
          skeleton={<ExpenseFormSkeleton lineCount={draftHydrated ? payload.lines.length : 1} />}
          onRetry={() => void query.refetch()}
        />
      </BottomSheet>
    );
  return (
    <>
      <WorkflowFormSheet
        description="Pilih budget kategori yang benar. Draft tersimpan otomatis di perangkat."
        loadingContent={<ExpenseFormSkeleton lineCount={payload.lines.length} />}
        bodyOverlay={
          <>
            <MediaPreviewDialog
              visible={previewReceipt && Boolean(payload.receipt)}
              source={receiptImageSource(payload.receipt?.url ?? "")}
              title="Bukti transaksi"
              onClose={() => setPreviewReceipt(false)}
            />
            <SuccessDialog
              visible={submittedCount !== null}
              title="Biaya berhasil diajukan"
              description="Pengajuan sudah masuk ke alur pemeriksaan."
              facts={[{ label: "Jumlah item", value: String(submittedCount ?? 0) }]}
              onClose={dismissal.complete}
            />
          </>
        }
        dismissal={dismissal}
        fields={fields}
        footerStatus={serverError}
        headerActions={[
          {
            id: "save-draft",
            label: "Simpan draft",
            icon: "save",
            systemImage: "square.and.arrow.down",
            disabled: !online || pending,
            onPress: () => void saveDraft(),
          },
        ]}
        footer={
          <Button
            disabled={!online || isSaving || isScanning || submittedCount !== null}
            loading={isSubmitting}
            onPress={() => void submitDraft()}
          >
            Ajukan biaya
          </Button>
        }
        title="Catat biaya proyek"
      >
        <ScreenRefreshNotice query={query} />
        <FormSection title="Konteks proyek">
          <AdaptiveSelect
            disabled={pending}
            fieldId="project"
            error={fieldErrors.project}
            label="Proyek"
            onChange={selectProject}
            options={projectOptions}
            required
            value={payload.projectId}
          />
        </FormSection>

        <View style={styles.receiptSection}>
          {payload.receipt ? (
            <RowAction
              accessibilityLabel="Lihat bukti transaksi"
              onPress={() => setPreviewReceipt(true)}
              style={styles.receiptImage}
            >
              <LoadingImage
                retryable={false}
                contentFit="cover"
                source={receiptImageSource(payload.receipt.url)}
                style={styles.receiptImage}
              />
            </RowAction>
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
          <RowAction
            accessibilityLabel={
              payload.receipt ? "Scan ulang bukti transaksi" : "Scan bukti transaksi"
            }
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
          </RowAction>
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
                  <RowAction
                    accessibilityLabel={`Hapus item ${index + 1}`}
                    disabled={pending}
                    onPress={() =>
                      setPayload((current) => ({
                        ...current,
                        lines: current.lines.filter((item) => item.key !== line.key),
                      }))
                    }
                    style={styles.removeButton}
                  >
                    <AppIcon color={theme.colors.critical} name="delete" size={16} />
                  </RowAction>
                ) : null
              }
              title={`Item ${index + 1}`}
            >
              <AdaptiveSelect
                disabled={pending}
                fieldId={`${line.key}.projectBudgetCategoryId`}
                error={fieldErrors[`${line.key}.projectBudgetCategoryId`]}
                label="Kategori budget"
                onChange={(projectBudgetCategoryId) =>
                  updateLine(line.key, { projectBudgetCategoryId })
                }
                options={categoryOptions}
                required
                value={line.projectBudgetCategoryId}
              />
              <FormField
                fieldId={`${line.key}.description`}
                error={fieldErrors[`${line.key}.description`]}
                label="Deskripsi"
                required
              >
                <TextInput
                  editable={!pending}
                  accessibilityLabel={`Deskripsi item ${index + 1}`}
                  onChangeText={(description) => updateLine(line.key, { description })}
                  placeholder="Contoh: pembelian cat interior"
                  value={line.description}
                />
              </FormField>
              <FormField
                fieldId={`${line.key}.quantity`}
                error={fieldErrors[`${line.key}.quantity`]}
                label="Kuantitas"
                required
              >
                <NumericInput
                  disabled={pending}
                  accessibilityLabel={`Kuantitas item ${index + 1}`}
                  fieldId={`${line.key}.quantity`}
                  error={fieldErrors[`${line.key}.quantity`]}
                  strictlyPositive
                  onChange={(quantity) => updateLine(line.key, { quantity })}
                  value={Number(line.quantity)}
                />
              </FormField>
              <FormField
                fieldId={`${line.key}.unitPrice`}
                error={fieldErrors[`${line.key}.unitPrice`]}
                label="Harga satuan"
                required
              >
                <MoneyInput
                  accessibilityLabel={`Harga satuan item ${index + 1}`}
                  editable={!pending}
                  onChange={(unitPrice) => updateLine(line.key, { unitPrice })}
                  value={line.unitPrice}
                />
              </FormField>
              <FormField
                fieldId={`${line.key}.amount`}
                error={fieldErrors[`${line.key}.amount`]}
                label="Total"
                readOnly
              >
                <MoneyInput
                  editable={false}
                  accessibilityLabel={`Total item ${index + 1}`}
                  onChange={() => undefined}
                  value={line.amount}
                />
              </FormField>
              {isMaterial ? (
                <>
                  <OptionChoiceGroup
                    label="Perlakuan stok"
                    onChange={(value) => selectStock(line.key, value)}
                    options={stockOptions}
                    disabled={pending}
                    value={line.stockHandling}
                  />
                  {line.stockHandling !== "EXPENSE_ONLY" ? (
                    <>
                      <AdaptiveSelect
                        disabled={pending}
                        fieldId={`${line.key}.materialId`}
                        error={fieldErrors[`${line.key}.materialId`]}
                        label="Material"
                        onChange={(materialId) => updateLine(line.key, { materialId })}
                        options={materialOptions}
                        required
                        value={line.materialId}
                      />
                      <AdaptiveSelect
                        disabled={pending}
                        fieldId={`${line.key}.inventoryLocationId`}
                        error={fieldErrors[`${line.key}.inventoryLocationId`]}
                        label="Lokasi stok"
                        onChange={(inventoryLocationId) =>
                          updateLine(line.key, { inventoryLocationId })
                        }
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
          size="regular"
          disabled={pending}
          leading={<AppIcon color={theme.colors.onSurface} name="add" size={18} weight="bold" />}
          onPress={() =>
            setPayload((current) => ({ ...current, lines: [...current.lines, blankLine()] }))
          }
          variant="secondary"
        >
          Tambah item
        </Button>
      </WorkflowFormSheet>
    </>
  );
}

const styles = StyleSheet.create({
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
