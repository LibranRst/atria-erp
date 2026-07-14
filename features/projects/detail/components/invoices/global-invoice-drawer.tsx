"use client";

import React from "react";
import { useUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { ClientInvoiceForm } from "./client-invoice-form";

export function GlobalInvoiceDrawer(): React.JSX.Element {
  const showDrawer = useUrlSearchParam("new-invoice") === "true";

  return <ClientInvoiceForm open={showDrawer} />;
}
