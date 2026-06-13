"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExpenseForm } from "./expense-form";
import { getActiveProjectsForExpense } from "@/app/actions/project/budget";

export function GlobalExpenseDrawer(): React.JSX.Element | null {
  const searchParams = useSearchParams();
  const showDrawer = searchParams.get("new-expense") === "true";
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (showDrawer) {
      setIsLoading(true);
      getActiveProjectsForExpense()
        .then((res) => {
          if (res.success) {
            setProjects(res.data);
          } else {
            console.error("Failed to load projects for expense form:", res.error.message);
          }
        })
        .catch((err) => {
          console.error("Error loading projects:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [showDrawer]);

  if (!showDrawer) return null;

  return <ExpenseForm projects={projects} />;
}
