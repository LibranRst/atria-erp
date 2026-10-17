import {
  getReconciliationDesktopWorkspace,
  getReconciliationMatchContext,
} from "@/app/actions/finance/reconciliation-desktop";

// A single replaceable read boundary also keeps isolated visual fixtures off the API.
export const readReconciliationDesktop = getReconciliationDesktopWorkspace;
export const readReconciliationMatchContext = getReconciliationMatchContext;
