import { describe, expect, test } from "bun:test";

const stagePanelsPath = new URL("./rap-setup-stage-panels.tsx", import.meta.url);

describe("rap-setup-stage-panels Review Internal Plan metrics", () => {
  test("uses MoneyMetricPill and MetricPill from shared UI with fullDynamic variant", async () => {
    const source = await Bun.file(stagePanelsPath).text();

    // Imports canonical MetricPill and MoneyMetricPill from @/components/ui
    expect(source).toContain("MetricPill,");
    expect(source).toContain("MoneyMetricPill");

    // ReviewInternalPlanPanel uses MoneyMetricPill with variant="fullDynamic"
    expect(source).toContain('<MoneyMetricPill label="Material" amount={plannedCost} variant="fullDynamic" />');
    expect(source).toContain('<MetricPill label="Tukang" value="Tidak digunakan" wrapMode="truncate" />');
    expect(source).toContain('label="Tukang"');
    expect(source).toContain('amount={sumPackageCost(tukangPlanItems)}');
    expect(source).toContain('label="Subcon"');
    expect(source).toContain('amount={sumPackageCost(subconPlanItems)}');
    expect(source).toContain('<MetricPill label="Subcon" value="Tidak digunakan" wrapMode="truncate" />');
    expect(source).toContain('label="Total Plan"');
    expect(source).toContain('variant="fullDynamic"');
  });
});
