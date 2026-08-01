"use client";

import React, { useState, useTransition } from "react";
import { z } from "zod";
import { recordClientPayment } from "@/app/actions/finance/record-client-payment";
import { generateClientInvoiceSchedule } from "@/app/actions/finance/generate-invoice-schedule";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/utils/error-message";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { toast } from "sonner";
import { ClientPaymentSheet } from "./client-payment-sheet";
import { ProjectInvoicesList } from "./project-invoices-list";
import { ProjectInvoicesSummary } from "./project-invoices-summary";
import type { BankAccountItem, ClientInvoiceItem } from "../../types/project-invoices-types";
import {
  calculateInvoiceRemaining,
  calculateInvoiceTotals,
  defaultPaymentDate,
  formatShortRp,
} from "../../utils/project-invoices-utils";
import { type OperationSuccess, OperationSuccessSheet } from "@/components/ui";
import { useLocalFormRecovery } from "@/features/shared-hooks/use-local-form-recovery";

const clientPaymentRecoverySchema = z.object({
  invoiceId: z.string(),
  amountPaid: z.string(),
  selectedBankId: z.string(),
  refNumber: z.string(),
  paymentDate: z.string(),
});

type ClientPaymentRecovery = z.infer<typeof clientPaymentRecoverySchema>;

export type {
  BankAccountItem,
  ClientInvoiceItem,
  InvoicePaymentItem,
} from "../../types/project-invoices-types";

interface ProjectInvoicesProps {
  projectId: string;
  invoices: ClientInvoiceItem[];
  bankAccounts: BankAccountItem[];
  userRole: string;
  contractValue: number;
}

export function ProjectInvoices({
  projectId,
  invoices,
  bankAccounts,
  userRole,
  contractValue,
}: ProjectInvoicesProps): React.JSX.Element {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoiceItem | null>(null);

  // Create Invoice trigger
  const handleCreateInvoiceClick = React.useCallback((): void => {
    updateUrlSearchParam("new-invoice", "true", "push");
  }, []);

  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [schedulePending, startScheduleTransition] = useTransition();

  const closeRecordModal = React.useCallback(() => {
    setSelectedInvoice(null);
  }, []);
  const initialPaymentRecovery = React.useCallback(
    (): ClientPaymentRecovery => ({
      invoiceId: "",
      amountPaid: "",
      selectedBankId: bankAccounts[0]?.id ?? "",
      refNumber: "",
      paymentDate: defaultPaymentDate(),
    }),
    [bankAccounts],
  );
  const paymentRecovery = useLocalFormRecovery({
    storageKey: `atria:finance:client-payment:${projectId}`,
    schema: clientPaymentRecoverySchema,
    initialPayload: initialPaymentRecovery,
  });
  const { amountPaid, selectedBankId, refNumber, paymentDate } = paymentRecovery.payload;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<OperationSuccess | null>(null);

  const isOwnerOrFinance = userRole === "OWNER" || userRole === "FINANCE_ADMIN";
  const { totalInvoiceAmount, totalPaidAmount, unpaidAmount } = calculateInvoiceTotals(invoices);

  function handleGenerateSchedule(): void {
    setCreateError(null);
    startScheduleTransition(async () => {
      const result = await generateClientInvoiceSchedule({
        projectId,
        firstDueDate: new Date(),
        installments: [
          { label: "DP", percentage: 0.3 },
          { label: "Progress 1", percentage: 0.35 },
          { label: "Progress 2", percentage: 0.25 },
          { label: "Pelunasan", percentage: 0.1 },
        ],
      });
      if (!result.success) {
        setCreateError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      const message = `Empat termin dibuat dari nilai kontrak ${formatShortRp(contractValue)}.`;
      setCreateSuccess(message);
      toast.success(message);
      router.refresh();
    });
  }

  const handleRecordPaymentClick = (invoice: ClientInvoiceItem) => {
    const remaining = calculateInvoiceRemaining(invoice);

    setSelectedInvoice(invoice);
    setError(null);
    setSuccess(null);
    if (paymentRecovery.isDirty && paymentRecovery.payload.invoiceId === invoice.id) return;
    paymentRecovery.reset({
      invoiceId: invoice.id,
      amountPaid: remaining.toFixed(2),
      selectedBankId: bankAccounts[0]?.id ?? "",
      refNumber: "",
      paymentDate: defaultPaymentDate(),
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!selectedInvoice) return;
    if (!selectedBankId) {
      const message = "Silakan pilih rekening bank tujuan.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!amountPaid || Number(amountPaid) <= 0) {
      const message = "Nominal pembayaran harus lebih besar dari Rp 0.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!refNumber.trim()) {
      const message = "Nomor referensi bukti transfer wajib diisi.";
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await recordClientPayment({
          clientInvoiceId: selectedInvoice.id,
          bankAccountId: selectedBankId,
          amountPaid: Number(amountPaid),
          paymentDate: new Date(paymentDate),
          referenceNumber: refNumber,
        });

        if (!res.success) {
          const errMsg = res.error.message || "Gagal mencatat pembayaran termin.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = `Berhasil mencatatkan kas masuk sebesar Rp ${Number(amountPaid).toLocaleString("id-ID")}`;
        toast.success(successMsg);
        const account = bankAccounts.find((item) => item.id === selectedBankId);
        setOperationSuccess({
          title: "Pembayaran klien tercatat",
          description: "Saldo rekening dan status invoice sudah diperbarui dalam satu transaksi.",
          facts: [
            { label: "Invoice", value: selectedInvoice.invoiceNumber },
            { label: "Dana diterima", value: `Rp ${Number(amountPaid).toLocaleString("id-ID")}` },
            { label: "Rekening", value: account?.name ?? "Rekening penerima" },
          ],
        });
        paymentRecovery.clear();

        // Refresh database state
        router.refresh();

        closeRecordModal();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  return (
    <div className="space-y-sm">
      <ProjectInvoicesSummary
        isOwnerOrFinance={isOwnerOrFinance}
        invoicesCount={invoices.length}
        contractValue={contractValue}
        schedulePending={schedulePending}
        createError={createError}
        createSuccess={createSuccess}
        totalInvoiceAmount={totalInvoiceAmount}
        totalPaidAmount={totalPaidAmount}
        unpaidAmount={unpaidAmount}
        onCreateInvoiceClick={handleCreateInvoiceClick}
        onGenerateSchedule={handleGenerateSchedule}
      />

      <ProjectInvoicesList
        invoices={invoices}
        isOwnerOrFinance={isOwnerOrFinance}
        onRecordPayment={handleRecordPaymentClick}
      />

      <ClientPaymentSheet
        key={selectedInvoice?.id ?? "client-payment-closed"}
        selectedInvoice={selectedInvoice}
        bankAccounts={bankAccounts}
        amountPaid={amountPaid}
        setAmountPaid={(value) =>
          paymentRecovery.setPayload((current) => ({ ...current, amountPaid: value }))
        }
        selectedBankId={selectedBankId}
        setSelectedBankId={(value) =>
          paymentRecovery.setPayload((current) => ({ ...current, selectedBankId: value }))
        }
        refNumber={refNumber}
        setRefNumber={(value) =>
          paymentRecovery.setPayload((current) => ({ ...current, refNumber: value }))
        }
        paymentDate={paymentDate}
        setPaymentDate={(value) =>
          paymentRecovery.setPayload((current) => ({ ...current, paymentDate: value }))
        }
        isDirty={paymentRecovery.isDirty}
        isPending={isPending}
        error={error}
        success={success}
        onClose={closeRecordModal}
        onDiscard={() => {
          paymentRecovery.reset();
          closeRecordModal();
        }}
        onSubmit={handleSubmit}
      />
      <OperationSuccessSheet success={operationSuccess} onClose={() => setOperationSuccess(null)} />
    </div>
  );
}
