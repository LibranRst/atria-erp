"use client";

import {
  useCan,
  useCurrentUserProfile,
  usePermissions,
} from "@/components/auth/permissions-provider";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import { updateBrowserUrl, useUrlSearchParam } from "@/lib/utils/use-url-search-param";

import type {
  CountView,
  MaterialOperationsDashboard,
} from "@/app/actions/material/operations-dashboard";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { MaterialDesktopWorkspace } from "../desktop/material-desktop-workspace";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { GoodsReceiptSheet } from "@/features/materials/components/sheets/goods-receipt-sheet";
import {
  AppIcon,
  Badge,
  ConfirmationDialog,
  OperationSuccessDialog,
  PageHeader,
  SwitchRow,
  Textarea,
  PageState,
} from "@/components/ui";
import { MaterialDetail } from "@/features/materials/components/sheets/material-operation-sheets";
import {
  EmergencyAdjustSheet,
  InventoryLocationSheet,
  ProjectMaterialOperationSheet,
  ReceiptDetailSheet,
  StockCountSheet,
  TransferSheet,
} from "@/features/materials/components/shared/material-operation-dialogs";
import {
  MaterialActivityTab,
  MaterialInventoryTab,
  MaterialNeedsTab,
  MaterialOverviewTab,
} from "@/features/materials/components/tabs/material-dashboard-tabs";
import { useMaterialControlDerivedData } from "@/features/materials/hooks/use-material-control-derived-data";
import { useMaterialControlOperations } from "@/features/materials/hooks/use-material-control-operations";
import { MaterialTabsNavigation } from "@/features/materials/components/tabs/material-tabs-navigation";
import {
  toMaterialTab,
  type MaterialTab,
  type WarehouseAction,
} from "@/features/materials/utils/material-ui-utils";

export function MaterialsControlCenter({
  data: incomingData,
}: {
  readonly data: MaterialOperationsDashboard;
}): React.JSX.Element {
  const can = useCan();
  const actor = useCurrentUserProfile();
  const permissions = usePermissions();
  const router = useRouter();
  const desktop = useWorkspacePresentation() === "desktop";
  const stockCountReturnFocusRef = useRef<HTMLElement | null>(null);
  const stockCountToolbarFocusRef = useRef<HTMLButtonElement | null>(null);
  const [snapshot, setSnapshot] = useState(incomingData);
  const [desktopCountDraft, setDesktopCountDraft] = useState<CountView | null>(null);
  const [countToLoad, setCountToLoad] = useState<CountView | null>(null);
  const [activityReadRevision, setActivityReadRevision] = useState(0);
  const invalidateActivityReads = useCallback(
    (): void => setActivityReadRevision((revision) => revision + 1),
    [],
  );
  const data = useMemo(
    (): MaterialOperationsDashboard =>
      desktopCountDraft
        ? {
            ...snapshot,
            counts: [
              ...new Map(
                [...snapshot.counts, desktopCountDraft].map((row) => [row.id, row]),
              ).values(),
            ],
          }
        : snapshot,
    [snapshot, desktopCountDraft],
  );
  const actorScope = JSON.stringify({
    userId: actor?.id,
    sessionId: actor?.sessionId,
    roleId: actor?.roleId,
    dataScope: actor?.dataScope,
    permissions: [...permissions].sort(),
    capabilities: data.capabilities,
  });
  const activityRefreshToken = useMemo(
    () => ({ data, revision: activityReadRevision, actorScope }),
    [data, activityReadRevision, actorScope],
  );
  const documentToken = useId().replaceAll(":", "").toUpperCase();
  const urlTab = useUrlSearchParam("tab");
  const tab = toMaterialTab(urlTab);
  const [activityNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [activityType, setActivityType] = useState("ALL");
  const [activityProject, setActivityProject] = useState("ALL");
  const [activityLocation, setActivityLocation] = useState("ALL");
  const [activityPeriod, setActivityPeriod] = useState("ALL");
  const urlAction = useUrlSearchParam("action") as WarehouseAction | "RECEIVE" | null;
  const action = urlAction && urlAction !== "RECEIVE" ? urlAction : null;
  const {
    pending,
    detailMaterialId,
    receiptDetail,
    projectId,
    rapItemId,
    locationId,
    quantity,
    note,
    fromLocationId,
    toLocationId,
    documentNumber,
    items,
    counted,
    stockCountId,
    success,
    decision,
    decisionReason,
    emergencyOverride,
    message,
    movements,
    movementsHasMore,
    newLocationName,
    adjustDirection,
    setDetailMaterialId,
    setReceiptDetail,
    setProjectId,
    setRapItemId,
    setLocationId,
    setQuantity,
    setNote,
    setFromLocationId,
    setToLocationId,
    setDocumentNumber,
    setItems,
    setCounted,
    setDecision,
    setDecisionReason,
    setEmergencyOverride,
    setNewLocationName,
    setAdjustDirection,
    setSuccess,
    closeAction,
    runProjectOperation,
    runTransfer,
    addLocation,
    initializeCount,
    loadCountDraft,
    runCount,
    runAdjust,
    decide,
    loadMore,
    handleQuickOperation,
  } = useMaterialControlOperations({
    data,
    action,
    documentToken,
    onMutationComplete: invalidateActivityReads,
  });

  const overlayOpen = Boolean(urlAction || detailMaterialId || receiptDetail || decision);
  if (!overlayOpen && !pending && snapshot !== incomingData) setSnapshot(incomingData);
  if (action === "COUNT" && countToLoad) {
    loadCountDraft(countToLoad.id, countToLoad);
    setCountToLoad(null);
  }
  if (action !== "COUNT" && !countToLoad && desktopCountDraft !== null) setDesktopCountDraft(null);

  function selectTab(nextTab: MaterialTab): void {
    const params = new URLSearchParams(window.location.search);
    if (nextTab === "overview") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    updateBrowserUrl(
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      "replace",
    );
  }

  const {
    locations,
    inventoryLocations,
    materials,
    grouped,
    visibleMaterials,
    movementTypes,
    visibleMovements,
    locationOptions,
    activityProjectOptions,
    activityLocationOptions,
    visibleReceipts,
    selectedProject,
    selectedRap,
    selectedMaterial,
    totalStockValue,
    availableValue,
    lowCount,
    pendingApprovals,
  } = useMaterialControlDerivedData({
    data,
    movements,
    filters: {
      search,
      location,
      status,
      activityType,
      activityProject,
      activityLocation,
      activityPeriod,
    },
    activityNow,
    projectId,
    rapItemId,
  });

  const projectOperationValid = Boolean(
    selectedRap?.materialId &&
    locationId &&
    Number(quantity) > 0 &&
    note.trim().length >= (action === "WASTE" ? 10 : 3),
  );
  const shortageCount = data.shortages.filter((row) => row.needToBuy > 0).length;

  return (
    <section
      className={
        desktop ? "min-w-0 space-y-4 pb-8" : "space-y-sm pb-8 select-none max-[430px]:pb-6"
      }
    >
      <div hidden={desktop} inert={desktop} className={desktop ? "hidden" : "space-y-sm"}>
        <header className="space-y-2 px-1">
          <PageHeader
            eyebrow="Kontrol material"
            title="Material & Stok"
            subtitle="Posisi stok, kebutuhan project, dan aktivitas gudang."
            action={
              <Badge status={data.capabilities.canOperate ? "PRIMARY" : "DRAFT"}>
                {data.capabilities.canOperate ? roleLabel(data.roleName) : "HANYA LIHAT"}
              </Badge>
            }
          />
          {message && (
            <div
              className="flex min-h-10 items-center gap-2 px-1 text-meta font-semibold text-primary"
              role="status"
            >
              <AppIcon name="info" className="icon-sm" />
              <span className="min-w-0 flex-1">{message}</span>
            </div>
          )}
        </header>

        <MaterialTabsNavigation
          value={tab}
          onChange={selectTab}
          shortageCount={shortageCount}
          attentionCount={lowCount}
        />

        {tab === "overview" && (
          <MaterialOverviewTab
            data={data}
            totalStockValue={totalStockValue}
            availableValue={availableValue}
            lowCount={lowCount}
            pendingApprovals={pendingApprovals}
            movements={movements}
            onDecision={setDecision}
            onNavigate={selectTab}
          />
        )}

        {tab === "inventory" && (
          <MaterialInventoryTab
            search={search}
            location={location}
            status={status}
            locations={inventoryLocations}
            visibleMaterials={visibleMaterials}
            canManage={data.capabilities.canOperate}
            onSearchChange={setSearch}
            onLocationChange={setLocation}
            onStatusChange={setStatus}
            onOpenMaterial={setDetailMaterialId}
            onAddLocation={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("action", "LOCATION");
              const query = params.toString();
              updateBrowserUrl(`${window.location.pathname}${query ? `?${query}` : ""}`, "replace");
            }}
          />
        )}

        {tab === "needs" &&
          (data.shortagesSource && data.shortagesSource.status !== "ready" ? (
            <PageState
              kind={data.shortagesSource.status === "restricted" ? "restricted" : "error"}
              title="Kebutuhan RAP belum tersedia"
              description={data.shortagesSource.message ?? "Data kebutuhan belum dapat dimuat."}
            />
          ) : (
            <MaterialNeedsTab data={data} />
          ))}

        {tab === "activity" && (
          <MaterialActivityTab
            activityType={activityType}
            activityPeriod={activityPeriod}
            activityProject={activityProject}
            activityLocation={activityLocation}
            movementTypes={movementTypes}
            activityProjectOptions={activityProjectOptions}
            activityLocationOptions={activityLocationOptions}
            visibleReceipts={visibleReceipts}
            visibleMovements={visibleMovements}
            movementsHasMore={movementsHasMore}
            transfers={data.transfers}
            counts={data.counts}
            pending={pending}
            onActivityTypeChange={setActivityType}
            onActivityPeriodChange={setActivityPeriod}
            onActivityProjectChange={setActivityProject}
            onActivityLocationChange={setActivityLocation}
            onOpenReceipt={setReceiptDetail}
            onLoadMore={loadMore}
          />
        )}
      </div>
      <div hidden={!desktop} inert={!desktop} className={desktop ? "min-w-0" : "hidden"}>
        <MaterialDesktopWorkspace
          activityReturnFocusRef={stockCountReturnFocusRef}
          countToolbarFocusRef={stockCountToolbarFocusRef}
          data={data}
          refreshToken={activityRefreshToken}
          grouped={grouped}
          tab={tab}
          active={desktop}
          suspended={overlayOpen || pending}
          pending={pending}
          totalStockValue={totalStockValue}
          availableValue={availableValue}
          lowCount={lowCount}
          onNavigate={selectTab}
          onOperation={handleQuickOperation}
          onOpenMaterial={setDetailMaterialId}
          onOpenReceipt={setReceiptDetail}
          onDecision={setDecision}
          onReload={() => {
            if (!overlayOpen && !pending) {
              invalidateActivityReads();
              router.refresh();
            }
          }}
          onLoadCountDraft={(row) => {
            if (!row.canEdit) return;
            setDesktopCountDraft(row);
            setCountToLoad(row);
            handleQuickOperation("COUNT");
          }}
        />
      </div>

      <ProjectMaterialOperationSheet
        action={action}
        open={Boolean(action && ["RESERVE", "USE", "RETURN", "WASTE"].includes(action))}
        pending={pending}
        valid={projectOperationValid}
        message={message}
        projects={data.projects}
        selectedProject={selectedProject}
        selectedMaterial={selectedMaterial}
        projectId={projectId}
        rapItemId={rapItemId}
        locationId={locationId}
        quantity={quantity}
        note={note}
        onProjectChange={(value: string) => {
          setProjectId(value);
          setRapItemId("");
          setLocationId("");
        }}
        onRapItemChange={(value: string) => {
          setRapItemId(value);
          setLocationId("");
        }}
        onLocationChange={setLocationId}
        onQuantityChange={setQuantity}
        onNoteChange={setNote}
        onClose={closeAction}
        onSubmit={() => runProjectOperation(selectedRap)}
      />

      <InventoryLocationSheet
        open={action === "LOCATION"}
        pending={pending}
        name={newLocationName}
        activeMaterialCount={materials.length}
        onNameChange={setNewLocationName}
        onClose={closeAction}
        onSubmit={addLocation}
      />

      <TransferSheet
        open={action === "TRANSFER"}
        pending={pending}
        locations={locations}
        locationOptions={locationOptions}
        materials={materials}
        inventory={data.inventory}
        documentNumber={documentNumber}
        note={note}
        fromLocationId={fromLocationId}
        toLocationId={toLocationId}
        items={items}
        newLocationName={newLocationName}
        onDocumentNumberChange={setDocumentNumber}
        onNoteChange={setNote}
        onFromLocationChange={setFromLocationId}
        onToLocationChange={setToLocationId}
        onItemsChange={setItems}
        onNewLocationNameChange={setNewLocationName}
        onAddLocation={addLocation}
        onClose={closeAction}
        onSubmit={runTransfer}
      />

      <StockCountSheet
        returnFocusRef={
          desktop
            ? tab === "activity"
              ? stockCountReturnFocusRef
              : stockCountToolbarFocusRef
            : undefined
        }
        open={action === "COUNT"}
        pending={pending}
        inventory={data.inventory}
        existingDrafts={data.counts.filter((row) => row.canEdit)}
        stockCountId={stockCountId}
        locationOptions={locationOptions}
        documentNumber={documentNumber}
        note={note}
        locationId={locationId}
        counted={counted}
        onDocumentNumberChange={setDocumentNumber}
        onNoteChange={setNote}
        onLocationChange={initializeCount}
        onCountedChange={setCounted}
        onLoadDraft={loadCountDraft}
        onClose={closeAction}
        onSaveDraft={() => runCount("SAVE")}
        onSubmit={() => runCount("SUBMIT")}
      />

      <EmergencyAdjustSheet
        open={action === "ADJUST"}
        pending={pending}
        locationOptions={locationOptions}
        materials={materials}
        inventory={data.inventory}
        locationId={locationId}
        items={items}
        note={note}
        adjustDirection={adjustDirection}
        onLocationChange={setLocationId}
        onItemsChange={setItems}
        onNoteChange={setNote}
        onAdjustDirectionChange={setAdjustDirection}
        onClose={closeAction}
        onSubmit={runAdjust}
      />

      {data.capabilities.canReceive && (
        <GoodsReceiptSheet
          projects={data.projects}
          locations={locations}
          materials={materials}
          inventory={data.inventory}
          vendorBills={data.bills}
          showTrigger={false}
          onMutationComplete={invalidateActivityReads}
        />
      )}
      <MaterialDetail
        openId={detailMaterialId}
        grouped={grouped}
        movements={movements}
        onClose={() => setDetailMaterialId(null)}
      />
      <ReceiptDetailSheet
        receipt={receiptDetail}
        canRequestReversal={data.capabilities.canRequestReversal}
        onClose={() => setReceiptDetail(null)}
        onRequestReversal={(receiptId: string) => {
          setDecision({ type: "RECEIPT_REQUEST", id: receiptId });
          setDecisionReason("");
        }}
      />
      <ConfirmationDialog
        open={Boolean(decision)}
        title={
          decision?.type.includes("RECEIPT")
            ? "Keputusan pembatalan penerimaan"
            : "Keputusan stock opname"
        }
        description="Keputusan akan dicatat permanen di audit log."
        confirmLabel={
          decision?.type.includes("REJECT")
            ? "Tolak"
            : decision?.type.includes("REQUEST")
              ? "Kirim Permintaan"
              : "Setujui & Posting"
        }
        danger={Boolean(decision?.type.includes("REJECT") || decision?.type.includes("REQUEST"))}
        pending={pending}
        disabled={Boolean(
          decision &&
          (decision.type.includes("REJECT") ||
            decision.type.includes("REQUEST") ||
            emergencyOverride) &&
          decisionReason.trim().length < 10,
        )}
        onClose={() => {
          setDecision(null);
          setDecisionReason("");
          setEmergencyOverride(false);
        }}
        onConfirm={decide}
      >
        {decision &&
        ((can("override:self_approval") &&
          !decision.type.includes("REJECT") &&
          !decision.type.includes("REQUEST")) ||
          decision.type.includes("REJECT") ||
          decision.type.includes("REQUEST") ||
          emergencyOverride) ? (
          <div className="space-y-2 text-left">
            {can("override:self_approval") &&
            !decision.type.includes("REJECT") &&
            !decision.type.includes("REQUEST") ? (
              <SwitchRow
                checked={emergencyOverride}
                onChange={setEmergencyOverride}
                title="Gunakan emergency override"
                description="Khusus Owner saat pembuat keputusan harus melakukan self-approval."
              />
            ) : null}
            <AnimatePresence initial={false}>
              {(decision.type.includes("REJECT") ||
                decision.type.includes("REQUEST") ||
                emergencyOverride) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transitionSpringSmooth}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <Textarea
                      autoFocus
                      rows={3}
                      value={decisionReason}
                      onChange={setDecisionReason}
                      placeholder="Jelaskan alasan, minimal 10 karakter"
                      aria-label="Alasan keputusan material"
                      aria-invalid={
                        decisionReason.trim().length > 0 && decisionReason.trim().length < 10
                      }
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </ConfirmationDialog>
      <OperationSuccessDialog success={success} onClose={() => setSuccess(null)} />
    </section>
  );
}

function roleLabel(roleName: string): string {
  // Label peran, bukan keputusan akses: nama perannya sendiri yang ditampilkan
  // supaya peran kustom tidak menyamar sebagai Owner.
  return formatBusinessLabel(roleName).toUpperCase();
}
