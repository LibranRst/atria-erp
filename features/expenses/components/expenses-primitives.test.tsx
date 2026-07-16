import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ExpensesLoading from "@/app/expenses/loading";
import {
  ExpensesGroupSurface,
  ExpensesSectionHeader,
  ExpensesSummarySurface,
} from "@/features/expenses/components/expenses-primitives";

describe("Expenses Dashboard visual language", () => {
  test("renders a contextual financial summary without changing its values", () => {
    const html = renderToStaticMarkup(
      <ExpensesSummarySurface
        ariaLabel="Posisi pengeluaran lapangan"
        eyebrow="Pengeluaran lapangan"
        icon="receipt_long"
        status="13 perlu aksi"
        statusTone="warning"
      >
        <span>Rp 15.800.000</span>
      </ExpensesSummarySurface>,
    );

    expect(html).toContain("Posisi pengeluaran lapangan");
    expect(html).toContain("13 perlu aksi");
    expect(html).toContain("Rp 15.800.000");
  });

  test("keeps list sections inside one inset-grouped surface", () => {
    const html = renderToStaticMarkup(
      <>
        <ExpensesSectionHeader title="Pengeluaran aktif" meta="14 item" />
        <ExpensesGroupSurface><div>Baris pengeluaran</div></ExpensesGroupSurface>
      </>,
    );

    expect(html).toContain("Pengeluaran aktif");
    expect(html).toContain("14 item");
    expect(html).toContain("rounded-[26px]");
  });

  test("uses a route-specific loading skeleton with grouped rows", () => {
    const html = renderToStaticMarkup(<ExpensesLoading />);

    expect(html).toContain("Memuat Kas dan Tagihan");
    expect(html).toContain("Data pengeluaran dan tagihan sedang disiapkan");
    expect(html).not.toContain("spinner");
  });
});
