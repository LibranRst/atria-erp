import assert from "node:assert/strict";
import { mock } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { ActionMenuItem } from "@/components/ui";
import {
  materialsFixtureData,
  materialsFixturePermissions,
} from "../../../../.storybook/materials-data.fixture";

let query = "";
mock.module("next/navigation", () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(query),
  usePathname: (): string => "/materials",
  useParams: (): Record<string, string> => ({}),
  useSelectedLayoutSegment: (): string | null => null,
  useSelectedLayoutSegments: (): string[] => [],
  useRouter: () => ({
    refresh: (): void => undefined,
    push: (): void => undefined,
    replace: (): void => undefined,
    prefetch: (): void => undefined,
    back: (): void => undefined,
    forward: (): void => undefined,
  }),
}));
const fail = async (): Promise<ActionResponse<never>> => ({
  success: false,
  error: { code: "VALIDATION_ERROR", message: "SSR fixture never calls backend" },
});
mock.module("@/app/actions/material/inventory", () => ({
  reserveMaterialForProject: fail,
  returnMaterialFromProject: fail,
  useMaterialForProject: fail,
  wasteMaterialForProject: fail,
}));
mock.module("@/app/actions/material/operations-dashboard", () => ({
  getMaterialMovementPage: fail,
}));
mock.module("@/app/actions/material/warehouse", () => ({ createInventoryLocation: fail }));
mock.module("@/app/actions/material/warehouse-transfer", () => ({ createStockTransfer: fail }));
mock.module("@/app/actions/material/warehouse-stock-count", () => ({
  approveStockCount: fail,
  rejectStockCount: fail,
  saveStockCount: fail,
  submitStockCount: fail,
}));
mock.module("@/app/actions/material/warehouse-receipt-reversal", () => ({
  approveGoodsReceiptReversal: fail,
  rejectGoodsReceiptReversal: fail,
  requestGoodsReceiptReversal: fail,
}));
mock.module("@/app/actions/material/warehouse-adjustment", () => ({ emergencyAdjustStock: fail }));
mock.module("@/app/actions/material/goods-receipt", () => ({ postGoodsReceipt: fail }));
mock.module("@/app/actions/activity-detail", () => ({ getActivityDetail: fail }));
mock.module("@/features/materials/hooks/material-desktop-read-client", () => ({
  readMaterialDesktopActivity: fail,
}));

const { PermissionsProvider } = await import("@/components/auth/permissions-provider");
const { WorkspacePresentationProvider } = await import("@/lib/navigation/workspace-presentation");
const sharedUi = await import("@/components/ui");
const { DesktopUIProvider, ActionMenu: OriginalActionMenu } = sharedUi;
const menuItems: ActionMenuItem[] = [];
mock.module("@/components/ui", () => ({
  ...sharedUi,
  ActionMenu: (props: React.ComponentProps<typeof OriginalActionMenu>): React.JSX.Element => {
    menuItems.push(...props.items);
    return <OriginalActionMenu {...props} />;
  },
}));
const { MaterialsControlCenter } = await import("./materials-control-center");
const { MaterialLoadState } = await import("../shared/material-load-state");
for (const tab of ["overview", "inventory", "needs", "activity"]) {
  query = `tab=${tab}`;
  const markup = renderToString(
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <PermissionsProvider permissions={materialsFixturePermissions("complete")}>
          <MaterialsControlCenter data={materialsFixtureData()} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>,
  );
  assert.match(markup, /Stok proyek/);
  assert.match(markup, /Gudang/);
  assert.match(markup, /Material &amp; Stok/);
}
const unavailable = renderToString(
  <MaterialLoadState restricted={false} message="Data material belum dapat dimuat." />,
);
assert.match(unavailable, /Material belum dapat dimuat/);
assert.match(unavailable, /Coba lagi/);
const restricted = renderToString(<MaterialLoadState restricted message="Izin tidak tersedia." />);
assert.match(restricted, /Akses material dibatasi/);
assert.doesNotMatch(restricted, /Coba lagi/);
for (const manageLocations of [false, true]) {
  menuItems.length = 0;
  renderToString(
    <WorkspacePresentationProvider presentation="desktop">
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={
            manageLocations
              ? materialsFixturePermissions("complete")
              : ["view:inventory", "create:stock_movement", "transfer:stock"]
          }
        >
          <MaterialsControlCenter data={materialsFixtureData()} />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>,
  );
  assert.equal(
    menuItems.some((item) => item.id === "LOCATION"),
    manageLocations,
    "warehouse creation follows material-settings permission independently of stock-operation rights",
  );
  assert.equal(
    menuItems.some((item) => item.id === "TRANSFER"),
    true,
    "location restrictions preserve the existing stock transfer action",
  );
}
console.log(
  "real material workspace renders all desktop tabs with complete Owner actions through shared ActionMenu contracts",
);
