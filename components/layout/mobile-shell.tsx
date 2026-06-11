import { BottomNav } from "@/components/layout/bottom-nav";

type MobileShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function MobileShell({ children }: MobileShellProps): React.JSX.Element {
  return (
    <div className="h-dvh bg-deep text-text-primary">
      <div className="mx-auto flex h-dvh min-h-0 w-full max-w-md flex-col overflow-hidden border-x border-border bg-deep shadow-2xl shadow-black/30">
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
