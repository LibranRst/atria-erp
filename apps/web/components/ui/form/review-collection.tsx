"use client";
import * as React from "react";
import { GroupedSurface } from "../feedback/main-surface";
import { Button } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { ContentReveal } from "../overlay/content-reveal";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

/** Review is a collection of decisions/items, not a sortable data grid. */
export function ReviewCollection({
  ariaLabel,
  children,
  footer,
  embedded = false,
}: {
  readonly ariaLabel: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly embedded?: boolean;
}): React.JSX.Element {
  const content = (
    <>
      <ul aria-label={ariaLabel} className="min-w-0 list-none divide-y divide-outline-variant/20">
        {children}
      </ul>
      {footer ? <div className="border-t border-outline-variant/20">{footer}</div> : null}
    </>
  );
  return embedded ? content : <GroupedSurface>{content}</GroupedSurface>;
}
export function ReviewItem({
  title,
  meta,
  selection,
  primaryValue,
  summary,
  children,
  editor,
  expanded = false,
  onToggle,
  editable = false,
  disabled = false,
}: {
  readonly title: React.ReactNode;
  readonly meta?: React.ReactNode;
  readonly selection?: React.ReactNode;
  readonly primaryValue?: React.ReactNode;
  readonly summary?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly editor?: React.ReactNode;
  readonly expanded?: boolean;
  readonly onToggle?: () => void;
  readonly editable?: boolean;
  readonly disabled?: boolean;
}): React.JSX.Element {
  const titleId = React.useId(),
    editorId = React.useId();
  const desktop = useWorkspacePresentation() === "desktop";
  const detailContent = React.Children.toArray(children);
  return (
    <li
      aria-labelledby={titleId}
      data-review-item="true"
      data-review-presentation={desktop ? "desktop" : "mobile"}
      className={desktop ? "min-w-0 px-5 py-4" : "min-w-0 px-4 py-3"}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div id={titleId} className="text-row font-semibold wrap-anywhere">
            {title}
          </div>
          {meta ? (
            <div className="text-meta wrap-anywhere text-on-surface-variant">{meta}</div>
          ) : null}
        </div>
        {desktop && primaryValue ? (
          <div className="max-w-[45%] min-w-0 shrink-0 text-right">{primaryValue}</div>
        ) : null}
      </div>
      {summary || (!desktop && primaryValue) ? (
        <div className={desktop ? "mt-2" : "mt-2 flex min-w-0 items-start justify-between gap-3"}>
          {summary ? (
            <div className="min-w-0 flex-1 text-support text-on-surface-variant">{summary}</div>
          ) : null}
          {!desktop && primaryValue ? (
            <div className="ml-auto min-w-0 shrink-0 text-right">{primaryValue}</div>
          ) : null}
        </div>
      ) : null}
      {detailContent.length ? <div className="mt-3 min-w-0">{detailContent}</div> : null}
      {selection || onToggle ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-review-actions="true">
          {selection}
          {onToggle && (
            <div data-review-disclosure="true">
              <Button
                variant="quiet"
                size="compact"
                disabled={disabled}
                aria-expanded={expanded}
                aria-controls={editor ? editorId : undefined}
                onClick={onToggle}
              >
                {editable && <AppIcon name="edit" className="icon-sm" />}
                {expanded ? "Ringkas" : editable ? "Edit" : "Rincian"}
                {!editable && (
                  <AppIcon name={expanded ? "expand_less" : "expand_more"} className="icon-sm" />
                )}
              </Button>
            </div>
          )}
        </div>
      ) : null}
      {editor ? (
        <ContentReveal id={editorId} expanded={expanded} keepMounted className="pt-4">
          <div className="review-item-editor border-t border-outline-variant/20">{editor}</div>
        </ContentReveal>
      ) : null}
    </li>
  );
}
