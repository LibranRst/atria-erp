"use client";

import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";

import { MoneyValue } from "../feedback/page-primitives";
import { cx } from "./form-control-utils";

export type FormRiskTone = "default" | "warning" | "danger" | "success";

function toneClasses(tone: FormRiskTone): {
  readonly shell: string;
  readonly icon: string;
} {
  if (tone === "danger") {
    return {
      shell: "bg-error-container/25 text-error ring-error/15",
      icon: "text-error",
    };
  }
  if (tone === "warning") {
    return {
      shell: "bg-warning-light text-warning ring-warning/15",
      icon: "text-warning",
    };
  }
  if (tone === "success") {
    return {
      shell: "bg-primary/5 text-primary ring-primary/10",
      icon: "text-primary",
    };
  }
  return {
    shell: "bg-surface-container-high/30 text-on-surface-variant ring-ring-subtle",
    icon: "text-on-surface-variant",
  };
}

export function FormRiskNotice({
  title,
  children,
  tone = "default",
  inverse = false,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly tone?: FormRiskTone;
  readonly inverse?: boolean;
}): React.JSX.Element {
  const inverseText =
    tone === "danger"
      ? "text-critical-on-inverse"
      : tone === "warning"
        ? "text-warning-on-inverse"
        : "text-on-primary";
  const classes = inverse
    ? { shell: `bg-on-primary/10 ${inverseText}`, icon: inverseText }
    : toneClasses(tone);
  const iconName = tone === "success" ? "verified_user" : tone === "default" ? "info" : "warning";

  return (
    <div className={cx("flex min-w-0 items-start gap-2.5 rounded-2xl p-3", classes.shell)}>
      <AppIcon
        name={iconName}
        className={cx("mt-0.5 icon-sm shrink-0", classes.icon)}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-xs leading-4 font-bold">{title}</p>
        <div className="mt-1 text-meta">{children}</div>
      </div>
    </div>
  );
}

export function ValuePreviewStrip({
  items,
  lastItemFullWidth = false,
}: {
  readonly items: ReadonlyArray<{
    readonly label: string;
    readonly value?: string;
    readonly amount?: number;
    readonly tone?: FormRiskTone;
  }>;
  readonly lastItemFullWidth?: boolean;
}): React.JSX.Element {
  return (
    <div className={cx("grid gap-3", items.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
      {items.map((item, index) => {
        const classes = toneClasses(item.tone ?? "default");
        const isFullWidthLastItem =
          lastItemFullWidth && index === items.length - 1 && items.length % 2 === 1;
        return (
          <div
            key={item.label}
            className={cx(
              "min-w-0 rounded-2xl p-3 ring-1",
              isFullWidthLastItem && "col-span-2",
              classes.shell,
            )}
          >
            <p className="truncate text-[9px] leading-5 font-bold tracking-wide uppercase">
              {item.label}
            </p>
            {typeof item.amount === "number" ? (
              <MoneyValue
                amount={item.amount}
                variant="fullDynamic"
                size="lg"
                tone={
                  item.tone === "danger"
                    ? "danger"
                    : item.tone === "warning"
                      ? "warning"
                      : item.tone === "success"
                        ? "primary"
                        : "default"
                }
                className="mt-1"
              />
            ) : (
              <p className="min-w-0 text-xs leading-4 font-bold wrap-break-word">
                {item.value ?? "-"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
