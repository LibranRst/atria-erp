import { redirect } from "next/navigation";

import { getMaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { MaterialLoadState } from "@/features/materials/components/shared/material-load-state";
import { MaterialsControlCenter } from "@/features/materials/components/workspaces/materials-control-center";

export const dynamic = "force-dynamic";

export default async function MaterialsPage(): Promise<React.JSX.Element> {
  const result = await getMaterialOperationsDashboard();
  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login?returnTo=%2Fmaterials");
    return (
      <MaterialLoadState
        restricted={result.error.code === "FORBIDDEN"}
        message={result.error.message}
      />
    );
  }
  return <MaterialsControlCenter data={result.data} />;
}
