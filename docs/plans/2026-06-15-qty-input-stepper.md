# Implementation Plan - Improve UI/UX Quantity Input Field

Improve the quantity input field UX by replacing the plain numeric input with a premium, mobile-optimized horizontal stepper component. The new control will conform to iOS 26 Solid design aesthetics and meet mobile usability guidelines.

## User Review Required

> [!IMPORTANT]
>
> - **Horizontal Stepper Component**: Preceded and followed by `-` and `+` tap targets (size $48 \times 44$ px, meeting iOS $\ge 44 \times 44$ px guidelines).
> - **Dynamic Unit Labels**: Budget item units (e.g. `lembar`, `pcs`) are moved to the field label (`Qty (lembar)`) to prevent clutter inside the stepper.
> - **Spinners Hidden**: Standard browser spinner handles (`type="number"`) are suppressed.

## Proposed Changes

### Component Changes

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)

- Add the `adjustQuantity(index, delta)` helper function below `updateLine`.
- Adjust grid columns:
  - Increase Quantity column span from `col-span-4` to `col-span-5` to allow comfortable spacing for flanking buttons.
  - Decrease Unit Price column span from `col-span-8` to `col-span-7` to preserve the 12-column grid row layout.
- Replace the existing `qty-input` input with:
  - Flanking decrement (`-`) and increment (`+`) buttons.
  - Centered text input with disabled spinners.
  - Tactile active state scale effects (`active:scale-95`).
- Place the item's unit directly inside the label (e.g. `Qty (pcs)`) instead of floating inside the input.

```tsx
const adjustQuantity = (index: number, delta: number) => {
  const currentQty = lines[index].quantity === "" ? 0 : Number(lines[index].quantity);
  const newQty = Math.max(0.01, Number((currentQty + delta).toFixed(2)));
  updateLine(index, "quantity", newQty);
};
```

## Verification Plan

### Automated Tests

- Run the test suite: `bun test` to ensure there are no compilation errors or test regressions.

### Manual Verification

- Compile production bundle: `bun run build` to verify Next.js builds cleanly with the new changes.
- Check visual layout matches mobile view constraints.
