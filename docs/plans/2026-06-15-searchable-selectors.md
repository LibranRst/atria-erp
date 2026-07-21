# Implementation Plan - Searchable Selectors Bottom Sheets

Improve the UI/UX of select inputs in the Expense Form (`ExpenseForm`) by replacing native browser `<select>` dropdowns with custom, searchable iOS-style Bottom Sheet Pickers that slide up dynamically over the form.

## User Review Required

> [!IMPORTANT]
>
> - **Searchable Bottom Sheets**: Dropdowns are replaced by full/half-screen bottom sheets sliding up (`z-110`) with a search input.
> - **Tactile Triggers**: Selector buttons replace the `<select>` tag, styled as standard iOS inputs with custom icons.
> - **Dynamic Categorized Search**: BoQ items are grouped by category, searchable by title or category, showing real-time remaining budgets.

## Proposed Changes

### Component Changes

#### [MODIFY] [expense-form.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/expense/expense-form.tsx)

- Define state variables:
  - `showProjectPicker` (boolean) to control the Project picker drawer.
  - `activeBoqPickerLineIndex` (number | null) to track which line item is currently opening the BoQ picker drawer.
  - `searchQuery` (string) to hold the current search text.
- Create sub-components or inline panels for:
  - **Project Picker Drawer**: Displays available active projects.
  - **BoQ Item Picker Drawer**: Includes a search input and groups filtered items by category. Shows budget status (allocated, spent, remaining) on each row.
- Replace HTML `<select>` triggers with styled interactive `<button>` elements that trigger the corresponding drawer.
- Ensure all pickers support tactile press animations (`active:scale-[0.98]`) and clean transitions.

## Verification Plan

### Automated Tests

- Run `bun test` to verify that no validations or API logic are broken by the UI changes.

### Manual Verification

- Verify Next.js build compilation with `bun run build`.
- Manually inspect selection behaviors, search filtering accuracy, and visual responsiveness.
