import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { desktopTablePage } from "@/components/ui";
import { buildRabExcelRows } from "../../utils/rab-export-utils";
import { rabExportTotal } from "@atria/core/ai/rab-export";
import type { RabBundleView, RabEstimateView, RabItemView } from "../../types/rap-rab-types";
import { buildRabDesktopRows, filterRabDesktopRows, rabDesktopContext } from "./rab-desktop-model";
import { RabDesktopPanel, rabDesktopColumns } from "./rab-desktop-panel";
import { RabDraftActionsPanel } from "./rab-client-sections";
import { RabDesktopHistory } from "./rab-desktop-history";
import { ProjectPlanningDesktopLoading } from "../shared/project-planning-desktop-loading";

function item(index: number, overrides: Partial<RabItemView> = {}): RabItemView {
  return {
    id: `item-${index}`,
    sourceType: "MANUAL",
    itemNature: "PRODUCTION",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: null,
    clientLabel: `Pekerjaan ${index}`,
    description: `Uraian klien ${index}`,
    quantity: "1.25",
    unit: "m²",
    unitPrice: `${index * 1000}.25`,
    lineTotal: `${index * 1250}.31`,
    displayOrder: index,
    isHidden: false,
    isBundle: false,
    bundleId: null,
    sourceRevision: null,
    sourceUpdatedAt: null,
    ...overrides,
  };
}
const bundle: RabBundleView = {
  id: "bundle",
  clientLabel: "Paket kitchen",
  description: "Uraian aman untuk klien",
  quantity: "1",
  unit: "paket",
  unitPrice: "20000000.25",
  lineTotal: "20000000.25",
  displayOrder: 3,
  isHidden: false,
  itemIds: ["member"],
};
const estimate: RabEstimateView = {
  id: "estimate",
  sourceProjectRapId: null,
  supersedesRabEstimateId: null,
  status: "DRAFT",
  revision: 2,
  title: "Menteng — pekerjaan interior",
  clientNotes: "Catatan klien yang panjang tetap dapat dibaca.",
  approvedValue: "0",
  items: [
    ...Array.from({ length: 13 }, (_, index) => item(13 - index)),
    item(2, { id: "member", bundleId: bundle.id }),
    item(20, { id: "hidden", isHidden: true }),
  ],
  bundles: [bundle],
};
const noAction = (): void => undefined;

function renderPanel(overrides: Partial<ComponentProps<typeof RabDesktopPanel>> = {}): string {
  return renderToStaticMarkup(
    <WorkspacePresentationProvider presentation="desktop">
      <RabDesktopPanel
        rabEstimate={estimate}
        isRevisionDraft={false}
        approvedBaseline={null}
        visibleRabValue={20100000.75}
        staleSourceLabels={["Material plafon"]}
        isPending={false}
        handleRefreshRabSources={noAction}
        canManageRab={false}
        canCreateRab={false}
        rap={null}
        setSourcePickerOpen={noAction}
        setManualLineOpen={noAction}
        openEditBundle={noAction}
        setRabItemEditorId={noAction}
        openCreateBundle={noAction}
        onOpenExport={noAction}
        {...overrides}
      />
    </WorkspacePresentationProvider>,
  );
}

describe("RAB desktop document comparison", () => {
  test("initial loading preserves a full-width list until detail context is known", () => {
    const initial = renderToStaticMarkup(<ProjectPlanningDesktopLoading kind="rab" />);
    const selected = renderToStaticMarkup(<ProjectPlanningDesktopLoading kind="rab" showDetail />);
    expect(initial).toContain('aria-busy="true"');
    expect(initial).toContain("Memuat isi RAB");
    expect(initial).not.toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
    expect(selected).toContain("xl:grid-cols-[minmax(0,1fr)_18rem]");
  });
  test("keeps source order, member separation and visibility without mutating client document data", () => {
    const source = JSON.stringify(estimate);
    const exported = buildRabExcelRows(estimate, {
      projectName: "Menteng",
      date: "15 Oktober 2026",
    });
    const rows = buildRabDesktopRows(estimate);
    const documents = filterRabDesktopRows(rows, { search: "", kind: "all", visibility: "all" });
    expect(documents).toHaveLength(15);
    expect(documents[0]?.record.clientLabel).toBe("Pekerjaan 1");
    expect(documents.some((row) => row.record.id === "member")).toBe(false);
    const members = filterRabDesktopRows(rows, { search: "", kind: "members", visibility: "all" });
    expect(members.map((row) => row.record.id)).toEqual(["member"]);
    expect(
      filterRabDesktopRows(rows, { search: "", kind: "all", visibility: "hidden" }).map(
        (row) => row.record.id,
      ),
    ).toEqual(["hidden"]);
    const sorted = desktopTablePage(
      documents,
      rabDesktopColumns,
      (row) => row.key,
      { column: "total", direction: "descending" },
      1,
      10,
    );
    expect(sorted.rows[0]?.record.id).toBe("bundle");
    expect(JSON.stringify(estimate)).toBe(source);
    expect(
      buildRabExcelRows(estimate, { projectName: "Menteng", date: "15 Oktober 2026" }),
    ).toEqual(exported);
    expect(JSON.stringify(exported)).not.toContain("sourceProjectRapItemId");
    expect(JSON.stringify(exported)).not.toContain("sourceRevision");
    expect(JSON.stringify(exported)).not.toContain("unitCost");
    expect(rabExportTotal(estimate)).toBe("20113754.28");
    const hiddenParentRows = buildRabDesktopRows({
      ...estimate,
      bundles: [{ ...bundle, isHidden: true }],
    });
    expect(
      filterRabDesktopRows(hiddenParentRows, {
        search: "",
        kind: "members",
        visibility: "hidden",
      }).map((row) => row.record.id),
    ).toEqual(["member"]);
    expect(rabExportTotal({ ...estimate, bundles: [{ ...bundle, isHidden: true }] })).toBe(
      "113754.03",
    );
    const visibleMember = estimate.items.find((row) => row.id === "member");
    expect(visibleMember?.isHidden).toBe(false);
    expect(hiddenParentRows.find((row) => row.record.id === "member")?.clientVisible).toBe(false);
    expect(JSON.stringify(estimate)).toBe(source);
  });

  test("filters and sorts the complete collection before pagination and clamps source shrink", () => {
    const rows = filterRabDesktopRows(buildRabDesktopRows(estimate), {
      search: "",
      kind: "all",
      visibility: "all",
    });
    const sort = { column: "total", direction: "descending" as const };
    const first = desktopTablePage(rows, rabDesktopColumns, (row) => row.key, sort, 1, 10);
    const second = desktopTablePage(rows, rabDesktopColumns, (row) => row.key, sort, 2, 10);
    expect(first.total).toBe(15);
    expect(first.rows).toHaveLength(10);
    expect(second.rows).toHaveLength(5);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.key)).size).toBe(15);
    expect(Number(first.rows.at(-1)?.record.lineTotal)).toBeGreaterThan(
      Number(second.rows[0]?.record.lineTotal),
    );
    const filtered = filterRabDesktopRows(buildRabDesktopRows(estimate), {
      search: "kitchen",
      kind: "all",
      visibility: "all",
    });
    expect(desktopTablePage(filtered, rabDesktopColumns, (row) => row.key, sort, 20, 10).page).toBe(
      1,
    );
    expect(
      desktopTablePage(rows, rabDesktopColumns, (row) => row.key, sort, 1, 25).rows,
    ).toHaveLength(15);
    expect(
      desktopTablePage(rows, rabDesktopColumns, (row) => row.key, sort, 1, 50).rows,
    ).toHaveLength(15);
  });

  test("list has no implicit selection and explicit selection supplies exact context", () => {
    const rows = buildRabDesktopRows(estimate);
    expect(rabDesktopContext(rows, null)).toBeNull();
    expect(rabDesktopContext(rows, "missing")).toBeNull();
    const requested = rows.find((row) => row.record.id === "bundle")!;
    expect(rabDesktopContext(rows, requested.key)).toBe(requested);
    expect(rabDesktopContext([], requested.key)).toBeNull();
    const html = renderPanel();
    expect(html).not.toContain('aria-current="true"');
    expect(html).toContain("15 hasil");
    expect(html).toContain("Rp 20.100.000,75");
    expect(html).toContain("Belum disetujui");
    expect(html).not.toContain("Margin");
  });

  test("edit, create, refresh and export affordances follow supplied capabilities and status", () => {
    const readonly = renderPanel();
    expect(readonly).not.toContain("Item manual");
    expect(readonly).not.toContain("Buat paket");
    expect(readonly).not.toContain(">Perbarui sumber<");
    expect(readonly).toContain("Material plafon");
    expect(readonly).toContain("Ekspor dokumen");
    const editor = renderPanel({ canManageRab: true });
    expect(editor).toContain("Item manual");
    expect(editor).toContain("Buat paket");
    expect(editor).toContain(">Perbarui sumber<");
    const approved = { ...estimate, status: "APPROVED" };
    expect(renderPanel({ rabEstimate: approved, canManageRab: true })).not.toContain("Item manual");
    expect(renderPanel({ rabEstimate: { ...estimate, status: "VOID" } })).not.toContain(
      "Ekspor dokumen",
    );
  });

  test("approval requires explicit approval capability and revision creation is an editor action", () => {
    const actions = (canManage: boolean, canApprove: boolean, revision: boolean): string =>
      renderToStaticMarkup(
        <WorkspacePresentationProvider presentation="desktop">
          <RabDraftActionsPanel
            rabEstimate={estimate}
            isRevisionDraft={revision}
            isPending={false}
            setChangeOrderOpen={noAction}
            setVoidRevisionOpen={noAction}
            handleApproveRab={noAction}
            canManageRab={canManage}
            canApproveRab={canApprove}
            desktop
          />
        </WorkspacePresentationProvider>,
      );
    expect(actions(true, false, false)).not.toContain("Tinjau &amp; setujui RAB");
    expect(actions(false, true, false)).toContain("Tinjau &amp; setujui RAB");
    expect(actions(true, false, true)).toContain("Proses Change Order");
    expect(actions(false, true, true)).not.toContain("Proses Change Order");
    const history = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <RabDesktopHistory
          revisionHistory={[]}
          changeOrders={[]}
          onRevision={noAction}
          onOrder={noAction}
          onApproveOrder={noAction}
          canApprove={false}
          pendingId={null}
        />
      </WorkspacePresentationProvider>,
    );
    expect(history).toContain("Belum ada riwayat revisi");
    expect(history).toContain("Belum ada Change Order");
  });
});
