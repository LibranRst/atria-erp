import { redirect } from "next/navigation";

import { getMaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { MaterialsControlCenter } from "@/features/materials/components/materials-control-center";

export default async function MaterialsPage(): Promise<React.JSX.Element> {
  const result = await getMaterialOperationsDashboard();
  if (!result.success) {
    if (result.error.code === "UNAUTHORIZED") redirect("/login");
    return <section className="rounded-[28px] border border-outline-variant/20 bg-white p-md text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)]"><h1 className="text-lg font-bold">Akses Material Ditolak</h1><p className="mt-2 text-xs text-error">{result.error.message}</p></section>;
  }
  return <MaterialsControlCenter data={result.data} />;
}
