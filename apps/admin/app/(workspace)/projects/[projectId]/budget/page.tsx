import { Alert } from "@/components/ui";
import { BudgetEditor } from "@/features/projects/components/budget-editor";
import { loadProject } from "@/features/projects/server/data";

export default async function BudgetPage({
  params,
}: {
  readonly params: Promise<{ readonly projectId: string }>;
}): Promise<React.JSX.Element> {
  const { projectId } = await params;
  const { data, permissions } = await loadProject(projectId);
  if (!data)
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Akses budget terbatas</Alert.Title>
          <Alert.Description>Anda belum memiliki izin melihat budget proyek ini.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  return (
    <BudgetEditor
      projectId={projectId}
      projectName={data.project.name}
      contractValue={Number(data.project.totalContractValue)}
      initialBudget={data.projectBudgetDashboard}
      permissions={permissions}
      locked={data.project.status === "COMPLETED" || data.project.status === "CANCELLED"}
    />
  );
}
