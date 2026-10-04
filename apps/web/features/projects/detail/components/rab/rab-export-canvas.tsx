"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui";

interface RabExportCanvasProps {
  readonly children: React.ReactNode;
  readonly documentWidth?: number;
}

export function RabExportCanvas({
  children,
  documentWidth = 794,
}: RabExportCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fitScaleRef = useRef<number>(0.35);
  const hasInitializedRef = useRef<boolean>(false);

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
    const containerHeight = containerRef.current.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return 0.35;

    const horizontalPadding = containerWidth < 480 ? 16 : 32;
    const verticalPadding = 76;

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
      fitScaleRef.current = fitW;
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
        setScale((prev) =>
          Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.15), 2.5),
        );
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
        touchDistanceRef.current = Math.hypot(
          t1.clientX - t2.clientX,
          t1.clientY - t2.clientY,
        );
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
        setScale((prev) =>
          Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.15), 2.5),
        );
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
      data-export-canvas-container="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full overflow-hidden rounded-2xl bg-neutral-200/50 select-none touch-none ring-1 ring-ring-subtle ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        minHeight: "440px",
        height: "64vh",
        maxHeight: "760px",
      }}
    >
      {/* Floating Zoom & Fit Toolbar (iOS Pill Style) */}
      <div
        data-toolbar="true"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full bg-white/90 p-1.5 backdrop-blur-md shadow-floating ring-1 ring-ring-subtle"
      >
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Perkecil pratinjau"
          title="Perkecil (-)"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-[1.05] active:shadow-raised active:z-10 transition duration-150"
        >
          <AppIcon name="remove" className="text-xs" />
        </button>

        <button
          type="button"
          onClick={handleFitWidth}
          title="Sesuaikan lebar dokumen ke layar"
          className="flex h-8 items-center justify-center rounded-full px-2.5 text-[11px] font-bold text-on-surface hover:bg-surface-container active:scale-[1.05] active:shadow-raised active:z-10 transition duration-150"
        >
          Fit Lebar
        </button>

        <button
          type="button"
          onClick={handleFitPage}
          title="Lihat 1 halaman utuh"
          className="flex h-8 items-center justify-center rounded-full px-2.5 text-[11px] font-bold text-on-surface hover:bg-surface-container active:scale-[1.05] active:shadow-raised active:z-10 transition duration-150"
        >
          Fit Halaman
        </button>

        <span className="min-w-9 px-1 text-center font-mono text-[11px] font-bold text-on-surface-variant">
          {Math.round(scale * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Perbesar pratinjau"
          title="Perbesar (+)"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-[1.05] active:shadow-raised active:z-10 transition duration-150"
        >
          <AppIcon name="add" className="text-xs" />
        </button>
      </div>

      {/* Canvas Viewport Stage */}
      <div
        data-export-canvas-stage="true"
        className="flex h-full w-full items-start justify-center overflow-visible pt-3"
      >
        <div
          data-export-canvas-wrapper="true"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "top center",
            transition: isDragging ? "none" : "transform 0.12s ease-out",
            willChange: "transform",
          }}
          className="origin-top"
        >
          <div
            ref={contentRef}
            className="rounded-xl shadow-lg ring-1 ring-neutral-300"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
