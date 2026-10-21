type ProjectManagerCandidate = {
  readonly id: string;
  readonly isActive: boolean;
  readonly role: { readonly dataScope: string };
};

/** Active assigned-scope roles are eligible; retain an existing assignment for editing. */
export function isProjectManagerOption(
  candidate: ProjectManagerCandidate,
  currentManagerIds: readonly (string | null | undefined)[] = [],
): boolean {
  return (
    (candidate.isActive && candidate.role.dataScope === "ASSIGNED") ||
    currentManagerIds.includes(candidate.id)
  );
}
