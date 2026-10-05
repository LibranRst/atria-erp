"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { toast } from "sonner";

import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { decideInventoryOpening } from "@/app/actions/material/opening-inventory";
import {
  CompactFormDialog,
  ConfirmationDialog,
  DetailSection,
  DesktopTable,
  Button,
  ExclusiveSearchFilterBar,
  FormField,
  MediaPreviewDialog,
  MoneyValue,
  PageState,
  RowGroup,
  type SearchFilterMode,
  SummaryFact,
  SummarySurface,
  Textarea,
} from "@/components/ui";
import {
  APPROVAL_PAGE_SIZE,
  approvalIsCritical,
  approvalRejectionPlaceholder,
  paginateApprovalGroups,
} from "@/features/approvals/utils/approval-list-utils";
import {
  ApprovalDecisionReasonFields,
  approvalRequiresEmergencyOverride,
  approvalRequiresOpeningReason,
} from "@/features/approvals/components/shared/approval-decision-reason-fields";
import { usePreservedScrollHeight } from "@/lib/hooks/use-preserved-scroll-height";
import { summarizeApprovals } from "@atria/core/finance/approval-summary";
import { WORKSPACE_STICKY_CONTROLS_ENABLED } from "@atria/core/presentation/presentation-flags";
import { getErrorMessage } from "@atria/core/utils/error-message";
import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import {
  ApprovalDecisionSubject,
  ApprovalDetailContent,
  ApprovalDetailSheet,
  ApprovalQueueRow,
  type ApprovalDecision,
  type ApprovalItem,
} from "./approval-list-presentation";

export { ApprovalDetailContent } from "./approval-list-presentation";
export type { ApprovalItem } from "./approval-list-presentation";

type ApprovalFilter = "ALL" | "FIELD" | "VENDOR" | "STOCK" | "CRITICAL";

interface ApprovalListProps {
  readonly initialApprovals: readonly ApprovalItem[];
  readonly canEmergencyOverride?: boolean;
  readonly referenceDateIso: string;
}

export function ApprovalList({
  initialApprovals,
  canEmergencyOverride = true,
  referenceDateIso,
}: ApprovalListProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const router = useRouter();
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([...initialApprovals]);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<ApprovalFilter>("ALL");
  const [controlMode, setControlMode] = React.useState<SearchFilterMode>("filter");
  const [selected, setSelected] = React.useState<ApprovalItem | null>(null);
  const [decision, setDecision] = React.useState<ApprovalDecision | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [approvalReason, setApprovalReason] = React.useState("");
  const [emergencyOverride, setEmergencyOverride] = React.useState(false);
  const [emergencyReason, setEmergencyReason] = React.useState("");
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [olderVisibleLimit, setOlderVisibleLimit] = React.useState(APPROVAL_PAGE_SIZE);
  const {
    containerRef: resultsRef,
    containerStyle: resultsStyle,
    preserveScrollPosition,
  } = usePreservedScrollHeight(filter);
  const stickyControlRef = React.useRef<HTMLDivElement | null>(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const rejectionMinimum = decision?.item.type === "inventory_opening" ? 10 : 5;
  const stickyActive = WORKSPACE_STICKY_CONTROLS_ENABLED && isSticky;
  const [pending, startTransition] = React.useTransition();
  const referenceDate = React.useMemo(() => new Date(referenceDateIso), [referenceDateIso]);
  const shouldReduceStickyMotion = useReducedMotion();
  const hasApprovals = approvals.length > 0;
  const stickyTransition = shouldReduceStickyMotion ? { duration: 0 } : transitionSpringSmooth;
  const surfaceTransition = shouldReduceStickyMotion ? { duration: 0 } : transitionEaseSmooth;

  React.useEffect(() => {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;

    const stickyControl = stickyControlRef.current;
    if (!stickyControl) return;
    let frameId: number | null = null;

    const updateStickyState = (): void => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const nextSticky = window.scrollY > 0 && stickyControl.getBoundingClientRect().top <= 64.5;
        setIsSticky((current) => (current === nextSticky ? current : nextSticky));
      });
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, [hasApprovals]);

  const counts = React.useMemo(
    () => ({
      critical: approvals.filter(approvalIsCritical).length,
      field: approvals.filter((item) => item.type === "project_cost").length,
      vendor: approvals.filter((item) => item.type === "vendor_payment").length,
      stock: approvals.filter((item) => item.type === "inventory_opening").length,
    }),
    [approvals],
  );
  const approvalSummary = React.useMemo(
    () => summarizeApprovals(approvals, referenceDate),
    [approvals, referenceDate],
  );

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return approvals.filter((item) => {
      const matchesQuery =
        normalized.length === 0 ||
        item.projectName.toLowerCase().includes(normalized) ||
        item.requestedBy.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "FIELD" && item.type === "project_cost") ||
        (filter === "VENDOR" && item.type === "vendor_payment") ||
        (filter === "STOCK" && item.type === "inventory_opening") ||
        (filter === "CRITICAL" && approvalIsCritical(item));
      return controlMode === "search" ? matchesQuery : matchesFilter;
    });
  }, [approvals, controlMode, filter, query]);

  const queuePage = React.useMemo(
    () => paginateApprovalGroups(filtered, olderVisibleLimit, referenceDate),
    [filtered, olderVisibleLimit, referenceDate],
  );

  function preserveStickyResultsPosition(): void {
    if (!WORKSPACE_STICKY_CONTROLS_ENABLED) return;
    preserveScrollPosition();
  }

  function changeFilter(value: ApprovalFilter): void {
    preserveStickyResultsPosition();
    setOlderVisibleLimit(APPROVAL_PAGE_SIZE);
    setFilter(value);
  }

  function changeControlMode(mode: SearchFilterMode): void {
    preserveStickyResultsPosition();
    setOlderVisibleLimit(APPROVAL_PAGE_SIZE);
    setQuery("");
    setControlMode(mode);
    if (mode === "search" && filter !== "ALL") {
      setFilter("ALL");
    }
  }

  function requestDecision(item: ApprovalItem, status: ApprovalDecision["status"]): void {
    setDecision({ item, status });
    if (status === "REJECTED") setRejectionReason("");
    if (status === "APPROVED") {
      setApprovalReason("");
      setEmergencyOverride(false);
      setEmergencyReason("");
    }
  }

  function closeDecision(): void {
    if (pending) return;
    setDecision(null);
    setRejectionReason("");
    setApprovalReason("");
    setEmergencyOverride(false);
    setEmergencyReason("");
  }

  function confirmDecision(): void {
    if (!decision) return;
    const requiresEmergencyOverride = approvalRequiresEmergencyOverride(
      decision.item,
      canEmergencyOverride,
    );
    const requiresOpeningReason = approvalRequiresOpeningReason(
      decision.item,
      canEmergencyOverride,
    );
    if (
      decision.status === "REJECTED" &&
      rejectionReason.trim().length < (decision.item.type === "inventory_opening" ? 10 : 5)
    ) {
      toast.error(
        `Tuliskan alasan penolakan minimal ${decision.item.type === "inventory_opening" ? 10 : 5} karakter.`,
      );
      return;
    }
    if (
      decision.status === "APPROVED" &&
      requiresOpeningReason &&
      approvalReason.trim().length < 10
    ) {
      toast.error("Alasan persetujuan minimal 10 karakter.");
      return;
    }
    if (decision.status === "APPROVED" && requiresEmergencyOverride && !emergencyOverride) {
      toast.error("Aktifkan emergency override untuk persetujuan sendiri.");
      return;
    }
    if (decision.status === "APPROVED" && emergencyOverride && emergencyReason.trim().length < 10) {
      toast.error("Alasan emergency override minimal 10 karakter.");
      return;
    }

    const { item, status } = decision;
    startTransition(async () => {
      try {
        const notes =
          status === "APPROVED"
            ? emergencyOverride
              ? emergencyReason.trim()
              : item.type === "inventory_opening"
                ? approvalReason.trim()
                : "Disetujui Owner"
            : rejectionReason.trim();
        const response =
          item.type === "inventory_opening"
            ? await decideInventoryOpening({
                batchId: item.referenceId,
                decision: status === "APPROVED" ? "APPROVE" : "REJECT",
                reason: notes,
                emergencyOverride,
              })
            : item.type === "project_cost"
              ? await approveFieldRequest({
                  projectCostId: item.referenceId,
                  status,
                  notes,
                  emergencyOverride,
                })
              : await approveVendorPayment(item.referenceId, notes, status, emergencyOverride);

        if (!response.success) throw new Error(response.error.message);

        setApprovals((current) => current.filter((row) => row.id !== item.id));
        setSelected(null);
        setDecision(null);
        setRejectionReason("");
        setApprovalReason("");
        setEmergencyOverride(false);
        setEmergencyReason("");
        toast.success(
          `${status === "APPROVED" ? "Persetujuan diberikan" : "Pengajuan ditolak"} · Rp ${item.amount.toLocaleString("id-ID")}`,
        );
        router.refresh();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Persetujuan gagal diproses."));
      }
    });
  }

  function resetFilters(): void {
    setQuery("");
    setFilter("ALL");
    setControlMode("filter");
    setOlderVisibleLimit(APPROVAL_PAGE_SIZE);
  }

  return (
    <div className="space-y-sm">
      <SummarySurface
        ariaLabel="Antrean persetujuan"
        eyebrow="Antrean keputusan"
        icon="approval"
        status={approvals.length > 0 ? "Perlu ditinjau" : "Selesai"}
        statusTone={approvals.length > 0 ? "warning" : "positive"}
      >
        <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
          <div className="min-w-0">
            <p className="financial-amount text-[36px] leading-none font-extrabold tracking-[-0.045em] text-on-surface max-[430px]:text-[32px]">
              {approvals.length}
            </p>
            <p className="text-meta font-semibold text-on-surface-variant">
              persetujuan menunggu keputusan
            </p>
          </div>
          <div className="min-w-0 shrink-0 text-right">
            <p className="text-eyebrow font-semibold text-on-surface-variant/60">Total antrean</p>
            <MoneyValue
              amount={approvalSummary.totalAmount}
              variant="compact"
              size="lg"
              align="right"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-2">
          <SummaryFact
            label="Prioritas kritis"
            value={String(approvalSummary.criticalCount)}
            tone={approvalSummary.criticalCount > 0 ? "danger" : "default"}
          />
          <SummaryFact
            label="Menunggu ≥3 hari"
            value={String(approvalSummary.waitingLongCount)}
            tone={approvalSummary.waitingLongCount > 0 ? "warning" : "positive"}
          />
        </div>
      </SummarySurface>

      {hasApprovals ? (
        <motion.div
          ref={stickyControlRef}
          data-sticky={stickyActive ? "true" : "false"}
          data-density={stickyActive ? "floating" : "inline"}
          animate={{
            marginLeft: stickyActive ? -8 : 0,
            marginRight: stickyActive ? -8 : 0,
            padding: stickyActive ? 8 : 0,
          }}
          transition={stickyTransition}
          className={WORKSPACE_STICKY_CONTROLS_ENABLED ? "sticky top-16 z-20" : "relative"}
        >
          <AnimatePresence initial={false}>
            {stickyActive ? (
              <motion.div
                key="sticky-approval-filter-surface"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={surfaceTransition}
                className="pointer-events-none absolute inset-0 rounded-owner bg-white ring-1 ring-ring-subtle"
                aria-hidden="true"
              />
            ) : null}
          </AnimatePresence>
          <div className="relative">
            <ExclusiveSearchFilterBar
              mode={controlMode}
              filterValue={filter}
              onFilterChange={changeFilter}
              filterAriaLabel="Filter persetujuan"
              filterLayoutId="approval-list-filter"
              searchLayoutId="approval-list-search-control"
              searchValue={query}
              onSearchChange={(value) => {
                setOlderVisibleLimit(APPROVAL_PAGE_SIZE);
                setQuery(value);
              }}
              onModeChange={changeControlMode}
              searchPlaceholder="Cari proyek, pengaju, keterangan"
              searchAriaLabel="Cari antrean persetujuan"
              fillAvailableSpace
              filterOptions={[
                { value: "ALL", label: "Semua", count: approvals.length },
                {
                  value: "FIELD",
                  label: "Lapangan",
                  count: counts.field > 0 ? counts.field : undefined,
                },
                {
                  value: "VENDOR",
                  label: "Vendor",
                  count: counts.vendor > 0 ? counts.vendor : undefined,
                },
                {
                  value: "STOCK",
                  label: "Stok",
                  count: counts.stock > 0 ? counts.stock : undefined,
                },
                {
                  value: "CRITICAL",
                  label: "Risiko",
                  count: counts.critical > 0 ? counts.critical : undefined,
                },
              ]}
            />
          </div>
        </motion.div>
      ) : null}

      <div ref={resultsRef} className="space-y-sm" style={resultsStyle}>
        {approvals.length === 0 ? (
          <DetailSection title="Urutan prioritas">
            <PageState
              kind="first-use"
              title="Semua keputusan selesai"
              description="Tidak ada pengajuan finansial yang menunggu otorisasi saat ini."
            />
          </DetailSection>
        ) : filtered.length === 0 ? (
          <DetailSection title="Hasil pencarian">
            <PageState
              kind="filtered-empty"
              title="Antrean tidak ditemukan"
              description={
                controlMode === "search"
                  ? "Coba kata kunci lain atau tutup pencarian."
                  : "Pilih filter lain untuk melihat pengajuan."
              }
              actionLabel={controlMode === "search" ? "Tutup pencarian" : "Reset filter"}
              onAction={resetFilters}
            />
          </DetailSection>
        ) : desktop ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <DesktopTable
              ariaLabel="Antrean persetujuan"
              rows={queuePage.groups.flatMap((group) => group.items)}
              rowKey={(item) => item.id}
              selectedRowKey={selected?.id}
              onRowAction={(item) => {
                if (!pending) setSelected(item);
              }}
              columns={[
                {
                  key: "subject",
                  label: "Pengajuan",
                  render: (item) => (
                    <div>
                      <p className="font-semibold">{item.description}</p>
                      <p className="text-meta text-on-surface-variant">
                        {item.projectName} · {item.requestedBy}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "amount",
                  label: "Nilai",
                  align: "end",
                  render: (item) => <MoneyValue amount={item.amount} variant="compact" size="sm" />,
                },
                {
                  key: "risk",
                  label: "Prioritas",
                  render: (item) => (
                    <span
                      className={
                        approvalIsCritical(item) ? "text-error" : "text-on-surface-variant"
                      }
                    >
                      {item.priorityReason}
                    </span>
                  ),
                },
              ]}
            />
            <section
              aria-label="Detail persetujuan"
              className="min-w-0 space-y-4 xl:sticky xl:top-24"
            >
              {selected && filtered.some((item) => item.id === selected.id) ? (
                <>
                  <ApprovalDetailContent item={selected} onOpenReceipt={setActiveImage} />
                  <div className="flex gap-3">
                    <Button
                      variant="criticalQuiet"
                      disabled={pending}
                      onClick={() => requestDecision(selected, "REJECTED")}
                    >
                      Tolak
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => requestDecision(selected, "APPROVED")}
                    >
                      Setujui
                    </Button>
                  </div>
                </>
              ) : (
                <PageState
                  kind="first-use"
                  title="Pilih pengajuan"
                  description="Tinjau bukti dan dampak budget sebelum mengambil keputusan."
                />
              )}
            </section>
          </div>
        ) : (
          queuePage.groups.map((group) => (
            <DetailSection
              key={group.label}
              title={group.label}
              count={group.totalCount}
              countLabel="Pengajuan"
            >
              <RowGroup>
                {group.items.map((item) => (
                  <ApprovalQueueRow
                    key={item.id}
                    item={item}
                    pending={pending}
                    onSelect={() => setSelected(item)}
                  />
                ))}
              </RowGroup>
            </DetailSection>
          ))
        )}

        {queuePage.remainingCount > 0 ? (
          <button
            type="button"
            onClick={() => setOlderVisibleLimit((current) => current + APPROVAL_PAGE_SIZE)}
            aria-label={`Tampilkan ${queuePage.nextPageCount} persetujuan berikutnya dari ${queuePage.remainingCount} tersisa`}
            className="min-h-12 w-full rounded-full bg-surface-container text-xs font-bold text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Tampilkan {queuePage.nextPageCount} berikutnya
          </button>
        ) : null}
      </div>

      <ApprovalDetailSheet
        item={desktop ? null : selected}
        pending={pending}
        onClose={() => {
          if (!pending) setSelected(null);
        }}
        onOpenReceipt={setActiveImage}
        onDecision={requestDecision}
      />

      <ConfirmationDialog
        open={decision?.status === "APPROVED"}
        title="Setujui pengajuan?"
        tone={
          decision?.item && approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride)
            ? "warning"
            : "default"
        }
        description={
          decision?.item.type === "inventory_opening"
            ? "Pastikan jumlah fisik, harga per unit, dan subtotal sudah sesuai. Keputusan dicatat dalam audit log."
            : "Dampak budget sudah ditampilkan di detail. Keputusan ini akan dicatat dalam audit log."
        }
        confirmLabel="Setujui"
        pending={pending}
        disabled={
          (decision?.item.type === "inventory_opening" &&
            approvalRequiresOpeningReason(decision.item, canEmergencyOverride) &&
            approvalReason.trim().length < 10) ||
          (Boolean(
            decision?.item &&
            approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride),
          ) &&
            (!emergencyOverride || emergencyReason.trim().length < 10))
        }
        onClose={closeDecision}
        onConfirm={confirmDecision}
      >
        {decision?.item ? (
          <div className="space-y-3">
            <ApprovalDecisionSubject item={decision.item} />
            {approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride) ||
            approvalRequiresOpeningReason(decision.item, canEmergencyOverride) ? (
              <div className="border-t border-black/5.5 pt-3">
                <ApprovalDecisionReasonFields
                  item={decision.item}
                  canEmergencyOverride={canEmergencyOverride}
                  approvalReason={approvalReason}
                  emergencyOverride={emergencyOverride}
                  emergencyReason={emergencyReason}
                  pending={pending}
                  idPrefix="approval"
                  onApprovalReasonChange={setApprovalReason}
                  onEmergencyOverrideChange={setEmergencyOverride}
                  onEmergencyReasonChange={setEmergencyReason}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </ConfirmationDialog>

      <CompactFormDialog
        open={decision?.status === "REJECTED"}
        title="Alasan penolakan"
        onClose={closeDecision}
        pending={pending}
        actions={
          <button
            type="button"
            disabled={pending || rejectionReason.trim().length < rejectionMinimum}
            onClick={confirmDecision}
            className="min-h-12 w-full rounded-full bg-error px-5 text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
          >
            {pending ? "Menyimpan penolakan" : "Tolak pengajuan"}
          </button>
        }
      >
        <div className="space-y-md">
          {decision?.item ? (
            <div className="rounded-inset bg-white p-4 ring-1 ring-ring-subtle">
              <ApprovalDecisionSubject item={decision.item} />
            </div>
          ) : null}
          <div className="rounded-inset bg-error-container/25 p-4 text-xs leading-5 text-error">
            Pengajuan tidak akan dilanjutkan. Jelaskan alasan yang dapat ditindaklanjuti oleh
            pengaju.
          </div>
          <FormField
            label="Alasan penolakan"
            helper={`Minimal ${rejectionMinimum} karakter.`}
            required
          >
            <Textarea
              id="approval-rejection-reason"
              autoFocus
              rows={4}
              value={rejectionReason}
              onChange={setRejectionReason}
              disabled={pending}
              placeholder={decision?.item ? approvalRejectionPlaceholder(decision.item) : ""}
              aria-invalid={
                rejectionReason.length > 0 && rejectionReason.trim().length < rejectionMinimum
              }
            />
          </FormField>
        </div>
      </CompactFormDialog>

      <MediaPreviewDialog
        open={activeImage !== null}
        title="Bukti pengajuan"
        imageUrl={activeImage}
        alt="Bukti pengajuan"
        onClose={() => setActiveImage(null)}
      />
    </div>
  );
}
