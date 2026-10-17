"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import { Button } from "../button/button";
import { AppIcon } from "../icon/app-icon";
import { DialogFrame } from "./dialog-frame";

export function MediaPreviewDialog({
  open,
  title,
  imageUrl,
  alt,
  caption,
  purpose = "image",
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly alt: string;
  readonly caption?: string;
  readonly purpose?: "image" | "document";
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <DialogFrame
      open={open && Boolean(imageUrl)}
      title={title}
      presentation={purpose === "document" ? "document" : "default"}
      onClose={onClose}
    >
      {imageUrl ? (
        <MediaPreviewContent
          key={imageUrl}
          imageUrl={imageUrl}
          alt={alt}
          caption={caption}
          purpose={purpose}
        />
      ) : null}
    </DialogFrame>
  );
}

function MediaPreviewContent({
  imageUrl,
  alt,
  caption,
  purpose,
}: {
  readonly imageUrl: string;
  readonly alt: string;
  readonly caption?: string;
  readonly purpose: "image" | "document";
}): React.JSX.Element {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [enlarged, setEnlarged] = React.useState(false);
  const [fitWidth, setFitWidth] = React.useState<number | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const desktopDocument = useWorkspacePresentation() === "desktop" && purpose === "document";

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!desktopDocument || status !== "ready" || !stage || !image) return;
    const measure = (): void => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0 || stage.clientWidth <= 16) return;
      setFitWidth(
        Math.min(
          stage.clientWidth - 16,
          ((stage.clientHeight - 16) * image.naturalWidth) / image.naturalHeight,
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [desktopDocument, status]);

  const toggleEnlarged = (): void => {
    setEnlarged((value) => !value);
    if (stageRef.current) {
      stageRef.current.scrollTop = 0;
      stageRef.current.scrollLeft = 0;
    }
  };

  return (
    <div className="space-y-3">
      {desktopDocument ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-support text-on-surface-variant">
            {enlarged
              ? "Gulir untuk membaca seluruh dokumen."
              : "Dokumen disesuaikan dengan layar."}
          </p>
          <Button
            variant="secondary"
            size="compact"
            disabled={status !== "ready"}
            aria-pressed={enlarged}
            onClick={toggleEnlarged}
          >
            {enlarged ? "Sesuaikan" : "Perbesar"}
          </Button>
        </div>
      ) : null}
      <div
        ref={stageRef}
        role={desktopDocument ? "region" : undefined}
        aria-label={desktopDocument ? `Area dokumen ${alt}` : undefined}
        tabIndex={desktopDocument ? 0 : undefined}
        className={`relative min-h-48 rounded-inset bg-primary p-2 focus-visible:ring-2 focus-visible:ring-focus-ring-strong focus-visible:outline-none ${desktopDocument ? "h-[62dvh] overflow-auto overscroll-contain" : "flex items-center justify-center overflow-hidden"}`}
      >
        {status === "loading" ? (
          <p
            className="inline-flex items-center gap-2 text-support font-semibold text-white/75"
            role="status"
          >
            <AppIcon name="progress_activity" className="icon-sm animate-spin" />
            Memuat pratinjau…
          </p>
        ) : null}
        {status === "error" ? (
          <div className="space-y-3 px-5 py-8 text-center" role="alert">
            <p className="text-support font-semibold text-white">Pratinjau tidak dapat dimuat.</p>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => {
                setStatus("loading");
                setAttempt((value) => value + 1);
              }}
            >
              Coba lagi
            </Button>
          </div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={attempt}
          ref={imageRef}
          src={imageUrl}
          alt={alt}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          style={
            desktopDocument && fitWidth !== null
              ? { width: fitWidth * (enlarged ? 2 : 1), height: "auto" }
              : undefined
          }
          className={`${desktopDocument ? (enlarged ? "h-auto w-[200%] max-w-none" : "mx-auto h-full w-auto max-w-full object-contain") : "max-h-[62dvh] w-auto max-w-full rounded-2xl object-contain"} ${
            status === "ready" ? "block" : "invisible absolute"
          }`}
        />
      </div>
      {caption ? (
        <p className="px-1 text-center text-meta text-on-surface-variant">{caption}</p>
      ) : null}
    </div>
  );
}
