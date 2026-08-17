import { redirect } from "next/navigation";

import { getMaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { GroupedSurface, InlineStateRow } from "@/components/ui";
import { MaterialsControlCenter } from "@/features/materials/components/workspaces/materials-control-center";

export const dynamic = "force-dynamic";

export default async function MaterialsPage(): Promise<React.JSX.Element> {
  const result = await getMaterialOperationsDashboard();
  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    return (
      <GroupedSurface>
        <InlineStateRow
          icon="lock"
          title="Akses material dibatasi"
          description={result.error.message}
          tone="critical"
        />
      </GroupedSurface>
    );
  }
  return <MaterialsControlCenter data={result.data} />;
}
