import { Redirect } from "expo-router";

import { PlannedFormSheet } from "@/components/shell/planned-form-sheet";
import { useAuth } from "@/providers/auth-provider";

export default function VendorBillModal(): React.JSX.Element {
  const { permissions } = useAuth();
  if (!permissions.includes("create:vendor_bill")) return <Redirect href="/" />;

  return (
    <PlannedFormSheet
      description="Pencatatan tagihan vendor masih dibuka di web selama porting aplikasi."
      webDestination="/expenses?new-vendor-bill=true"
      title="Tagihan vendor"
    />
  );
}
