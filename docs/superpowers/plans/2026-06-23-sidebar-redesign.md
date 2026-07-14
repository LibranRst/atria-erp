# Plan - Sidebar Redesign & Mobile Viewport Constraints

This plan describes the redesign of the sidebar navigation to be clean, modern, clutter-free, and constrained strictly within the mobile viewport area on desktop screens.

## Proposed Changes

### Mobile Shell & Layout

#### [MODIFY] [sidebar.tsx](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/components/layout/sidebar.tsx)
- Constrain the drawer (`aside`) inside a centered mobile bounds wrapper matching the width (`max-w-md mx-auto`) and height of the mobile shell.
- Redesign the header: Include a minimal "ATRIA ERP" logo/title on the left and a clean, smaller close button on the right.
- Redesign the User Profile card: Use a soft container (`bg-surface-container-low`), clean font hierarchy, and a refined role badge alignment.
- Redesign the Navigation Links: Switch to `text-sm font-medium` for better readability, and ensure active states are visually clean.
- Redesign the Logout Button: Change the big red button in the footer to a list-style navigation item with error styling, aligning with the minimalist iOS-inspired look.

## Verification Plan

### Manual Verification
1. Open the application on a desktop browser.
2. Open the sidebar and verify that it slides in from the left edge of the centered mobile content frame (`max-w-md` boundary) instead of the screen's left edge.
3. Verify that clicking the backdrop overlay still closes the sidebar.
4. Verify navigation links function correctly and active states highlight properly.
5. Verify on mobile viewport sizes that it spans standard mobile drawer sizes.
