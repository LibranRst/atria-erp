import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import {
  DashboardCashFlowSkeleton,
  DashboardDesktopSkeleton,
  DashboardTableSkeleton,
  resolveDashboardSkeletonTab,
} from "./dashboard-desktop-skeletons";
import type { DashboardPageTab } from "@atria/core/finance/dashboard-overview";

function render(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      {children}
    </WorkspacePresentationProvider>,
  );
}

test("each Dashboard loading composition announces a busy state without fake data or interactive rows", () => {
  const tabs: readonly DashboardPageTab[] = [
    "overview",
    "approvals",
    "budget",
    "cash",
    "accounts",
    "materials",
  ];
  for (const tab of tabs) {
    const html = render(<DashboardDesktopSkeleton tab={tab} />);
    expect(html).toContain(`data-dashboard-skeleton="${tab}"`);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('inert=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("Rp 0");
    expect(html).not.toContain("0 hasil");
    expect(html).not.toContain('data-atria-interactive="true"');
  }
  expect(render(<DashboardDesktopSkeleton tab="cash" />)).toContain("Dokumen / pihak");
  expect(render(<DashboardDesktopSkeleton tab="accounts" />)).toContain("Aktivitas terakhir");
  expect(render(<DashboardDesktopSkeleton tab="budget" />)).toContain("Alokasi");
});

test("independent loading retains native columns and the selected pagination size", () => {
  const html = render(
    <DashboardTableSkeleton
      label="Memuat pengajuan"
      rowCount={25}
      columns={[
        { key: "name", label: "Pengajuan" },
        { key: "amount", label: "Nominal", align: "end" },
      ]}
    />,
  );
  expect(html).toContain("Pengajuan");
  expect(html).toContain("Nominal");
  expect(html).toContain("skeleton-row-24");
  expect(html).not.toContain("skeleton-row-25");
  expect(html).toContain('aria-label="Memuat pengajuan"');
  expect(html).not.toContain('aria-label="Baris"');
});

test("cashflow loading discloses loading rather than a zero trend and URL hints fall back safely", () => {
  const html = render(<DashboardCashFlowSkeleton months={12} />);
  expect(html).toContain("Arus kas masuk dan keluar sedang disiapkan");
  expect(html).not.toContain("Rp");
  expect(html).toContain('inert=""');
  expect(resolveDashboardSkeletonTab("accounts")).toBe("accounts");
  expect(resolveDashboardSkeletonTab("unknown")).toBe("overview");
});
