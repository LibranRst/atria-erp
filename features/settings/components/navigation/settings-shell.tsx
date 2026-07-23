"use client";

export function SettingsShell({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className="mx-auto w-full max-w-md min-w-0">{children}</div>;
}
