import { Link } from "@heroui/react";
import { atriaWebHref } from "./app-links";

export function StatusPage({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg space-y-5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="max-w-prose text-sm leading-6 text-muted">{description}</p>
        {children}
        <Link href={atriaWebHref()} className="text-sm">
          Buka Atria
          <Link.Icon aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
