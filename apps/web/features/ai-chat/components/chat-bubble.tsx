import { AppIcon } from "@/components/ui";
import * as React from "react";

/**
 * Gelembung teks percakapan.
 *
 * Hanya teks dan lampiran berkas yang masuk gelembung. Kartu data sengaja
 * pecah keluar menjadi lebar penuh: menumpuk padding gelembung di atas padding
 * kartu akan menyempitkan kolom angka sampai nilai uang utama terpaksa wrap di
 * layar 320px, dan itu dilarang oleh aturan tabular money di DESIGN.md.
 */

export type BubbleAttachment = {
  readonly url?: string;
  readonly data?: string;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly mediaType?: string;
  readonly size?: number;
};

type ChatBubbleProps = {
  readonly side: "user" | "assistant";
  readonly children: React.ReactNode;
  readonly attachments?: readonly unknown[];
};

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatBubble({ side, children, attachments = [] }: ChatBubbleProps): React.JSX.Element {
  const normalizedAttachments = React.useMemo(() => {
    return attachments.map((item) => {
      const att = item as BubbleAttachment;
      return {
        url: att.url || att.data || "",
        fileName: att.fileName || "Berkas lampiran",
        mimeType: att.mimeType || att.mediaType || "application/octet-stream",
        size: att.size,
      };
    });
  }, [attachments]);

  if (side === "user") {
    const hasAttachments = normalizedAttachments.length > 0;
    const hasText = Boolean(children);

    const imageAttachments = normalizedAttachments.filter((att) =>
      att.mimeType.startsWith("image/"),
    );
    const fileAttachments = normalizedAttachments.filter(
      (att) => !att.mimeType.startsWith("image/"),
    );

    const imageCount = imageAttachments.length;
    const imageGridCols =
      imageCount === 1
        ? "grid-cols-1"
        : imageCount === 2
          ? "grid-cols-2"
          : imageCount === 3
            ? "grid-cols-3"
            : "grid-cols-2";

    return (
      <div className="flex flex-col items-end gap-1.5">
        {hasAttachments ? (
          <div className="flex max-w-[85%] flex-col items-end gap-1.5">
            {/* Dokumen / file non-gambar */}
            {fileAttachments.length > 0 ? (
              <div className="flex w-full flex-col items-end gap-1">
                {fileAttachments.map((att, idx) => (
                  <a
                    key={`file-${idx}`}
                    href={att.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2 text-on-surface shadow-control ring-1 ring-ring-control transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                      <AppIcon name="description" className="icon-xs" />
                    </div>
                    <div className="max-w-40 min-w-0">
                      <p className="truncate text-meta font-semibold">{att.fileName}</p>
                      {att.size ? (
                        <p className="text-support text-on-surface-variant">
                          {formatSize(att.size)}
                        </p>
                      ) : null}
                    </div>
                    <AppIcon
                      name="open_in_new"
                      className="icon-xs shrink-0 text-on-surface-variant"
                    />
                  </a>
                ))}
              </div>
            ) : null}

            {/* Grid foto kompak */}
            {imageCount > 0 ? (
              <div
                className={`grid ${imageGridCols} gap-1.5 ${
                  imageCount === 1 ? "max-w-[180px]" : "max-w-[240px]"
                }`}
              >
                {imageAttachments.map((att, idx) => (
                  <a
                    key={`img-${idx}`}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group relative block overflow-hidden rounded-2xl bg-surface-container shadow-control ring-1 ring-ring-control transition-all hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      imageCount === 1 ? "h-36 w-full" : "h-24 w-full"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.fileName}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasText ? (
          <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-surface-inverse px-4.5 py-2.5 text-row font-semibold text-on-surface-inverse shadow-inverse">
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[94%] rounded-[22px] rounded-tl-md bg-white px-4.5 py-3 shadow-surface ring-1 ring-ring-subtle">
        {children}
      </div>
    </div>
  );
}
