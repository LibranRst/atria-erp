export type ProjectMaterialMovement = {
  readonly materialId?: string;
  readonly inventoryLocationId?: string;
  readonly projectRapItemId?: string | null;
  readonly movementType: string;
  readonly quantity: string | number;
  readonly createdAt?: Date;
  readonly id?: string;
};

export type ProjectMaterialProjection = {
  readonly reservedQuantity: number;
  readonly boughtQuantity: number;
  readonly usedQuantity: number;
  readonly returnedQuantity: number;
  readonly wasteQuantity: number;
  readonly leftoverQuantity: number;
  readonly securedQuantity: number;
  readonly needToBuy: number;
};

function movementKey(movement: ProjectMaterialMovement): string {
  return `${movement.materialId ?? "material"}:${movement.inventoryLocationId ?? "location"}:${movement.projectRapItemId ?? "project"}`;
}

function chronologicalMovements(
  movements: readonly ProjectMaterialMovement[],
): readonly ProjectMaterialMovement[] {
  return movements
    .map((movement, index) => ({ movement, index }))
    .sort((left, right) => {
      const leftTime = left.movement.createdAt?.getTime();
      const rightTime = right.movement.createdAt?.getTime();
      if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime)
        return leftTime - rightTime;
      if (leftTime !== undefined && rightTime === undefined) return -1;
      if (leftTime === undefined && rightTime !== undefined) return 1;
      if (left.movement.id && right.movement.id && left.movement.id !== right.movement.id) {
        return left.movement.id.localeCompare(right.movement.id);
      }
      return left.index - right.index;
    })
    .map(({ movement }) => movement);
}

export function calculateOutstandingProjectReservations(
  movements: readonly ProjectMaterialMovement[],
): number {
  const outstandingBySource = new Map<string, number>();
  for (const movement of chronologicalMovements(movements)) {
    const key = movementKey(movement);
    const current = outstandingBySource.get(key) ?? 0;
    const quantity = Number(movement.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (movement.movementType === "RESERVE") {
      outstandingBySource.set(key, current + quantity);
    } else if (
      movement.movementType === "USE" ||
      movement.movementType === "WASTE" ||
      movement.movementType === "RELEASE_RESERVATION"
    ) {
      outstandingBySource.set(key, Math.max(0, current - quantity));
    }
  }
  return Array.from(outstandingBySource.values()).reduce((sum, quantity) => sum + quantity, 0);
}

function sumMovement(movements: readonly ProjectMaterialMovement[], movementType: string): number {
  return movements.reduce(
    (sum, movement) =>
      movement.movementType === movementType ? sum + Number(movement.quantity) : sum,
    0,
  );
}

export function projectMaterialProjection(
  movements: readonly ProjectMaterialMovement[],
  totalRequiredQuantity: number,
): ProjectMaterialProjection {
  const reservedQuantity = calculateOutstandingProjectReservations(movements);
  const boughtQuantity = Math.max(
    0,
    sumMovement(movements, "STOCK_IN") +
      sumMovement(movements, "GOODS_RECEIPT") -
      sumMovement(movements, "GOODS_RECEIPT_REVERSAL"),
  );
  const grossUsedQuantity = sumMovement(movements, "USE");
  const returnedQuantity = sumMovement(movements, "RETURN");
  const wasteQuantity = sumMovement(movements, "WASTE");
  const usedQuantity = Math.max(0, grossUsedQuantity - returnedQuantity);
  // A return re-enters free warehouse stock; it does not silently re-secure the project.
  const leftoverQuantity = Math.max(0, boughtQuantity - grossUsedQuantity - wasteQuantity);
  // Receipts and reservations may describe the same units, so use the larger on-hand pool.
  const securedQuantity = Math.max(0, usedQuantity + Math.max(reservedQuantity, leftoverQuantity));

  return {
    reservedQuantity,
    boughtQuantity,
    usedQuantity,
    returnedQuantity,
    wasteQuantity,
    leftoverQuantity,
    securedQuantity,
    needToBuy: Math.max(0, totalRequiredQuantity - securedQuantity),
  };
}
