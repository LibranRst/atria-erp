import type { vendor } from "@/db/schema";
import type { AdministrationCapabilities } from "@atria/core/auth/administration-access";

export type AdministrationUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
};

export type AdministrationVendor = typeof vendor.$inferSelect;

export type AdministrationOverview = {
  readonly capabilities: AdministrationCapabilities;
  readonly users: readonly AdministrationUser[];
  readonly vendors: readonly AdministrationVendor[];
  readonly roles: readonly { id: string; name: string }[];
};

export type ProductionReadinessItem = {
  readonly id: string;
  readonly label: string;
  readonly ready: boolean;
  readonly detail: string;
};
