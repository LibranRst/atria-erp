import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { desktopTablePage } from "@/components/ui";
import type { ClientInvoiceItem } from "../../types/project-invoices-types";
import { calculateInvoiceSettlementStatus } from "../../utils/project-invoices-utils";
import { ProjectPaymentsDesktop } from "./project-payments-desktop";
import { projectInvoiceColumns, projectReceiptColumns } from "./project-payments-desktop-columns";
import { InvoiceDesktopDetail, ReceiptDesktopDetail } from "./project-payments-desktop-details";
import { ProjectPaymentsDesktopLoading } from "./project-payments-desktop-loading";
import {
  filterProjectInvoices,
  filterProjectReceipts,
  projectInvoiceDisplayStatus,
  projectPaymentsQueryUrl,
  projectReceiptRows,
} from "./project-payments-desktop-model";

function invoice(index: number, status: ClientInvoiceItem["status"] = "UNPAID"): ClientInvoiceItem {
  return {
    id: `invoice-${index}`,
    invoiceNumber: `INV-${index}`,
    stage: "PROGRESS",
    status,
    amount: `${index + 1}.25`,
    dueDate: new Date(Date.UTC(2026, 9, index + 1)),
    createdAt: new Date("2026-09-01T00:00:00Z"),
    payments:
      index % 2 === 0
        ? [
            {
              id: `receipt-${index}`,
              amountPaid: "0.25",
              paymentDate: new Date("2026-10-01T00:00:00Z"),
              referenceNumber: `TRANSFER-${index}`,
            },
          ]
        : [],
  };
}
const invoices = Array.from({ length: 32 }, (_, index) => invoice(index));
const noop = (): void => undefined;
function html(
  rows: readonly ClientInvoiceItem[] = invoices,
  locked = false,
  canCreateInvoice = true,
): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <ProjectPaymentsDesktop
        invoices={rows}
        contractValue={1000.25}
        canCreateInvoice={canCreateInvoice && !locked}
        canRecordPayment={!locked}
        locked={locked}
        schedulePending={false}
        createError={null}
        createSuccess={null}
        onCreateInvoice={noop}
        onGenerateSchedule={noop}
        onRecordPayment={noop}
        onOpenInvoice={noop}
        onOpenReceipt={noop}
      />
    </WorkspacePresentationProvider>,
  );
}
describe("project payments desktop collections", () => {
  test("complete-result filters, sorting, deterministic ties and page clamps precede pagination", () => {
    const filtered = filterProjectInvoices(invoices, {
      search: "INV-",
      status: "all",
      date: "all",
    });
    const page = desktopTablePage(
      filtered,
      projectInvoiceColumns,
      (row) => row.id,
      { column: "amount", direction: "descending" },
      2,
      10,
    );
    expect(page.total).toBe(32);
    expect(page.rows.map((row) => row.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `invoice-${21 - index}`),
    );
    expect(
      desktopTablePage(
        filtered,
        projectInvoiceColumns,
        (row) => row.id,
        { column: "amount", direction: "ascending" },
        99,
        25,
      ).page,
    ).toBe(2);
    expect(
      filterProjectInvoices(invoices, { search: "INV-31", status: "all", date: "all" }).map(
        (row) => row.id,
      ),
    ).toEqual(["invoice-31"]);
    const ties = [
      { ...invoice(2), amount: "10" },
      { ...invoice(1), amount: "10" },
    ];
    expect(
      desktopTablePage(
        ties,
        projectInvoiceColumns,
        (row) => row.id,
        { column: "amount", direction: "descending" },
        1,
        10,
      ).rows.map((row) => row.id),
    ).toEqual(["invoice-1", "invoice-2"]);
  });
  test("receipts retain exact invoice identity and search over the whole collection", () => {
    const receipts = projectReceiptRows(invoices);
    expect(receipts).toHaveLength(16);
    const result = filterProjectReceipts(receipts, { search: "TRANSFER-30", date: "all" });
    expect(result[0]?.invoice.id).toBe("invoice-30");
    expect(result[0]?.amountPaid).toBe("0.25");
    const page = desktopTablePage(
      receipts,
      projectReceiptColumns,
      (row) => row.id,
      { column: "amount", direction: "descending" },
      2,
      10,
    );
    expect(page.total).toBe(16);
    expect(page.rows).toHaveLength(6);
  });
  test("calendar filters and overdue attention use Jakarta boundaries including year rollover", () => {
    const dueToday = { ...invoice(1), dueDate: new Date("2025-12-31T17:00:00.000Z") };
    const dueYesterday = {
      ...invoice(2),
      status: "PARTIALLY_PAID" as const,
      dueDate: new Date("2025-12-31T16:59:59.999Z"),
    };
    const now = new Date("2026-01-01T00:00:00Z");
    expect(projectInvoiceDisplayStatus(dueToday, now)).toBe("UNPAID");
    expect(projectInvoiceDisplayStatus(dueYesterday, now)).toBe("OVERDUE");
    expect(projectInvoiceDisplayStatus({ ...dueYesterday, status: "VOID" }, now)).toBe("VOID");
    expect(projectInvoiceDisplayStatus({ ...dueYesterday, status: "PAID" }, now)).toBe("PAID");
    expect(
      filterProjectInvoices(
        [dueToday, dueYesterday],
        { search: "", status: "OVERDUE", date: "all" },
        now,
      ),
    ).toEqual([dueYesterday]);
    expect(
      filterProjectInvoices(
        [dueToday, dueYesterday],
        { search: "", status: "all", date: "last-month" },
        now,
      ),
    ).toEqual([dueYesterday]);
    const receipts = projectReceiptRows([
      {
        ...dueYesterday,
        payments: [{ ...dueYesterday.payments[0]!, paymentDate: dueYesterday.dueDate }],
      },
    ]);
    expect(filterProjectReceipts(receipts, { search: "", date: "last-month" }, now)).toHaveLength(
      1,
    );
    expect(filterProjectReceipts(receipts, { search: "", date: "this-month" }, now)).toHaveLength(
      0,
    );
  });
  test("URL filters reset the page and retain sibling collection, project, native and hash state", () => {
    const before =
      "http://localhost/projects/one?tab=payments&payments-view=receipts&project-receipts-page=3&surface=mobile&keep=yes#history";
    const after = new URL(
      projectPaymentsQueryUrl(before, "invoices", {
        search: "DP",
        sort: "amount",
        direction: "descending",
      }),
      "http://localhost",
    );
    expect(after.pathname).toBe("/projects/one");
    expect(after.hash).toBe("#history");
    expect(after.searchParams.get("project-invoices-page")).toBe("1");
    expect(after.searchParams.get("project-receipts-page")).toBe("3");
    expect(after.searchParams.get("payments-view")).toBe("receipts");
    expect(after.searchParams.get("surface")).toBe("mobile");
    expect(after.searchParams.get("keep")).toBe("yes");
    expect(
      new URL(
        projectPaymentsQueryUrl(before, "receipts", { page: 2 }),
        "http://localhost",
      ).searchParams.get("project-receipts-page"),
    ).toBe("2");
  });
  test("render uses native shared tables, truthful totals and compact permission-gated actions", () => {
    const markup = html();
    expect(markup).toContain("table-root--primary");
    expect(markup).not.toContain(">receipt_long<");
    expect(markup).not.toContain(">payments<");
    expect(markup).toContain('aria-label="32 invoice"');
    expect(markup).toContain('aria-label="16 penerimaan"');
    expect(markup).not.toContain("memerlukan perhatian");
    expect(markup).toContain("32 hasil");
    expect(markup).toContain("16 hasil");
    expect(markup).toContain("Sisa piutang");
    expect(markup).toContain("Belum ditagihkan");
    expect(markup).toContain("Buat invoice");
    expect(markup).not.toContain("Buat jadwal termin");
    expect(markup).not.toContain('data-atria-selected="true"');
    const locked = html(invoices, true);
    expect(locked).toContain("Proyek terkunci");
    expect(locked).not.toContain("Buat invoice");
    expect(locked).not.toContain("Catat penerimaan");
    const read = html(invoices, false, false);
    expect(read).not.toContain("Buat invoice");
  });
  test("empty full-width collections and both structural skeletons do not fabricate data", () => {
    const empty = html([]);
    expect(empty).toContain("Belum ada invoice");
    expect(empty).toContain("Belum ada penerimaan");
    expect(empty).toContain("Buat jadwal termin");
    expect(empty).not.toContain("Rincian invoice");
    for (const receipts of [false, true]) {
      const markup = renderToStaticMarkup(
        <WorkspacePresentationProvider presentation="desktop">
          <ProjectPaymentsDesktopLoading receipts={receipts} />
        </WorkspacePresentationProvider>,
      );
      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain("inert");
      expect(markup).toContain(receipts ? "Referensi" : "Jatuh tempo");
      expect(markup).not.toContain("Rp 0");
    }
  });
  test("exact detail preserves cents, VOID history and existing record links without inventing bank data", () => {
    const voidInvoice = { ...invoice(2, "VOID"), amount: "1000.25" };
    const receipt = projectReceiptRows([voidInvoice])[0]!;
    const invoiceMarkup = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <InvoiceDesktopDetail
          invoice={voidInvoice}
          canRecordPayment
          onRecordPayment={noop}
          onOpenInvoice={noop}
          onOpenReceipt={noop}
        />
      </WorkspacePresentationProvider>,
    );
    expect(invoiceMarkup).toContain("1.000,25");
    expect(invoiceMarkup).toContain("Invoice dibatalkan");
    expect(invoiceMarkup).not.toContain("Catat penerimaan");
    expect(invoiceMarkup).toContain("TRANSFER-2");
    expect(invoiceMarkup).toContain("Buka detail invoice");
    const receiptMarkup = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <ReceiptDesktopDetail receipt={receipt} onOpenReceipt={noop} onOpenInvoice={noop} />
      </WorkspacePresentationProvider>,
    );
    expect(receiptMarkup).toContain("0,25");
    expect(receiptMarkup).toContain("Kas tercatat");
    expect(receiptMarkup).not.toContain("Direkonsiliasi");
    expect(receiptMarkup).not.toContain("Rekening");
    expect(calculateInvoiceSettlementStatus([voidInvoice], 1000).isFullySettled).toBe(false);
  });
});
