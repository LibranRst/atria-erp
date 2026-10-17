---
version: 1
slug: "app-profile-page-tsx"
primary_target: "app/profile/page.tsx"
# prettier-ignore
related_targets: ["components/layout/desktop-profile-menu.tsx","features/notifications/components/notification-bell-button.tsx"]
---

# Profile workspace

Mode: Operate. Account holders inspect their identity, security and actual domain permissions, update their name/photo/password, manage device preferences and end their session.

Desktop uses the user-approved two-column account workspace: compact identity/edit/session on the left; security, browser notifications and native permission table on the right. Permission detail preserves both granted and missing rights. Conditional developer simulation remains secondary. The same page/provider and draft owners survive resize; mobile retains its existing section order and composition.

Topbar notification and avatar controls expose anchored contextual surfaces. Notifications preserve category/unread/pagination behavior; account menu offers Profile, permitted Settings and confirmed Logout. Desktop form/detail sheets center within viewport clearance, preserving one focus/dismissal owner and bounded scrolling. Mobile sheet/morph behavior remains intact.

Atria's existing visual system is authoritative. No new identity, bulk workflow or authorization behavior. No unresolved design decisions. Confirmed via seven-width QA, keyboard/draft checks and independent review disposition `ship`.

App installation/PWA and Home Screen guidance are mobile-only Profile rows. Desktop retains browser push preferences. The loading skeleton follows the same visibility rule.

## Consistency audit, 2026-10-16

Identity, security and access wrappers are persistent labeled logical focus destinations. Edit/password/permission sheets use their existing single overlay owner and `returnFocusRef`, preserving draft DOM/focus through resize and returning to visible context after a replaced invoker. OperationalFormSheet forwards the same optional contract; no feature-local focus infrastructure is introduced. Dirty name/photo cancellation and explicit saves remain with the existing editor; password dismissal remains intentionally ephemeral.

Display-only permission summaries exclude compatibility `use:desktop_admin` and resulting empty groups; responsive desktop access never depends on that historical grant. Other granted and missing rights remain inspectable, and stored grants/catalog/authorization do not change. The desktop skeleton uses the same account layout and native shared table hierarchy with inert hidden placeholders; mobile skeleton and section order retain their incumbent contract. Evidence and acceptance are recorded in `docs/plans/2026-10-16-desktop-settings-profile-consistency-audit.md`.
