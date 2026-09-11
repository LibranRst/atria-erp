import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MaterialMovementView } from "@/app/actions/material/operations-dashboard";
import { AppIcon } from "@/components/ui";
import {
  movementIcon,
  movementIconTone,
  MovementRow,
} from "@/features/materials/components/shared/material-operation-primitives";

function createMockMovement(overrides: Partial<MaterialMovementView> = {}): MaterialMovementView {
  return {
    id: "mov-1",
    materialId: "mat-1",
    materialName: "Multipleks 18 mm",
    movementType: "USE",
    movementDirection: "OUT",
    quantity: 10,
    unitCost: 245_000,
    unit: "lembar",
    note: "Pemakaian project Menteng",
    locationId: "loc-1",
    locationName: "Gudang Utama",
    projectId: "proj-1",
    projectName: "Rumah Menteng",
    createdAt: new Date("2026-06-24T09:00:00Z"),
    createdByName: "Budi PM",
    ...overrides,
  };
}

describe("Material activity icons and MovementRow", () => {
  const movementTypesToTest = [
    { type: "USE", expectedIcon: "outbox" },
    { type: "RETURN", expectedIcon: "assignment_return" },
    { type: "WASTE", expectedIcon: "delete_sweep" },
    { type: "RESERVE", expectedIcon: "inventory" },
    { type: "TRANSFER", expectedIcon: "swap_horiz" },
    { type: "TRANSFER_IN", expectedIcon: "swap_horiz" },
    { type: "TRANSFER_OUT", expectedIcon: "swap_horiz" },
    { type: "GOODS_RECEIPT", expectedIcon: "move_to_inbox" },
    { type: "STOCK_IN", expectedIcon: "move_to_inbox" },
    { type: "GOODS_RECEIPT_REVERSAL", expectedIcon: "undo" },
    { type: "ADJUSTMENT", expectedIcon: "tune" },
    { type: "STOCK_COUNT_ADJUSTMENT", expectedIcon: "tune" },
  ];

  test.each(movementTypesToTest)(
    "movementIcon maps $type to $expectedIcon",
    ({ type, expectedIcon }) => {
      const icon = movementIcon(createMockMovement({ movementType: type }));
      expect(icon).toBe(expectedIcon);
    },
  );

  test("AppIcon resolves newly mapped legacy icon names without question mark fallback", () => {
    const icons = ["outbox", "assignment_return", "delete_sweep", "person_add", "copy"];
    const questionMarkSvg = renderToStaticMarkup(<AppIcon name="non_existent_icon_xyz" />);

    for (const name of icons) {
      const markup = renderToStaticMarkup(<AppIcon name={name} />);
      expect(markup).not.toBe(questionMarkSvg);
      expect(markup).toContain("<svg");
    }
  });

  test("MovementRow renders without any question mark icon for USE, RETURN, and WASTE", () => {
    const questionMarkSvg = renderToStaticMarkup(<AppIcon name="non_existent_icon_xyz" />);

    for (const type of ["USE", "RETURN", "WASTE", "GOODS_RECEIPT", "TRANSFER"]) {
      const row = createMockMovement({ movementType: type });
      const html = renderToStaticMarkup(<MovementRow row={row} />);

      expect(html).not.toContain(questionMarkSvg);
      expect(html).toContain(row.materialName);
      expect(html).toContain(movementIconTone(row));
    }
  });
});
