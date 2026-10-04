export interface InvoicePaymentItem {
  readonly id: string;
  readonly amountPaid: string;
  readonly paymentDate: Date;
  readonly referenceNumber: string;
}

export interface ClientInvoiceItem {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly amount: string;
  readonly status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
  readonly dueDate: Date;
  readonly createdAt: Date;
  readonly payments: InvoicePaymentItem[];
  readonly stage?: string;
}
