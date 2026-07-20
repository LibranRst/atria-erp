# Guided RAP Builder and Operational Overview

## Goal

Replace the decorative RAP execution-plan panel with a persistent, role-aware builder for Material, Tukang, Subcon, and final review. After finalization, show a compact operational overview rather than stacked setup forms.

## Workflow

1. Material is required and remains editable while the RAP is `DRAFT`.
2. Tukang and Subcon each require ready packages or an explicit `Tidak Digunakan` decision.
3. Package lifecycle is `DRAFT` (editable) → `ACTIVE` (UI label: Siap) → `LOCKED` when its RAB is approved.
4. Owner/Finance finalizes the internal plan after all setup blockers are cleared; this locks the RAP material baseline but leaves ready packages active until RAB approval.
5. Purchasing, PM, Finance, and Owner share progress while each role only edits authorized stages.

## Delivery

- Persist setup stage, skip decisions, and the last setup updater on `project_rap`.
- Add audited setup progression, scope skip, package reopen, and finalization actions.
- Replace the RAP tab with a four-stage builder while draft and a summary/filter workspace while locked.
- Use compact rows and labeled bottom sheets for material/package detail and editing.
- Provide one revision entry sheet that can create a material revision and selected package revisions without changing Change Order approval rules.

## Verification

- Test progression, skip decisions, package readiness/reopen, finalization guards, RBAC, audit history, and revision scope selection.
- Run lint, TypeScript, production build, workflow tests, and browser checks at 320px, 390px, and 430px.
