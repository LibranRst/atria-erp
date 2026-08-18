import { useLocalSearchParams } from "expo-router";

import { ProjectFormSheet } from "@/components/project/project-form-sheet";

export default function ProjectModal(): React.JSX.Element {
  const params = useLocalSearchParams<{ readonly projectId?: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  return <ProjectFormSheet projectId={projectId} />;
}
