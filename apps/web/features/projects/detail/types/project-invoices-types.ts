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

export interface BankAccountItem {
  readonly id: string;
  readonly name: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly balance: string;
}
