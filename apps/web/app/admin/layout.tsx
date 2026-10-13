export const dynamic = "force-dynamic";

/** Historical links resolve to canonical pages, whose loaders own authorization. */
export default function LegacyWorkspaceLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
