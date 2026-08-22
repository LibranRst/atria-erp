"use client";

import { AppIcon } from "@/components/ui";
import * as React from "react";

/**
 * Renderer teks kaya & Markdown yang mulus, responsif, dan kaya format.
 *
 * Mendukung:
 * 1. Tabel Markdown (| Kolom 1 | Kolom 2 |) dengan container scroll horizontal ramah mobile.
 * 2. Blok Callout/Alert (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]).
 * 3. Header hierarkis (#, ##, ###, ####).
 * 4. Daftar poin (- / *) dan daftar bernomor (1. 2.).
 * 5. Blok kode (```...```) dan inline code (`...`).
 * 6. Pemformatan teks tebal (**...**), miring (*...*), dan garis pemisah (---).
 */

type ChatMarkdownProps = {
  readonly content: string;
  readonly className?: string;
};

export function ChatMarkdown({ content, className = "" }: ChatMarkdownProps): React.JSX.Element {
  const elements = React.useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={`space-y-2.5 text-row leading-relaxed text-on-surface ${className}`}>
      {elements}
    </div>
  );
}

function parseMarkdown(text: string): React.JSX.Element[] {
  if (!text) return [];

  const lines = text.split("\n");
  const result: React.JSX.Element[] = [];
  let keyIndex = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Baris Kosong
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Garis Pemisah (--- atau ***)
    if (/^(\-{3,}|\*{3,})$/.test(trimmed)) {
      result.push(<hr key={`hr-${keyIndex++}`} className="my-3 border-t border-black/8" />);
      i++;
      continue;
    }

    // 3. Blok Kode Berpagar (```lang ... ```)
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // Lewati penutup ```

      result.push(
        <div
          key={`code-block-${keyIndex++}`}
          className="my-2.5 overflow-hidden rounded-xl bg-surface-container-high/90 p-3 font-mono text-support ring-1 ring-ring-subtle"
        >
          {language && (
            <div className="mb-1.5 text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
              {language}
            </div>
          )}
          <pre className="overflow-x-auto whitespace-pre text-on-surface">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    // 4. Tabel Markdown (| Kolom 1 | Kolom 2 |)
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const headerLine = trimmed;
      const separatorLine = lines[i + 1].trim();
      i += 2;

      const bodyLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        bodyLines.push(lines[i].trim());
        i++;
      }

      const headers = parseTableCells(headerLine);
      const alignments = parseTableAlignments(separatorLine);
      const rows = bodyLines.map((row) => parseTableCells(row));

      result.push(
        <div
          key={`table-${keyIndex++}`}
          className="my-3 overflow-x-auto rounded-2xl bg-white shadow-surface ring-1 ring-ring-subtle"
        >
          <table className="w-full min-w-full border-collapse text-left text-support">
            <thead>
              <tr className="border-b border-black/8 bg-surface-container-low/70">
                {headers.map((th, thIdx) => (
                  <th
                    key={thIdx}
                    className={`px-3.5 py-2.5 text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase ${
                      alignments[thIdx] === "right"
                        ? "text-right"
                        : alignments[thIdx] === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {renderInlineMarkdown(th)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((rowCells, rowIdx) => (
                <tr key={rowIdx} className="transition-colors hover:bg-surface-container-lowest/60">
                  {rowCells.map((td, tdIdx) => (
                    <td
                      key={tdIdx}
                      className={`px-3.5 py-2.5 font-semibold text-on-surface ${
                        alignments[tdIdx] === "right"
                          ? "text-right tabular-nums"
                          : alignments[tdIdx] === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {renderInlineMarkdown(td)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 5. Callout / Alert Box (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT])
    const calloutMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i);
    if (calloutMatch) {
      const type = calloutMatch[1].toUpperCase();
      const firstLine = calloutMatch[2];
      const calloutLines: string[] = firstLine ? [firstLine] : [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        calloutLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }

      const isWarning = type === "WARNING" || type === "CAUTION";
      const isTip = type === "TIP";
      const isImportant = type === "IMPORTANT";

      const toneClass = isWarning
        ? "border-critical bg-critical-container text-critical"
        : isTip
          ? "border-primary bg-primary/8 text-primary"
          : isImportant
            ? "border-warning-on-container bg-warning-container text-warning-on-container"
            : "border-on-surface-variant/40 bg-surface-container-low text-on-surface";

      const iconName = isWarning
        ? "warning"
        : isTip
          ? "lightbulb"
          : isImportant
            ? "priority_high"
            : "info";

      result.push(
        <div
          key={`callout-${keyIndex++}`}
          className={`my-2.5 flex items-start gap-2.5 rounded-2xl border-l-4 p-3 text-support font-semibold shadow-control ${toneClass}`}
        >
          <AppIcon name={iconName} className="mt-0.5 icon-sm shrink-0" />
          <div className="space-y-1 text-on-surface">
            {calloutLines.map((cLine, cIdx) => (
              <p key={cIdx}>{renderInlineMarkdown(cLine)}</p>
            ))}
          </div>
        </div>,
      );
      continue;
    }

    // 6. Blockquote Biasa (> kutipan)
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [trimmed.slice(2)];
      i++;
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }

      result.push(
        <blockquote
          key={`quote-${keyIndex++}`}
          className="my-2 rounded-r-xl border-l-2 border-primary/50 bg-surface-container-low/60 px-3.5 py-2 text-support font-semibold text-on-surface-variant italic"
        >
          {quoteLines.map((q, qIdx) => (
            <p key={qIdx}>{renderInlineMarkdown(q)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // 7. Daftar Poin / Unordered List (- atau *)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      const items: string[] = [ulMatch[2]];
      i++;
      while (i < lines.length) {
        const nextUlMatch = lines[i].match(/^(\s*)[-*]\s+(.*)$/);
        if (nextUlMatch) {
          items.push(nextUlMatch[2]);
          i++;
        } else if (lines[i].trim() === "") {
          break;
        } else {
          break;
        }
      }

      result.push(
        <ul
          key={`ul-${keyIndex++}`}
          className="my-1.5 list-disc space-y-1.5 pl-5 text-row marker:text-primary"
        >
          {items.map((item, itIdx) => (
            <li key={itIdx} className="pl-0.5 font-semibold">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // 8. Daftar Bernomor / Ordered List (1. 2. dll.)
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      const items: string[] = [olMatch[2]];
      i++;
      while (i < lines.length) {
        const nextOlMatch = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        if (nextOlMatch) {
          items.push(nextOlMatch[2]);
          i++;
        } else if (lines[i].trim() === "") {
          break;
        } else {
          break;
        }
      }

      result.push(
        <ol
          key={`ol-${keyIndex++}`}
          className="my-1.5 list-decimal space-y-1.5 pl-5 text-row marker:font-bold marker:text-on-surface-variant"
        >
          {items.map((item, itIdx) => (
            <li key={itIdx} className="pl-0.5 font-semibold">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // 9. Headers (#, ##, ###, ####)
    if (trimmed.startsWith("# ")) {
      result.push(
        <h3
          key={`h1-${keyIndex++}`}
          className="mt-3 text-lg font-bold tracking-tight text-on-surface"
        >
          {renderInlineMarkdown(trimmed.slice(2))}
        </h3>,
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      result.push(
        <h4
          key={`h2-${keyIndex++}`}
          className="mt-2.5 text-section font-bold tracking-tight text-on-surface"
        >
          {renderInlineMarkdown(trimmed.slice(3))}
        </h4>,
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      result.push(
        <h4
          key={`h3-${keyIndex++}`}
          className="mt-2 text-section font-bold tracking-[-0.015em] text-on-surface"
        >
          {renderInlineMarkdown(trimmed.slice(4))}
        </h4>,
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      result.push(
        <h5
          key={`h4-${keyIndex++}`}
          className="mt-1.5 text-support font-bold tracking-wider text-on-surface uppercase"
        >
          {renderInlineMarkdown(trimmed.slice(5))}
        </h5>,
      );
      i++;
      continue;
    }

    // 10. Paragraf Standar
    result.push(
      <p key={`p-${keyIndex++}`} className="font-semibold whitespace-pre-wrap">
        {renderInlineMarkdown(line)}
      </p>,
    );
    i++;
  }

  return result;
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.endsWith("|");
}

function isTableSeparator(line: string): boolean {
  if (!isTableRow(line)) return false;
  const parts = line.slice(1, -1).split("|");
  return parts.every((p) => /^[\s\:\-]{3,}$/.test(p.trim()));
}

function parseTableCells(row: string): string[] {
  return row
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function parseTableAlignments(separator: string): ("left" | "center" | "right")[] {
  const parts = parseTableCells(separator);
  return parts.map((p) => {
    const trimmed = p.trim();
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    return "left";
  });
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex memecah inline token: bold (**...**), code (`...`), italic (*...*)
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      return (
        <strong key={index} className="font-bold text-on-surface">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={index}
          className="rounded-md bg-surface-container px-1.5 py-0.5 font-mono text-support font-bold text-primary ring-1 ring-ring-subtle"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      return (
        <em key={index} className="text-on-surface-variant italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}
