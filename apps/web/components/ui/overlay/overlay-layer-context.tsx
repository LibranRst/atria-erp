"use client";

import React from "react";

export const ANCHORED_SURFACE_LAYER = 120;
export const TOOLTIP_LAYER = 130;

type OverlayLayers = {
  readonly anchored: number;
  readonly tooltip: number;
};

const OverlayLayerContext = React.createContext<OverlayLayers>({
  anchored: ANCHORED_SURFACE_LAYER,
  tooltip: TOOLTIP_LAYER,
});

export function OverlayLayerProvider({
  anchored,
  children,
}: {
  readonly anchored: number;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <OverlayLayerContext.Provider value={{ anchored, tooltip: anchored + 1 }}>
      {children}
    </OverlayLayerContext.Provider>
  );
}

export function useOverlayLayers(): OverlayLayers {
  return React.useContext(OverlayLayerContext);
}
