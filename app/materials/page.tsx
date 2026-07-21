import { redirect } from "next/navigation";

import { getMaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import {
  MaterialGroupSurface,
  MaterialInlineState,
} from "@/features/materials/components/material-page-primitives";
import { MaterialsControlCenter } from "@/features/materials/components/materials-control-center";

export default async function MaterialsPage(): Promise<React.JSX.Element> {
  const result = await getMaterialOperationsDashboard();
  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    return (
      <MaterialGroupSurface>
        <MaterialInlineState
          icon="lock"
          title="Akses material dibatasi"
          description={result.error.message}
          tone="critical"
        />
      </MaterialGroupSurface>
    );
  }
  return <MaterialsControlCenter data={result.data} />;
}
