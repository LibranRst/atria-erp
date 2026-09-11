type DocumentNavigator = Pick<Location, "replace">;

/**
 * Authentication changes data owned by the root server layout (actor, permissions,
 * and user profile). A document navigation mounts that tree once with the new
 * session; combining a client push with refresh can make Next's router process two
 * overlapping tree updates and violate its own hook order.
 */
export function navigateAfterLogin(navigator: DocumentNavigator, destination = "/"): void {
  navigator.replace(destination);
}
