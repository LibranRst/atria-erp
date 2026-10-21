import React from "react";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldClaimDesktopAmount, FieldClaimDesktopStatus } from "./field-claims-desktop-detail";
import type { ExpenseCostItem } from "@/features/expenses/types/expense-list-types";
import { FieldClaimsDesktopWorkspace } from "./field-claims-desktop-workspace";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

function renderWorkspace(
  initialCosts: readonly ExpenseCostItem[],
  rows: readonly ExpenseCostItem[],
  selectedId: string | null,
): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <FieldClaimsDesktopWorkspace
        initialCosts={initialCosts}
        filteredCosts={rows}
        activeClaimTotal={initialCosts.reduce((sum, cost) => sum + Number(cost.amount), 0)}
        readyToPayCount={0}
        filter="ALL"
        filterTabs={[{ value: "ALL", label: "Aktif", count: initialCosts.length }]}
        onFilterChange={() => undefined}
        filters={{ query: "", project: "all", category: "all", date: "all" }}
        onFiltersChange={() => undefined}
        projectOptions={[{ value: "all", label: "Semua proyek" }]}
        categoryOptions={[{ value: "all", label: "Semua kategori" }]}
        columns={[{ key: "description", label: "Pengeluaran", render: (cost) => cost.description }]}
        table={{
          rows,
          total: rows.length,
          page: 1,
          pageSize: 10,
          sortDescriptor: { column: "description", direction: "ascending" },
          onSortChange: () => undefined,
          onPageChange: () => undefined,
          onPageSizeChange: () => undefined,
        }}
        selectedId={selectedId}
        onSelect={() => undefined}
        pending={false}
        canVerify={false}
        canPay={false}
        canCreate={false}
        onOpenExpenseDrawer={() => undefined}
        onVerify={() => undefined}
        onDisburse={() => undefined}
        onOpenReceipt={() => undefined}
      />
    </WorkspacePresentationProvider>,
  );
}

test("desktop exact detail and compact accessible nominal retain supplied cents", () => {
  const exact = renderToStaticMarkup(
    <FieldClaimDesktopAmount amount={475000.25} variant="fullDynamic" />,
  ).replace(/\u00a0/g, " ");
  const compact = renderToStaticMarkup(
    <FieldClaimDesktopAmount amount={475000.25} variant="compact" />,
  ).replace(/\u00a0/g, " ");
  expect(exact).toContain("Rp 475.000,25");
  expect(compact).toContain('aria-label="Rp 475.000,25"');
  const integer = renderToStaticMarkup(
    <FieldClaimDesktopAmount amount={475000} variant="fullDynamic" />,
  ).replace(/\u00a0/g, " ");
  expect(integer).toContain("Rp 475.000");
  expect(integer).not.toContain(",00");
});

test("desktop approval status uses readable Bahasa Indonesia", () => {
  const cost: ExpenseCostItem = {
    id: "cost",
    amount: "475000.25",
    description: "Kabinet dapur",
    receiptImageUrl: null,
    status: "VERIFIED",
    budgetOverrun: false,
    createdAt: new Date("2026-10-14T00:00:00Z"),
    project: null,
    budgetItem: null,
    requestedBy: null,
  };
  const html = renderToStaticMarkup(<FieldClaimDesktopStatus cost={cost} />);
  expect(html).toContain("Perlu persetujuan");
  expect(html).not.toContain("Approval");
});

test("desktop empty and filtered-out selections use full-width results while populated rows retain context", () => {
  const cost: ExpenseCostItem = {
    id: "cost",
    amount: "475000.25",
    description: "Kabinet dapur",
    receiptImageUrl: null,
    status: "VERIFIED",
    budgetOverrun: false,
    createdAt: new Date("2026-10-14T00:00:00Z"),
    project: null,
    budgetItem: null,
    requestedBy: null,
  };
  const empty = renderWorkspace([], [], null);
  expect(empty).not.toContain("xl:grid-cols-[minmax(0,1fr)_288px]");
  expect(empty).not.toContain('aria-label="Detail pengeluaran lapangan"');
  const noMatches = renderWorkspace([cost], [], cost.id);
  expect(noMatches).not.toContain("xl:grid-cols-[minmax(0,1fr)_288px]");
  expect(noMatches).not.toContain('aria-label="Detail pengeluaran lapangan"');
  const unselected = renderWorkspace([cost], [cost], null);
  expect(unselected).not.toContain("xl:grid-cols-[minmax(0,1fr)_288px]");
  expect(unselected).not.toContain('aria-label="Detail pengeluaran lapangan"');
  const populated = renderWorkspace([cost], [cost], cost.id);
  expect(populated).toContain("xl:grid-cols-[minmax(0,1fr)_288px]");
  expect(populated).toContain('aria-label="Detail pengeluaran lapangan"');
});
