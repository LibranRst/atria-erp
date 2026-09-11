"use client";

import React from "react";

import { AppIcon } from "../icon/app-icon";
import { DialogFrame } from "./dialog-frame";

export function MediaPreviewDialog({
  open,
  title,
  imageUrl,
  alt,
  caption,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly alt: string;
  readonly caption?: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  return (
    <DialogFrame open={open && Boolean(imageUrl)} title={title} onClose={onClose}>
      {imageUrl ? (
        <MediaPreviewContent key={imageUrl} imageUrl={imageUrl} alt={alt} caption={caption} />
      ) : null}
    </DialogFrame>
  );
}

function MediaPreviewContent({
  imageUrl,
  alt,
  caption,
}: {
  readonly imageUrl: string;
  readonly alt: string;
  readonly caption?: string;
}): React.JSX.Element {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  return (
    <div className="space-y-3">
      <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-inset bg-primary p-2">
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
          <p className="px-5 text-center text-support font-semibold text-white" role="alert">
            Pratinjau tidak dapat dimuat. Tutup lalu coba buka kembali.
          </p>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={`max-h-[62dvh] w-auto max-w-full rounded-2xl object-contain ${
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
