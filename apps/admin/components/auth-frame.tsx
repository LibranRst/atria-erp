import { Card, Link } from "@heroui/react";
import { atriaWebHref } from "./app-links";

export function AuthFrame({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold">Atria Admin</p>
          <p className="text-sm text-muted">Dekoria · Project Finance & Material Control</p>
        </div>
        <Card className="p-6">
          <Card.Header className="mb-3">
            <h1 className="text-xl font-semibold">{title}</h1>
            <Card.Description>{description}</Card.Description>
          </Card.Header>
          <Card.Content>{children}</Card.Content>
        </Card>
        <Link className="text-sm" href={atriaWebHref()}>
          Buka Atria
          <Link.Icon aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
