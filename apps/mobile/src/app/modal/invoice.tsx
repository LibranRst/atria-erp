import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { Redirect } from "expo-router";

import { PlannedFormSheet } from "@/components/shell/planned-form-sheet";
import { useAuth } from "@/providers/auth-provider";

export default function InvoiceModal(): React.JSX.Element {
  const { roleName } = useAuth();
  const permissions = roleName ? (ROLE_PERMISSIONS[roleName] ?? []) : [];
  if (!permissions.includes("create:client_invoice")) return <Redirect href="/" />;

  return (
    <PlannedFormSheet
      description="Drawer invoice klien web dipetakan ke form sheet native dengan riwayat navigasi sendiri."
      sourceLabel="Drawer invoice klien"
      title="Invoice klien"
    />
  );
}
