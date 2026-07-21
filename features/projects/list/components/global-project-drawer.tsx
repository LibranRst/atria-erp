"use client";

import React, { useEffect, useState } from "react";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { ProjectDrawer } from "./project-drawer";
import { getProjectFormData } from "@/app/actions/project/crud";
import { toast } from "sonner";

interface ClientOption {
  readonly id: string;
  readonly name: string;
}

interface UserOption {
  readonly id: string;
  readonly name: string;
}

export function GlobalProjectDrawer(): React.JSX.Element | null {
  const showDrawer = useUrlSearchParam("new-project") === "true";
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (showDrawer) {
      getProjectFormData()
        .then((res) => {
          if (res.success) {
            setClients(res.data.clients);
            setUsers(res.data.users);
          } else {
            console.error("Failed to load project form data:", res.error.message);
            toast.error(res.error.message);
          }
        })
        .catch((err) => {
          console.error("Error loading project form data:", err);
          toast.error("Gagal memuat data form proyek.");
        });
    }
  }, [showDrawer]);

  const handleClose = React.useCallback(() => {
    updateUrlSearchParam("new-project", null, "replace");
  }, []);

  return (
    <ProjectDrawer isOpen={showDrawer} onClose={handleClose} clients={clients} users={users} />
  );
}
