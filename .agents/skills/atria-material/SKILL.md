---
name: atria-material
description: Guides the implementation, auditing, and debugging of Material Master, RAP execution plans, client-facing RAB generation, warehouse inventory stock levels, stock movements, vendor PO/bills, and goods receipt in Atria ERP. Use when modifying material logic, inventory actions, or procurement flows.
---

# Atria ERP Material & Stock Control Runbook

This skill provides step-by-step guidance for managing materials, inventory projections, RAP execution planning, client-safe RAB proposals, and warehouse stock movements.

Backend implementations and transactions now live in `apps/api/src/backend/` and use `@backend/*`. Web actions are typed HTTP facades. Read `docs/06-technical/ARCHITECTURE.md` before changing transport boundaries.

---

## 1. Material Architecture & Inventory Projections

Each entry in `material_master` maintains three synchronized stock values:
- `current_stock`: Physical stock on hand in the warehouse.
- `reserved_stock`: Stock committed to active project execution plans.
- `available_stock`: Physical stock remaining for new commitments (`current - reserved`).

---

## 2. Stock Movement Rules

All stock mutations must run in `db.transaction` and create a `stock_movement` entry:

```typescript
import { db } from "@backend/db";
import { materialMaster, stockMovement, auditLog } from "@backend/db/schema";
import { eq } from "drizzle-orm";

await db.transaction(async (tx) => {
  // 1. Fetch material record
  const [item] = await tx
    .select()
    .from(materialMaster)
    .where(eq(materialMaster.id, materialId))
    .for("update");

  if (!item) throw new Error("Material not found");

  // 2. Perform validation according to movement type
  if (movementType === "RESERVE" && item.availableStock < quantity) {
    throw new Error(`Stok tersedia tidak mencukupi (${item.availableStock} < ${quantity})`);
  }

  // 3. Calculate new stock values
  let newCurrent = item.currentStock;
  let newReserved = item.reservedStock;

  switch (movementType) {
    case "STOCK_IN":
      newCurrent += quantity;
      break;
    case "RESERVE":
      newReserved += quantity;
      break;
    case "USE": // Consume on project site
      if (newReserved < quantity) throw new Error("Penggunaan melebihi kuota reservasi");
      newCurrent -= quantity;
      newReserved -= quantity;
      break;
    case "RETURN": // Unused material back to stock
      newCurrent += quantity;
      break;
    case "ADJUSTMENT":
    case "WASTE":
      newCurrent = newCurrent - quantity;
      break;
  }

  const newAvailable = newCurrent - newReserved;

  // 4. Update material record
  await tx
    .update(materialMaster)
    .set({
      currentStock: newCurrent,
      reservedStock: newReserved,
      availableStock: newAvailable,
      updatedAt: new Date(),
    })
    .where(eq(materialMaster.id, materialId));

  // 5. Insert stock_movement row
  const [movement] = await tx
    .insert(stockMovement)
    .values({
      materialId,
      projectId,
      type: movementType,
      quantity,
      unitPrice: item.unitPrice,
      notes,
      createdBy: session.user.id,
    })
    .returning();

  // 6. Write audit_log entry
  await tx.insert(auditLog).values({
    entityType: "stock_movement",
    entityId: movement.id,
    action: movementType,
    actorId: session.user.id,
    payload: { materialId, projectId, quantity, previousCurrent: item.currentStock, newCurrent },
  });
});
```

---

## 3. RAP vs. RAB Isolation Guardrail

When generating client proposals (RAB) from internal execution plans (RAP):
- Select only client-safe items.
- Strip all internal unit cost baselines, supplier contact info, internal margin percentages, and private estimator notes.
- RAB items display client-facing descriptions and client unit prices only.

---

## 4. Verification Checklist

- [ ] Stock mutations execute in `db.transaction`.
- [ ] Material row locked with `.for("update")`.
- [ ] `stock_movement` and `audit_log` rows written.
- [ ] Cash transactions are NOT created by stock reservation alone.
- [ ] Goods receipt increments physical stock; vendor bill settlement triggers cash outflow separately.
