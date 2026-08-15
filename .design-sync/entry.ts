// Synthetic package entry for design-sync. Atria ERP is a private Next.js app
// (no publishable dist), so this barrel stands in for a package's built
// entry point — it re-exports the design-system surface the /design-sync
// skill scoped in: components/ui/** (via its own public barrel) plus the
// components/layout/** shell (not re-exported by app code, so named here).
export * from "../components/ui";
// BottomNav itself is excluded: it imports ROLE_ID_TO_NAME from
// lib/auth/permissions.ts, which also imports the real Drizzle DB client at
// module scope (same class of issue as MobileShell's Global*Drawer imports).
// Its prop-driven subparts below have no such coupling.
export {
  BottomNavBackdrop,
  BottomTabBar,
  QuickActionFab,
} from "../components/layout/bottom-nav-parts";
export { HeaderMorphMenu } from "../components/layout/header-morph-menu";

// Real components used across the app but not re-exported by the ui barrel.
export { FactRow, PanelSection, SheetSection } from "../components/ui/feedback/main-surface";
export { MoneyMetricPill, MoneyValue } from "../components/ui/feedback/page-primitives";
