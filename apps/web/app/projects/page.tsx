import React from "react";

import { redirect } from "next/navigation";

import { resolveActor } from "@/server/actor";

import { ProjectListClient } from "@/features/projects/list/components/views/project-list-client";
import { getProjectListPageData } from "@/features/projects/list/server/get-project-list-page-data";

export const dynamic = "force-dynamic";

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  const data = await getProjectListPageData(actor);

  // Loader hanya melapor; halaman web yang menerjemahkannya jadi redirect.
  if (data.status === "restricted") redirect("/");

  return (
    <ProjectListClient
      projects={data.projects}
      clients={data.clients}
      users={data.users}
      isAllowedToCreate={data.isAllowedToCreate}
    />
  );
}
