import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { Redirect } from "expo-router";

import { PlannedFormSheet } from "@/components/shell/planned-form-sheet";
import { useAuth } from "@/providers/auth-provider";

export default function VendorBillModal(): React.JSX.Element {
  const { roleName } = useAuth();
  const permissions = roleName ? (ROLE_PERMISSIONS[roleName] ?? []) : [];
  if (!permissions.includes("create:vendor_bill")) return <Redirect href="/" />;

  return (
    <PlannedFormSheet
      description="Drawer tagihan vendor web dipetakan ke form sheet native yang dapat dibuka dari konteks mana pun."
      sourceLabel="Drawer tagihan vendor"
      title="Tagihan vendor"
    />
  );
}
