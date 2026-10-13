---
version: 1
slug: "apps-web-app-profile-page-tsx"
primary_target: "apps/web/app/profile/page.tsx"
related_targets:
  [
    "apps/web/components/layout/desktop-profile-menu.tsx",
    "apps/web/features/notifications/components/notification-bell-button.tsx",
  ]
---

# Profile workspace

Mode: Operate. Account holders inspect their identity, security and actual domain permissions, update their name/photo/password, manage device preferences and end their session.

Desktop uses the user-approved two-column account workspace: compact identity/edit/session on the left; security, browser notifications and native permission table on the right. Permission detail preserves both granted and missing rights. Conditional developer simulation remains secondary. The same page/provider and draft owners survive resize; mobile retains its existing section order and composition.

Topbar notification and avatar controls expose anchored contextual surfaces. Notifications preserve category/unread/pagination behavior; account menu offers Profile, permitted Settings and confirmed Logout. Desktop form/detail sheets center within viewport clearance, preserving one focus/dismissal owner and bounded scrolling. Mobile sheet/morph behavior remains intact.

Atria's existing visual system is authoritative. No new identity, bulk workflow or authorization behavior. No unresolved design decisions. Confirmed via seven-width QA, keyboard/draft checks and independent review disposition `ship`.

App installation/PWA and Home Screen guidance are mobile-only Profile rows. Desktop retains browser push preferences. The loading skeleton follows the same visibility rule.
