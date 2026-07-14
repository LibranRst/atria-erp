# Manual E2E QA Checklist

Use this checklist before deploy or after large refactors. Focus on proving the main business workflows still work end to end.

## Test Setup
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] Start the app locally.
- [ ] Prepare one dummy project name: `QA Test Project - 2026-07-02`.
- [ ] Prepare test users for available roles:
  - [ ] Owner
  - [ ] Finance Admin
  - [ ] Project Manager
  - [ ] Purchasing
- [ ] Keep browser console open and note any runtime errors.

## 1. Login And Role Access
- [ ] Login as Owner.
- [ ] Confirm Owner can access dashboard, projects, expenses, ledger/approvals, materials, and settings.
- [ ] Login as Finance Admin.
- [ ] Confirm finance pages and payment actions are visible where expected.
- [ ] Login as Project Manager.
- [ ] Confirm project and field expense flows are visible.
- [ ] Login as Purchasing.
- [ ] Confirm material/inventory flows are visible.
- [ ] Confirm unauthorized pages/actions are not exposed for each role.

## 2. Project Create/Edit Flow
- [ ] Open `/projects`.
- [ ] Click create project.
- [ ] Create `QA Test Project - 2026-07-02`.
- [ ] Select or create a client.
- [ ] Select a Project Manager.
- [ ] Add location, room/area, project type, start date, and notes.
- [ ] Upload or change project cover image if upload credentials are available.
- [ ] Submit project.
- [ ] Confirm the project appears in the project list.
- [ ] Open the project detail page.
- [ ] Edit the project from the drawer.
- [ ] Save changes.
- [ ] Refresh page and confirm edited values persist.

Expected result:
- [ ] Project is created without errors.
- [ ] Initial budget/category setup is available.
- [ ] Project detail route works and does not break tabs.

## 3. RAP/RAB Project Detail Flow
- [ ] Open the QA project detail page.
- [ ] Open RAP/RAB or planning tab.
- [ ] Create RAP draft.
- [ ] Add at least one material RAP item.
- [ ] Add or skip Tukang scope according to the UI flow.
- [ ] Add or skip Subcon scope according to the UI flow.
- [ ] Advance setup stages until review.
- [ ] Finalize internal plan.
- [ ] Generate client-facing RAB/quotation.
- [ ] Review generated RAB lines.
- [ ] Add one manual client-safe RAB line.
- [ ] Edit one RAB line.
- [ ] Approve RAB.

Expected result:
- [ ] RAP moves from draft/setup into locked/finalized state.
- [ ] RAB is generated without exposing internal notes.
- [ ] Approved RAB updates project contract value/budget context.
- [ ] Project tabs still load after approval.

## 4. Field Expense / Claim Flow
- [ ] Open `/expenses` or open expense drawer from the QA project detail page.
- [ ] Select the QA project.
- [ ] Add one manual expense line.
- [ ] Select budget category.
- [ ] Fill quantity, unit price, amount, and description.
- [ ] Submit expense.
- [ ] Confirm expense appears in Finance Inbox / Field Claims.
- [ ] As Finance Admin or allowed role, verify the expense.
- [ ] If approval is required, approve it as Owner.
- [ ] Select bank account.
- [ ] Fill transfer/reference number.
- [ ] Pay/disburse the expense.

Optional receipt OCR:
- [ ] Upload receipt image.
- [ ] Confirm OCR fills expense lines or shows a clear warning.
- [ ] Manually adjust unmatched lines.
- [ ] Submit successfully.

Expected result:
- [ ] Status transitions work: `SUBMITTED -> VERIFIED/APPROVED -> PAID`.
- [ ] Receipt lightbox opens if receipt exists.
- [ ] Budget/category usage updates after verify/pay.
- [ ] Dashboard/expense list reflects the paid state.

## 5. Vendor Bill Flow
- [ ] Open `/expenses`.
- [ ] Switch to Vendor Bills.
- [ ] Create a vendor bill for the QA project.
- [ ] Select vendor, project, category, amount, due date, and description.
- [ ] Save bill.
- [ ] Confirm bill appears in vendor bill list.
- [ ] Schedule or submit payment if the UI supports it.
- [ ] Approve payment as Owner if approval is required.
- [ ] Pay vendor bill from a bank account.

Expected result:
- [ ] Vendor bill is visible in Finance Inbox.
- [ ] Payment status updates correctly.
- [ ] Ledger/cash due view reflects the vendor bill state.

## 6. Material / Inventory Flow
- [ ] Open `/materials`.
- [ ] Confirm material control center loads.
- [ ] Record stock in / goods receipt for a material.
- [ ] Confirm current stock increases.
- [ ] Reserve material for the QA project.
- [ ] Confirm reserved and available stock update correctly.
- [ ] Use material for the QA project.
- [ ] Confirm current/reserved stock update correctly.
- [ ] Return leftover material.
- [ ] Confirm stock increases and non-cash reversal is reflected.
- [ ] Record waste material with an audit note.
- [ ] Confirm stock decreases and note is stored.

Expected result:
- [ ] Every stock-changing action succeeds only with explicit action.
- [ ] Stock movement history is created.
- [ ] No cash transaction is created directly by stock reservation/use.
- [ ] Material usage remains linked to Material budget category only.

## 7. Finance Dashboard / Ledger Smoke Test
- [ ] Open `/ledger`.
- [ ] Confirm overview dashboard loads without blank sections.
- [ ] Check bank account cards.
- [ ] Check priority/approval list.
- [ ] Check project risk cards.
- [ ] Check category health.
- [ ] Check recent cash activity.
- [ ] Open Budget Risk tab.
- [ ] Open Cash Due tab.
- [ ] Open Materials tab.
- [ ] Open Approvals tab as Owner.

Expected result:
- [ ] Dashboard numbers are plausible after QA actions.
- [ ] Links from dashboard cards go to valid pages.
- [ ] No console/runtime errors appear.

## 8. Settings Smoke Test
- [ ] Open `/settings`.
- [ ] Open Budget settings.
- [ ] Change a non-critical note/name value, then save.
- [ ] Open Expense Categories.
- [ ] Confirm canonical categories are visible.
- [ ] Open Item & Price Library.
- [ ] Create or edit one test library item.
- [ ] Open Material Settings.
- [ ] Create or edit one material/category setting.

Expected result:
- [ ] Settings save successfully.
- [ ] Settings remain the source of truth for budget allocation, expense categories, item library, and material master.
- [ ] No environment variables or schema changes are required.

## 9. Navigation And Mobile Shell
- [ ] Test bottom navigation on mobile viewport.
- [ ] Confirm nav items match role.
- [ ] Open quick action FAB.
- [ ] Trigger each visible quick action enough to confirm it opens the expected drawer/page.
- [ ] Confirm locked project actions show a clear error instead of opening invalid flows.
- [ ] Confirm back/close behavior returns to a usable URL.

## 10. Final Regression Checks
- [ ] Refresh every major page once: `/projects`, project detail, `/expenses`, `/materials`, `/ledger`, `/settings`.
- [ ] Confirm no blank screens.
- [ ] Confirm no broken image/upload states.
- [ ] Confirm query-param drawers can open and close.
- [ ] Confirm browser console has no new errors.
- [ ] Re-run `bun run lint`.
- [ ] Re-run `bun run build`.

## QA Notes Template
Use this for every issue found.

```txt
Date:
Tester:
Role:
Page/URL:
Workflow:
Expected:
Actual:
Console error:
Screenshot/video:
Severity: Low / Medium / High / Blocker
```

## Deploy Gate
Do not deploy until these are true:
- [ ] `bun run lint` passes.
- [ ] `bun run build` passes.
- [ ] Login works.
- [ ] Project create/edit works.
- [ ] RAP/RAB approval works.
- [ ] Field expense submit/verify/pay works.
- [ ] Material stock in/use works.
- [ ] Finance dashboard loads.
- [ ] No blocker or high-severity QA issue remains.
