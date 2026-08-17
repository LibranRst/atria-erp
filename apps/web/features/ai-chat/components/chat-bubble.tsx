import * as React from "react";

/**
 * Gelembung teks percakapan.
 *
 * Hanya teks yang masuk gelembung. Kartu data sengaja pecah keluar menjadi lebar
 * penuh: menumpuk padding gelembung di atas padding kartu akan menyempitkan
 * kolom angka sampai nilai uang utama terpaksa wrap di layar 320px, dan itu
 * dilarang oleh aturan tabular money di DESIGN.md.
 */

type ChatBubbleProps = {
  readonly side: "user" | "assistant";
  readonly children: React.ReactNode;
};

export function ChatBubble({ side, children }: ChatBubbleProps): React.JSX.Element {
  if (side === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-surface-inverse px-4.5 py-2.5 text-row font-semibold text-on-surface-inverse shadow-inverse">
          {children}
        </div>
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
