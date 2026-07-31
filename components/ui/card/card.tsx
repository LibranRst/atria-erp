import type { ComponentPropsWithoutRef } from "react";

const cardVariants = {
  surface: "bg-surface",
  elevated: "bg-elevated",
} as const;

type CardVariant = keyof typeof cardVariants;

type CardProps = ComponentPropsWithoutRef<"div"> & {
  variant?: CardVariant;
};

export function Card({ className, variant = "surface", ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={`rounded-2xl border border-border p-4 shadow-control ${cardVariants[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">): React.JSX.Element {
  return <div className={`mb-4 space-y-1.5 ${className ?? ""}`} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">): React.JSX.Element {
  return (
    <h2
      className={`text-lg font-semibold tracking-tight text-text-primary ${className ?? ""}`}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">): React.JSX.Element {
  return <p className={`text-sm text-secondary ${className ?? ""}`} {...props} />;
}

export function CardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">): React.JSX.Element {
  return <div className={`text-sm text-text-primary ${className ?? ""}`} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">): React.JSX.Element {
  return (
    <div
      className={`mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted ${className ?? ""}`}
      {...props}
    />
  );
}
