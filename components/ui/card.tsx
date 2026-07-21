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
      className={`border-border rounded-2xl border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${cardVariants[variant]} ${className ?? ""}`}
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
      className={`text-text-primary text-lg font-semibold tracking-tight ${className ?? ""}`}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">): React.JSX.Element {
  return <p className={`text-secondary text-sm ${className ?? ""}`} {...props} />;
}

export function CardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">): React.JSX.Element {
  return <div className={`text-text-primary text-sm ${className ?? ""}`} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">): React.JSX.Element {
  return (
    <div
      className={`border-border text-muted mt-4 flex items-center gap-2 border-t pt-4 text-sm ${className ?? ""}`}
      {...props}
    />
  );
}
