"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";
import type { RapOverviewFilter, RapSetupStage, RapView } from "../types/rap-rab-types";
import { getInitialRapStage } from "../utils/rap-manager-utils";
import { RAP_SETUP_STAGES } from "../utils/rap-setup-utils";

interface NavigationState {
  readonly context: string | null;
  readonly stage: RapSetupStage;
  readonly view: RapOverviewFilter;
  readonly sourceStage: RapSetupStage;
  readonly locallyChosen: boolean;
}

function unlocked(stage: RapSetupStage, sourceStage: RapSetupStage): boolean {
  return RAP_SETUP_STAGES.indexOf(stage) <= RAP_SETUP_STAGES.indexOf(sourceStage);
}

function stageValue(value: string | null, fallback: RapSetupStage): RapSetupStage {
  return (value === "MATERIAL" || value === "TUKANG" || value === "SUBCON" || value === "REVIEW") &&
    unlocked(value, fallback)
    ? value
    : fallback;
}

function viewValue(value: string | null): RapOverviewFilter {
  return value === "TUKANG" || value === "SUBCON" ? value : "MATERIAL";
}

function initialState(context: string | null, sourceStage: RapSetupStage): NavigationState {
  return { context, stage: sourceStage, view: "MATERIAL", sourceStage, locallyChosen: false };
}

function signature(context: string | null, stage: string | null, view: string | null): string {
  return JSON.stringify([context, stage, view]);
}

/** Desktop URLs restore the matching RAP revision; mobile keeps its incumbent local navigation. */
export function useRapNavigationState(rap: RapView | null): {
  readonly activeRapStage: RapSetupStage;
  readonly setActiveRapStage: (stage: RapSetupStage) => void;
  readonly rapOverviewFilter: RapOverviewFilter;
  readonly setRapOverviewFilter: (view: RapOverviewFilter) => void;
} {
  const desktop = useWorkspacePresentation() === "desktop";
  const context = rap ? `${rap.id}:${rap.revision}` : null;
  const sourceStage = getInitialRapStage(rap);
  const rawContext = useBrowserUrlSearchParam("rap-context");
  const rawStage = useBrowserUrlSearchParam("rap-stage");
  const rawView = useBrowserUrlSearchParam("rap-view");
  const urlSignature = signature(rawContext, rawStage, rawView);
  const [state, setState] = useState<NavigationState>(() => initialState(context, sourceStage));
  const navigation = state.context === context ? state : initialState(context, sourceStage);
  const observed = useRef<{
    context: string | null;
    signature: string | null;
    pendingSignature: string | null;
    restored: boolean;
  }>({ context: null, signature: null, pendingSignature: null, restored: false });

  useLayoutEffect((): void => {
    const previous = observed.current;
    if (previous.context !== context) {
      previous.context = context;
      previous.signature = null;
      previous.pendingSignature = null;
      previous.restored = false;
    }
    const ownUrlChange = previous.pendingSignature === urlSignature;
    if (ownUrlChange) previous.pendingSignature = null;
    const urlChanged = previous.signature !== urlSignature;
    const firstDesktop = desktop && !previous.restored;
    previous.signature = urlSignature;
    if (desktop) previous.restored = true;

    setState((current): NavigationState => {
      const scoped = current.context === context ? current : initialState(context, sourceStage);
      const restore = firstDesktop && !scoped.locallyChosen;
      const readUrl = desktop && !ownUrlChange && (restore || urlChanged);
      const matches = Boolean(context && rawContext === context);
      const stage = readUrl
        ? stageValue(matches ? rawStage : null, sourceStage)
        : scoped.sourceStage !== sourceStage && !unlocked(scoped.stage, sourceStage)
          ? sourceStage
          : scoped.stage;
      const view = readUrl ? viewValue(matches ? rawView : null) : scoped.view;
      if (
        current.context === context &&
        current.sourceStage === sourceStage &&
        current.stage === stage &&
        current.view === view
      )
        return current;
      return { ...scoped, context, sourceStage, stage, view };
    });
  }, [context, desktop, rawContext, rawStage, rawView, sourceStage, urlSignature]);

  function choose(stage: RapSetupStage, view: RapOverviewFilter): void {
    setState({ context, sourceStage, stage, view, locallyChosen: true });
    if (!desktop || !context) return;
    const url = new URL(window.location.href);
    url.searchParams.set("rap-context", context);
    url.searchParams.set("rap-stage", stage);
    url.searchParams.set("rap-view", view);
    // The successful advance writer uses this setter before refreshed props arrive.
    // Its acknowledged URL must not be clamped against that earlier source stage.
    observed.current.pendingSignature = signature(context, stage, view);
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  }

  return {
    activeRapStage: navigation.stage,
    setActiveRapStage: (stage): void => choose(stage, navigation.view),
    rapOverviewFilter: navigation.view,
    setRapOverviewFilter: (view): void => choose(navigation.stage, view),
  };
}
