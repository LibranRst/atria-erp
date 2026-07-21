# Plan - Rework Project Creation & RAB-Driven Contract Value Workflow

We are reworking the project workflow so that users do not need to input any "Nilai Kontrak (RAB)" (Contract Value) at project creation. The contract value will default to `0` and will be automatically populated/updated only after a detailed client RAB is generated and approved inside the project workspace.

---

## User Review Required

> [!IMPORTANT]
>
> - **Removal of Form Field**: The "Nilai Kontrak (RAB)" input field will be completely removed from the project creation and editing drawer (`ProjectDrawer`).
> - **Budget Initialization**: A new project will be created with `totalContractValue = 0`. The canonical project budget will be initialized with `0` allocated amounts for all categories (Material, Tukang, Operasional, etc.).
> - **RAB Approval Auto-Scale**: When a client RAB is approved in the workspace, it will automatically update the project's contract value, internal budget, gross margin, and scale the allocated category budget amounts based on standard default ratios (excluding any categories that were manually overridden).

---

## Proposed Changes

### 1. Zod Validation Schemas

#### [MODIFY] [project.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/project.ts)

- Change `totalContractValue` in `createProjectSchema` to be optional and default to `0`:
  `totalContractValue: z.number().nonnegative().optional().default(0)`
- Change `totalContractValue` in `updateProjectSchema` to be optional:
  `totalContractValue: z.number().nonnegative().optional()`

#### [MODIFY] [budget.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/lib/validations/budget.ts)

- In `createProjectBudgetFromRatiosSchema`, change `contractValue` to allow `0` (nonnegative instead of positive):
  `contractValue: z.number().nonnegative("Nilai kontrak tidak boleh negatif.")`

---

### 2. Server Actions

#### [MODIFY] [crud.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/project/crud.ts)

- In `updateProjectAction`, check if `data.totalContractValue` is provided. If not, preserve the `existing.totalContractValue` rather than overwriting it with `0`.

#### [MODIFY] [rap-rab.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/app/actions/project/rap-rab.ts)

- Update `approveRabEstimateAction`:
  - When updating the `projectBudgets` record upon RAB approval, fetch the budget along with its category allocations.
  - Recalculate:
    - `internalBudget = approvedValue * budgetCapRatio`
    - `targetGrossAmount = approvedValue - internalBudget`
    - `targetGrossPercentage = (targetGrossAmount / approvedValue) * 100` (if `approvedValue > 0`)
  - Loop through category allocations (`projectBudgetCategory` rows). If they don't have `isManualOverride` set, recalculate their `allocatedAmount` based on their default ratio and the new `internalBudget`, updating their `remainingAmount`, `usedPercentage`, and `status`.

---

### 3. UI Changes

#### [MODIFY] [project-drawer.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/project/project-drawer.tsx)

- Remove the `totalContractValue` state variable.
- Remove the `Nilai Kontrak (RAB)` input field and its markup entirely.
- In the creation and editing calls to `createProjectAction` and `updateProjectAction`, omit `totalContractValue` (or send `0`/`undefined` respectively).

---

## Verification Plan

### Automated Tests

- Run the validation and financial action tests to ensure zero regressions:
  ```bash
  bun test
  ```
- Run compilation:
  ```bash
  bun run build
  ```

### Manual Verification

1. **Create Project**:
   - Open the Projects page (`/projects`).
   - Click "Tambah Proyek". Observe that the "Nilai Kontrak" field is no longer present.
   - Fill in the project name, client, and project manager, and click "Buat Proyek".
   - Open the workspace for the created project. Verify the budget overview shows `Rp 0` for all categories.
2. **Approve RAB**:
   - Go to "RAP & Plan" tab or run a script/seeding that approves a RAB for the project.
   - Verify that the project's contract value and the categories' budget limits are updated correctly.
