"use client";

import { useId, useState } from "react";
import {
  updateBrowserUrl,
  useUrlSearchParam,
} from "@/lib/utils/use-url-search-param";

import type { MaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { GoodsReceiptSheet } from "./goods-receipt-sheet";
import { Badge } from "@/components/ui/badge";
import { ConfirmationSheet, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/ui/page-primitives";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { MaterialDetail } from "@/features/materials/components/material-operation-sheets";
import {
  EmergencyAdjustSheet,
  ProjectMaterialOperationSheet,
  ReceiptDetailSheet,
  StockCountSheet,
  TransferSheet,
} from "@/features/materials/components/material-operation-dialogs";
import {
  MaterialActivityTab,
  MaterialInventoryTab,
  MaterialNeedsTab,
  MaterialOverviewTab,
} from "@/features/materials/components/material-dashboard-tabs";
import { useMaterialControlDerivedData } from "@/features/materials/components/use-material-control-derived-data";
import { useMaterialControlOperations } from "@/features/materials/components/use-material-control-operations";
import { MaterialSuccessSheet } from "@/features/materials/components/material-form-patterns";
import {
  materialTabs,
  toMaterialTab,
  type MaterialTab,
  type WarehouseAction,
} from "@/features/materials/lib/material-ui-utils";

export function MaterialsControlCenter({
  data,
}: {
  readonly data: MaterialOperationsDashboard;
}): React.JSX.Element {
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
    message,
    movements,
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
  } = useMaterialControlOperations({ data, action, documentToken });

  function selectTab(nextTab: MaterialTab): void {
    const params = new URLSearchParams(window.location.search);
    if (nextTab === "overview") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    updateBrowserUrl(
      `${window.location.pathname}${query ? `?${query}` : ""}`,
      "replace",
    );
  }

  const {
    locations,
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

  return <section className="space-y-lg pb-8 select-none">
    <header className="space-y-sm">
      <PageHeader
        eyebrow="Material Control"
        title="Material & Stock"
        subtitle="Inventory aktual, kebutuhan project, penerimaan, perpindahan, dan audit stock."
        action={
          <Badge status={data.capabilities.canOperate ? "PRIMARY" : "DRAFT"}>
            {data.capabilities.canOperate ? data.roleName : "READ ONLY"}
          </Badge>
        }
      />
      {message && (
        <div className="rounded-[28px] border border-primary/10 bg-primary/5 px-4 py-3 text-xs font-semibold leading-5 text-primary">
          {message}
        </div>
      )}
    </header>

    <SegmentedTabs
      value={tab}
      onChange={selectTab}
      ariaLabel="Material control materialTabs"
      scrollable
      options={materialTabs.map((item) => ({
        value: item.id,
        label: item.label,
        icon: (
          <span className="material-symbols-outlined text-[16px]">
            {item.id === "overview"
              ? "dashboard"
              : item.id === "inventory"
                ? "inventory_2"
                : item.id === "needs"
                  ? "assignment_late"
                  : "history"}
          </span>
        ),
      }))}
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
      />
    )}

    {tab === "inventory" && (
      <MaterialInventoryTab
        search={search}
        location={location}
        status={status}
        locations={locations}
        visibleMaterials={visibleMaterials}
        onSearchChange={setSearch}
        onLocationChange={setLocation}
        onStatusChange={setStatus}
        onOpenMaterial={setDetailMaterialId}
      />
    )}

    {tab === "needs" && <MaterialNeedsTab data={data} />}

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
        movementsLength={movements.length}
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
      onProjectChange={(value) => {
        setProjectId(value);
        setRapItemId("");
        setLocationId("");
      }}
      onRapItemChange={(value) => {
        setRapItemId(value);
        setLocationId("");
      }}
      onLocationChange={setLocationId}
      onQuantityChange={setQuantity}
      onNoteChange={setNote}
      onClose={closeAction}
      onSubmit={() => runProjectOperation(selectedRap)}
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
      onRequestReversal={(receiptId) => {
        setDecision({ type: "RECEIPT_REQUEST", id: receiptId });
        setDecisionReason("");
      }}
    />
    <ConfirmationSheet
      open={Boolean(decision)}
      title={
        decision?.type.includes("RECEIPT")
          ? "Keputusan Reversal Penerimaan"
          : "Keputusan Stock Opname"
      }
      description="Aksi approval/reversal akan dicatat permanen di audit log."
      confirmLabel={
        decision?.type.includes("REJECT")
          ? "Tolak"
          : decision?.type.includes("REQUEST")
            ? "Kirim Permintaan"
            : "Setujui & Posting"
      }
      danger={Boolean(
        decision?.type.includes("REJECT") || decision?.type.includes("REQUEST"),
      )}
      pending={pending}
      disabled={Boolean(
        decision &&
        (decision.type.includes("REJECT") || decision.type.includes("REQUEST")) &&
        decisionReason.trim().length < 10,
      )}
      onClose={() => setDecision(null)}
      onConfirm={decide}
    >
      {decision && (decision.type.includes("REJECT") || decision.type.includes("REQUEST")) ? (
        <Textarea
          autoFocus
          rows={3}
          value={decisionReason}
          onChange={setDecisionReason}
          placeholder="Jelaskan alasan, minimal 10 karakter"
          aria-label="Alasan keputusan material"
          aria-invalid={decisionReason.trim().length > 0 && decisionReason.trim().length < 10}
        />
      ) : null}
    </ConfirmationSheet>
    <MaterialSuccessSheet success={success} onClose={() => setSuccess(null)} />
  </section>;
}
