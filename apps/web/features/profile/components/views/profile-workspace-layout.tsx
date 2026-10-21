"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import styles from "./profile-workspace-layout.module.css";

/** Layout alone changes across resize; account controls and sheet owners stay mounted. */
export function ProfileWorkspaceLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <section
      className={`${styles.layout} ${desktop ? styles.desktop : "space-y-sm pb-8 max-[430px]:-mx-1 max-[430px]:pb-6"}`}
    >
      {children}
    </section>
  );
}
