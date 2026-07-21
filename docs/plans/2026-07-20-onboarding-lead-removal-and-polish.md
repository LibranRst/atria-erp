# Plan: Onboarding Lead Removal and Hierarchy Polish

This plan addresses the visual clutter and redundant text stacking in the Owner Onboarding workspace by removing the `OnboardingLead` component and promoting step-specific descriptions directly into the main workspace header.

## Visual & Hierarchy Analysis

Currently, each onboarding step page has two competing header elements stacked on top of each other:

1. **Workspace Header (Title & Eyebrow):** E.g., `Langkah 1` and `Review default finansial`.
2. **OnboardingLead Card:** E.g., Icon `tune`, Title `Kebijakan untuk proyek berikutnya`, Detail `Cukup pastikan batas budget...`, and Status Badge `Default aktif`.

On mobile viewports (320px–430px), this layout creates significant visual clutter, pushes interactive elements below the fold, and feels text-heavy.

## Proposed Design System Solution

In accordance with `/atria-ui-ux` guidelines (minimizing nested containers/cards and reducing decorative elements/visual noise):

1. **Promote Step Description to Workspace Header:**
   Currently, `owner-onboarding-workspace.tsx` only renders `copy.description` for the `welcome` and `summary` steps. We will update the workspace header to render `copy.description` for **all steps**. This will position a clean, unified explanation text block directly under the 26px step title.

2. **Remove `OnboardingLead` Completely:**
   Remove the `OnboardingLead` element from all 6 onboarding step panels. This will remove:
   - The large colored icon container (removes visual weight/decoration).
   - The secondary title (removes redundancy).
   - The secondary detail copy (already covered/aligned with the header's step description).
   - The small status text/badge (redundant because the status is already fully verified by the `OnboardingVerificationPanel` at the bottom of the page and listed on the final summary screen).

3. **Keep `OnboardingStage` clean:**
   Interactive lists, segmented tabs, and toolbars will start immediately below the main workspace header.

## Affected Components

### 1. [MODIFY] [owner-onboarding-workspace.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/owner-onboarding-workspace.tsx)

- Enable rendering `copy.description` for all steps in the header instead of restricting it to `welcome` and `summary`.
- Slightly align the spacing between the title and the description.

### 2. [MODIFY] [onboarding-primitives.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/onboarding-primitives.tsx)

- Mark `OnboardingLead` as deprecated or remove it entirely if it is no longer used elsewhere. (We will remove it to keep code clean).

### 3. [MODIFY] Step Panels:

Remove `<OnboardingLead>` from:

- [financial-defaults-panel.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/financial-defaults-panel.tsx)
- [team-vendors-panel.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/team-vendors-panel.tsx)
- [setup-bank-accounts-panel.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/setup-bank-accounts-panel.tsx)
- [material-foundation-panel.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/material-foundation-panel.tsx)
- [library-panel.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/library-panel.tsx)
- [initial-stock-setup-panel.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/components/initial-stock-setup-panel.tsx)

### 4. [MODIFY] [onboarding-workspace.test.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/features/onboarding/onboarding-workspace.test.ts)

- Update tests that assert the presence of `"OnboardingLead"`.

## Verification Plan

### Automated Tests

- Run `bun test features/onboarding/onboarding-workspace.test.ts` to ensure the compilation and structure tests pass.

### Manual Verification

- Check the visual layout on simulated mobile viewports (320px–430px) to confirm that the text flows naturally, buttons/tabs have higher prominence, and vertical scrolling is minimized.
