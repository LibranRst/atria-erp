import { Alert } from "@/components/ui";
import { ProjectDetail } from "@/features/projects/components/project-detail";
import { loadProject } from "@/features/projects/server/data";

export default async function ProjectPage({
  params,
}: {
  readonly params: Promise<{ readonly projectId: string }>;
}): Promise<React.JSX.Element> {
  const { projectId } = await params;
  const { data, permissions, formOptions } = await loadProject(projectId);
  if (!data)
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Akses proyek terbatas</Alert.Title>
          <Alert.Description>Anda belum memiliki izin melihat proyek ini.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  return <ProjectDetail data={data} permissions={permissions} formOptions={formOptions} />;
}
