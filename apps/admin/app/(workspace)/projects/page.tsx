import { Alert } from "@/components/ui";
import { ProjectList } from "@/features/projects/components/project-list";
import { loadProjects } from "@/features/projects/server/data";

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  const { data, permissions, formOptions } = await loadProjects();
  if (data.status === "restricted")
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Akses proyek terbatas</Alert.Title>
          <Alert.Description>
            Workspace admin terbuka, tetapi akun Anda belum memiliki izin untuk melihat proyek dan
            budget. Hubungi pengelola akses.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  return (
    <ProjectList projects={data.projects} permissions={permissions} formOptions={formOptions} />
  );
}
