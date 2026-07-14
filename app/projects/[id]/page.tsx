import React from "react";

import { ProjectTabs } from "@/features/projects/detail/components/project-tabs";
import { getProjectDetailData } from "@/features/projects/detail/server/project-detail-data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id: projectId } = await params;
  const projectTabsProps = await getProjectDetailData(projectId);

  return (
    <div className="space-y-sm select-none">
      <ProjectTabs {...projectTabsProps} />
    </div>
  );
}
