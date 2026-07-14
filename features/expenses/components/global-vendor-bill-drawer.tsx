"use client";

import React, { useEffect, useState } from "react";
import { updateUrlSearchParam, useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { VendorBillForm, type VendorBillFormVendor } from "./vendor-bill-form";
import { getVendorBillFormData } from "@/app/actions/finance/submit-vendor-bill";
import type { ProjectForExpense } from "@/app/actions/project/budget";
import { toast } from "sonner";

export function GlobalVendorBillDrawer(): React.JSX.Element | null {
  const showDrawer = useUrlSearchParam("new-vendor-bill") === "true";

  const [projects, setProjects] = useState<ProjectForExpense[]>([]);
  const [vendors, setVendors] = useState<VendorBillFormVendor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showDrawer) {
      Promise.resolve()
        .then(() => {
          setLoading(true);
          return getVendorBillFormData();
        })
        .then((res) => {
          if (res.success) {
            setProjects(res.data.projects);
            setVendors(res.data.vendors);
          } else {
            console.error("Failed to load vendor bill form data:", res.error.message);
            toast.error(res.error.message);
          }
        })
        .catch((err) => {
          console.error("Error loading vendor bill form data:", err);
          toast.error("Gagal memuat data form tagihan vendor.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [showDrawer]);

  const handleClose = React.useCallback(() => {
    updateUrlSearchParam("new-vendor-bill", null, "replace");
  }, []);

  return (
    <VendorBillForm
      open={showDrawer}
      onClose={handleClose}
      projects={projects}
      vendors={vendors}
      loading={loading}
    />
  );
}
