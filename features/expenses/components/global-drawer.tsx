"use client";

import React, { useEffect, useState } from "react";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { ExpenseForm } from "./expense-form";
import { getActiveProjectsForExpense, type ProjectForExpense } from "@/app/actions/project/budget";
import { toast } from "sonner";

export function GlobalExpenseDrawer(): React.JSX.Element | null {
  const showDrawer = useUrlSearchParam("new-expense") === "true";
  const requestedDraftId = useUrlSearchParam("expense-draft");
  const [projects, setProjects] = useState<ProjectForExpense[]>([]);

  useEffect(() => {
    if (showDrawer) {
      getActiveProjectsForExpense()
        .then((res) => {
          if (res.success) {
            setProjects(res.data);
          } else {
            console.error("Failed to load projects for expense form:", res.error.message);
            toast.error(res.error.message);
          }
        })
        .catch((err) => {
          console.error("Error loading projects:", err);
          toast.error("Gagal memuat daftar proyek untuk form pengeluaran.");
        });
    }
  }, [showDrawer]);

  const handleClose = React.useCallback(() => {
    updateUrlSearchParam("new-expense", null, "replace");
    updateUrlSearchParam("expense-draft", null, "replace");
  }, []);

  return (
    <ExpenseForm
      open={showDrawer}
      onClose={handleClose}
      projects={projects}
      inventoryLocations={projects[0]?.inventoryLocations ?? []}
      requestedDraftId={requestedDraftId}
    />
  );
}
