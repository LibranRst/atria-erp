"use client";

import React from "react";
import { useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { ClientInvoiceForm } from "./client-invoice-form";
import { usePathname } from "@/lib/navigation/workspace-navigation";

export function GlobalInvoiceDrawer(): React.JSX.Element {
  const showDrawer = useUrlSearchParam("new-invoice") === "true";
  const pathname = usePathname();

  return <ClientInvoiceForm key={pathname} open={showDrawer} />;
}
