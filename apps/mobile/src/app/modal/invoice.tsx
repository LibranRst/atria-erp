import { Redirect } from "expo-router";

import { PlannedFormSheet } from "@/components/shell/planned-form-sheet";
import { useAuth } from "@/providers/auth-provider";

export default function InvoiceModal(): React.JSX.Element {
  const { permissions } = useAuth();
  if (!permissions.includes("create:client_invoice")) return <Redirect href="/" />;

  return (
    <PlannedFormSheet
      description="Pencatatan invoice klien masih dibuka di web selama porting aplikasi."
      webDestination="/projects"
      title="Invoice klien"
    />
  );
}
