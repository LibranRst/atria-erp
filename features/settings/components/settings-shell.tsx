"use client";

export function SettingsShell({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mx-auto min-w-0 w-full max-w-md">{children}</div>
  );
}
