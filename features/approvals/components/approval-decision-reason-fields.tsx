"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { JSX } from "react";

import { SwitchRow, Textarea } from "@/components/ui";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { transitionSpringSmooth } from "@/lib/utils/motion";

type ApprovalDecisionReasonFieldsProps = {
  readonly item: ApprovalDetail;
  readonly canEmergencyOverride: boolean;
  readonly approvalReason: string;
  readonly emergencyOverride: boolean;
  readonly emergencyReason: string;
  readonly pending: boolean;
  readonly idPrefix: string;
  readonly onApprovalReasonChange: (value: string) => void;
  readonly onEmergencyOverrideChange: (value: boolean) => void;
  readonly onEmergencyReasonChange: (value: string) => void;
};

export function approvalRequiresEmergencyOverride(
  item: ApprovalDetail,
  canEmergencyOverride: boolean,
): boolean {
  return Boolean(
    item.type !== "inventory_opening" && canEmergencyOverride && item.canEmergencyOverride,
  );
}

export function approvalRequiresOpeningReason(
  item: ApprovalDetail,
  canEmergencyOverride: boolean,
): boolean {
  return (
    item.type === "inventory_opening" &&
    !approvalRequiresEmergencyOverride(item, canEmergencyOverride)
  );
}

export function ApprovalDecisionReasonFields({
  item,
  canEmergencyOverride,
  approvalReason,
  emergencyOverride,
  emergencyReason,
  pending,
  idPrefix,
  onApprovalReasonChange,
  onEmergencyOverrideChange,
  onEmergencyReasonChange,
}: ApprovalDecisionReasonFieldsProps): JSX.Element | null {
  const requiresEmergencyOverride = approvalRequiresEmergencyOverride(item, canEmergencyOverride);
  const needsOpeningReason = approvalRequiresOpeningReason(item, canEmergencyOverride);

  if (!needsOpeningReason && !requiresEmergencyOverride) return null;

  return (
    <div className="space-y-3 text-left">
      {needsOpeningReason ? (
        <div>
          <label
            htmlFor={`${idPrefix}-approval-reason`}
            className="px-1 text-xs font-bold text-on-surface"
          >
            Alasan persetujuan
          </label>
          <Textarea
            id={`${idPrefix}-approval-reason`}
            autoFocus
            rows={3}
            value={approvalReason}
            onChange={onApprovalReasonChange}
            disabled={pending}
            placeholder="Contoh: saldo fisik dan harga pokok sesuai dokumen stock opname"
            className="mt-2"
            aria-invalid={approvalReason.length > 0 && approvalReason.trim().length < 10}
          />
          <p className="mt-1 px-1 text-[10px] text-on-surface-variant">
            Wajib diisi minimal 10 karakter. Alasan dicatat di audit log.
          </p>
        </div>
      ) : null}

      {requiresEmergencyOverride ? (
        <div className="space-y-2">
          <SwitchRow
            checked={emergencyOverride}
            onChange={onEmergencyOverrideChange}
            title="Gunakan emergency override"
            description="Wajib untuk menyetujui pengajuan sendiri. Keputusan dicatat di audit log."
          />
          <AnimatePresence initial={false}>
            {emergencyOverride ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={transitionSpringSmooth}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <Textarea
                    id={`${idPrefix}-emergency-reason`}
                    rows={3}
                    value={emergencyReason}
                    onChange={onEmergencyReasonChange}
                    disabled={pending}
                    placeholder="Jelaskan alasan override, minimal 10 karakter"
                    aria-label="Alasan emergency override"
                    aria-invalid={emergencyReason.length > 0 && emergencyReason.trim().length < 10}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}
