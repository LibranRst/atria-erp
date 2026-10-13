"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon, Button, IconButton } from "@/components/ui";

import { motion, useReducedMotion } from "framer-motion";
import { transitionSpringSnappy } from "@/lib/utils/motion";

interface RabExportCanvasProps {
  readonly children: React.ReactNode;
  readonly documentWidth?: number;
}

export function RabExportCanvas({
  children,
  documentWidth = 794,
}: RabExportCanvasProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fitScaleRef = useRef<number>(0.35);
  const hasInitializedRef = useRef<boolean>(false);
  const lastWidthRef = useRef(0);

  const [scale, setScale] = useState<number>(0.35);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);

  // Compute Fit-to-Width scale (especially on mobile 320-480px, document fills container width cleanly)
  const computeFitWidthScale = useCallback((): number => {
    if (!containerRef.current) return 0.45;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return 0.45;
    const horizontalPadding = containerWidth < 480 ? 16 : 32;
    const availableWidth = Math.max(containerWidth - horizontalPadding, 80);
    const fitW = availableWidth / documentWidth;
    return Math.min(Math.max(Number(fitW.toFixed(3)), 0.15), 1.5);
  }, [documentWidth]);

  // Compute Fit-to-Page scale (full document width AND height visible)
  const computeFitPageScale = useCallback((): number => {
    if (!containerRef.current) return 0.35;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight =
      containerRef.current.querySelector("[data-export-canvas-stage]")?.clientHeight ||
      containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return 0.35;

    const horizontalPadding = containerWidth < 480 ? 16 : 32;
    const verticalPadding = 24;

    const availableWidth = Math.max(containerWidth - horizontalPadding, 80);
    const availableHeight = Math.max(containerHeight - verticalPadding, 80);

    const docHeight = contentRef.current?.offsetHeight || 1123;
    const fitW = availableWidth / documentWidth;
    const fitH = availableHeight / docHeight;
    const fit = Math.min(fitW, fitH);

    return Math.min(Math.max(Number(fit.toFixed(3)), 0.15), 1.5);
  }, [documentWidth]);

  // Handle container resize & initial auto-fit
  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const handleResize = (): void => {
      const fitW = computeFitWidthScale();
      const oldFit = fitScaleRef.current;
      fitScaleRef.current = fitW;
      const widthChanged = Math.abs(containerEl.clientWidth - lastWidthRef.current) > 0.5;
      lastWidthRef.current = containerEl.clientWidth;
      if (widthChanged && hasInitializedRef.current) {
        setScale(fitW);
        setPan((prev) => ({ x: 0, y: (prev.y * fitW) / oldFit }));
      }
      if (
        !hasInitializedRef.current &&
        containerEl.clientWidth > 100 &&
        containerEl.clientHeight > 100
      ) {
        hasInitializedRef.current = true;
        // Default on mobile is fit-to-width so text & figures are readable immediately
        setScale(fitW);
        setPan({ x: 0, y: 0 });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerEl);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [computeFitWidthScale]);

  // Attach non-passive wheel event listener to support Ctrl/Cmd zoom without browser errors
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = -e.deltaY * 0.003;
        setScale((prev) => Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.15), 2.5));
      } else {
        setPan((prev) => ({
          x: prev.x - e.deltaX * 0.8,
          y: prev.y - e.deltaY * 0.8,
        }));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Zoom control actions
  const handleZoomIn = (): void => {
    setScale((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 2.5));
  };

  const handleZoomOut = (): void => {
    setScale((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.15));
  };
  const handleFitWidth = (): void => {
    const fitW = computeFitWidthScale();
    fitScaleRef.current = fitW;
    setScale(fitW);
    setPan({ x: 0, y: 0 });
  };

  const handleFitPage = (): void => {
    const fitPage = computeFitPageScale();
    fitScaleRef.current = fitPage;
    setScale(fitPage);
    setPan({ x: 0, y: 0 });
  };
  // Double click / tap to toggle between fit and 100%
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest("[data-toolbar]")) return;
    const fitW = computeFitWidthScale();
    if (Math.abs(scale - fitW) < 0.08) {
      setScale(1.0);
      setPan({ x: 0, y: 0 });
    } else {
      setScale(fitW);
      setPan({ x: 0, y: 0 });
    }
  };

  // Universal Pointer Drag Handlers (smooth mouse + touch dragging with pointer capture)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest("[data-toolbar]")) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  // Multi-touch Pinch-to-Zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        setIsDragging(false);
        touchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      if (t1 && t2) {
        const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = newDist / touchDistanceRef.current;
        setScale((prev) => Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.15), 2.5));
        touchDistanceRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length < 2) {
      touchDistanceRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      role="region"
      tabIndex={0}
      aria-label="Pratinjau RAB · panah untuk geser, Page Down atau End untuk bagian bawah"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
        const step = 64,
          page = containerRef.current?.clientHeight || 440;
        const end = Math.min(0, page - 24 - (contentRef.current?.offsetHeight || 0) * scale);
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "PageUp",
            "PageDown",
            "Home",
            "End",
          ].includes(e.key)
        ) {
          e.preventDefault();
          setPan((prev) => ({
            x:
              e.key === "ArrowLeft"
                ? prev.x + step
                : e.key === "ArrowRight"
                  ? prev.x - step
                  : e.key === "Home"
                    ? 0
                    : prev.x,
            y:
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? end
                  : Math.max(
                      end,
                      Math.min(
                        0,
                        prev.y +
                          (e.key === "ArrowUp"
                            ? step
                            : e.key === "ArrowDown"
                              ? -step
                              : e.key === "PageUp"
                                ? page - 24
                                : e.key === "PageDown"
                                  ? -(page - 24)
                                  : 0),
                      ),
                    ),
          }));
        }
      }}
      data-export-canvas-container="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      className={`relative flex w-full touch-none flex-col overflow-hidden rounded-2xl bg-surface-container ring-1 ring-ring-subtle outline-none select-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        minHeight: "440px",
        height: "64vh",
        maxHeight: "760px",
      }}
    >
      <div
        data-toolbar="true"
        className="relative z-20 m-2 flex w-max max-w-[calc(100%-16px)] shrink-0 flex-wrap items-center justify-center gap-2 self-center rounded-2xl bg-surface-container-lowest p-1.5 shadow-floating"
      >
        <div className="flex items-center gap-1">
          <IconButton
            label="Perkecil pratinjau"
            icon={<AppIcon name="remove" />}
            variant="quiet"
            size="compact"
            onClick={handleZoomOut}
          />
          <span className="min-w-9 text-center text-support font-semibold tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <IconButton
            label="Perbesar pratinjau"
            icon={<AppIcon name="add" />}
            variant="quiet"
            size="compact"
            onClick={handleZoomIn}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="compact" onClick={handleFitWidth}>
            Fit Lebar
          </Button>
          <Button variant="secondary" size="compact" onClick={handleFitPage}>
            Fit Halaman
          </Button>
        </div>
      </div>

      {/* Canvas Viewport Stage */}
      <div
        data-export-canvas-stage="true"
        className="flex min-h-0 w-full flex-1 items-start justify-center overflow-hidden pt-3"
      >
        <motion.div
          data-export-canvas-wrapper="true"
          animate={{ x: pan.x, y: pan.y, scale }}
          transition={isDragging || reduceMotion ? { duration: 0 } : transitionSpringSnappy}
          style={{ transformOrigin: "top center", willChange: "transform" }}
          className="origin-top"
        >
          <div ref={contentRef} className="rounded-xl shadow-surface">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
