import React from "react";

import { ProjectListClient } from "@/features/projects/list/components/views/project-list-client";
import { getProjectListPageData } from "@/features/projects/list/server/get-project-list-page-data";

export const dynamic = "force-dynamic";

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  const data = await getProjectListPageData();

  return (
    <ProjectListClient
      projects={data.projects}
      clients={data.clients}
      users={data.users}
      isAllowedToCreate={data.isAllowedToCreate}
    />
  );
}
