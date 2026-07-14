"use client";

import Link from "next/link";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import {
  transitionEaseSmooth,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { XIcon } from "lucide-react";

export function formatAiInsightDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "Hari Ini";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Hari Ini";

  return parsedDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
  });
}

export function AiBriefGradientBackdrop({
  visible,
}: {
  readonly visible: boolean;
}): React.JSX.Element {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={transitionEaseSmooth}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#050505_0%,#121212_48%,#f8f8f8_155%)]" />
      <div className="absolute -top-24 left-[-18%] h-56 w-56 rounded-full bg-white/24 blur-3xl" />
      <div className="absolute -bottom-28 right-[-24%] h-64 w-64 rounded-full bg-white/14 blur-[56px]" />
      <div className="absolute top-10 right-8 h-24 w-24 rounded-full bg-deep-teal/25 blur-3xl" />
      <div className="absolute inset-0 bg-black/20" />
    </motion.div>
  );
}

type AiBriefContent = {
  readonly paragraph: string;
  readonly points: readonly string[];
};

const AI_BRIEF_LEGACY_SECTION_TITLES = [
  "Status Hari Ini",
  "Yang Perlu Dicek",
  "Keputusan Owner",
  "Tindakan Owner hari ini",
] as const;

function extractAiBriefSection(
  summary: string,
  title: string,
  nextTitle: string | undefined,
): string {
  const startIndex = summary.indexOf(title);
  if (startIndex === -1) return "";

  const bodyStartIndex = startIndex + title.length;
  const endIndex = nextTitle
    ? summary.indexOf(nextTitle, bodyStartIndex)
    : summary.length;

  return summary
    .slice(bodyStartIndex, endIndex === -1 ? summary.length : endIndex)
    .replace(/^[\s:—-]+/, "")
    .trim();
}

function splitAiBriefPoints(value: string): readonly string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[\s•*-]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);
}

function parseAiBriefContent(summary: string): AiBriefContent {
  const normalizedSummary = summary.trim();
  if (!normalizedSummary) return { paragraph: "", points: [] };

  const modernParagraph = extractAiBriefSection(
    normalizedSummary,
    "Ringkasan",
    "Poin Penting",
  );
  const modernPoints = extractAiBriefSection(
    normalizedSummary,
    "Poin Penting",
    undefined,
  );
  if (modernParagraph.length > 0) {
    return {
      paragraph: modernParagraph,
      points: splitAiBriefPoints(modernPoints),
    };
  }

  const legacySections = AI_BRIEF_LEGACY_SECTION_TITLES.map((title, index) => ({
    title,
    body: extractAiBriefSection(
      normalizedSummary,
      title,
      AI_BRIEF_LEGACY_SECTION_TITLES[index + 1],
    ),
  })).filter((section) => section.body.length > 0);

  if (legacySections.length === 0) {
    return { paragraph: normalizedSummary, points: [] };
  }

  return {
    paragraph: legacySections[0]?.body ?? normalizedSummary,
    points: legacySections
      .flatMap((section) =>
        section.title === "Status Hari Ini"
          ? []
          : splitAiBriefPoints(section.body),
      )
      .slice(0, 4),
  };
}

function AiInsightSummaryContent({
  summary,
  open,
  shouldReduceMotion,
}: {
  readonly summary: string;
  readonly open: boolean;
  readonly shouldReduceMotion: boolean | null;
}): React.JSX.Element {
  const content = parseAiBriefContent(summary);
  const revealInitial = shouldReduceMotion
    ? { opacity: 0, filter: "blur(0px)" }
    : { opacity: 0, y: 6, filter: "blur(7px)" };
  const revealAnimate = shouldReduceMotion
    ? { opacity: open ? 1 : 0, filter: "blur(0px)" }
    : {
        opacity: open ? 1 : 0,
        y: open ? 0 : 4,
        filter: open ? "blur(0px)" : "blur(7px)",
      };

  return (
    <div className="space-y-4">
      <motion.p
        initial={revealInitial}
        animate={revealAnimate}
        transition={
          shouldReduceMotion
            ? transitionEaseSmooth
            : { ...transitionEaseSmooth, delay: open ? 0.18 : 0 }
        }
        className="whitespace-pre-wrap text-[13px] leading-6 tracking-normal text-white/85"
      >
        {content.paragraph || summary}
      </motion.p>

      {content.points.length > 0 && (
        <motion.div
          initial={revealInitial}
          animate={revealAnimate}
          transition={
            shouldReduceMotion
              ? transitionEaseSmooth
              : { ...transitionEaseSmooth, delay: open ? 0.26 : 0 }
          }
          className="rounded-[22px] border border-white/10 bg-white/[0.055] p-4"
        >
          <motion.h3
            initial={revealInitial}
            animate={revealAnimate}
            transition={
              shouldReduceMotion
                ? transitionEaseSmooth
                : { ...transitionEaseSmooth, delay: open ? 0.3 : 0 }
            }
            className="text-[11px] font-bold leading-normal text-white"
          >
            Poin penting
          </motion.h3>
          <ul className="mt-3 space-y-2.5">
            {content.points.map((point, index) => (
              <motion.li
                key={point}
                initial={revealInitial}
                animate={revealAnimate}
                transition={
                  shouldReduceMotion
                    ? transitionEaseSmooth
                    : {
                        ...transitionEaseSmooth,
                        delay: open ? 0.36 + index * 0.06 : 0,
                      }
                }
                className="flex gap-2 text-[12px] leading-5 text-white/78"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                <span>{point}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}

export function AiInsightCard({
  data,
  open,
  setOpen,
}: {
  readonly data: FinanceDashboardOverview;
  readonly open: boolean;
  readonly setOpen: (value: boolean) => void;
}): React.JSX.Element | null {
  const shouldReduceMotion = useReducedMotion();
  const openContentRef = React.useRef<HTMLDivElement>(null);
  const [openContentHeight, setOpenContentHeight] = React.useState<number>(0);

  const aiInsightSummary = data.aiInsight?.summary ?? "";

  React.useLayoutEffect(() => {
    const contentElement = openContentRef.current;
    if (!contentElement) return;

    const updateHeight = () => {
      setOpenContentHeight(
        Math.ceil(contentElement.getBoundingClientRect().height),
      );
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateHeight);
    observer.observe(contentElement);

    return () => observer.disconnect();
  }, [aiInsightSummary]);

  if (!data.aiInsight) return null;

  const aiInsightDate = formatAiInsightDate(data.aiInsight.date);

  const compactWidth = 252;
  const compactHeight = 40;
  const expandedHeight = openContentHeight || compactHeight;

  return (
    <div className="flex justify-start">
      <motion.section
        animate={{
          width: open ? "100%" : compactWidth,
          height: open ? expandedHeight : compactHeight,
          borderRadius: open ? 28 : compactHeight / 2,
          backgroundColor: open ? "#070707" : "#111111",
          borderColor: open ? "rgba(255,255,255,0.1)" : "rgba(17,17,17,0.1)",
        }}
        transition={
          shouldReduceMotion
            ? transitionEaseSmooth
            : {
                default: transitionSpringSmooth,
                borderRadius: transitionEaseSmooth,
                backgroundColor: transitionEaseSmooth,
                borderColor: transitionEaseSmooth,
              }
        }
        aria-label="AI CFO Brief"
        className="relative max-w-full overflow-hidden border text-white shadow-[0_14px_34px_rgba(17,17,17,0.045)]"
      >
        <AiBriefGradientBackdrop visible={open} />
        <motion.button
          type="button"
          aria-label="Buka AI CFO Brief"
          aria-expanded={open}
          tabIndex={open ? -1 : 0}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
          whileTap={{ scale: open ? 1 : 0.97 }}
          animate={
            shouldReduceMotion
              ? { opacity: open ? 0 : 1, filter: "blur(0px)" }
              : {
                  opacity: open ? 0 : 1,
                  scale: open ? 0.985 : 1,
                  filter: open ? "blur(7px)" : "blur(0px)",
                }
          }
          transition={transitionEaseSmooth}
          className={`absolute inset-0 z-20 flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold text-on-primary transition-colors duration-200 hover:bg-neutral-900 ${
            open ? "pointer-events-none" : "pointer-events-auto"
          }`}
        >
          <span className="material-symbols-outlined flex shrink-0 items-center justify-center text-[16px] text-on-primary">
            auto_awesome
          </span>
          <span className="whitespace-nowrap font-bold text-xs text-on-primary">
            Tampilkan Insight Asisten AI
          </span>
        </motion.button>

        <motion.div
          ref={openContentRef}
          aria-hidden={!open}
          animate={
            shouldReduceMotion
              ? { opacity: open ? 1 : 0, filter: "blur(0px)" }
              : {
                  opacity: open ? 1 : 0,
                  y: open ? 0 : 6,
                  scale: open ? 1 : 0.99,
                  filter: open ? "blur(0px)" : "blur(8px)",
                }
          }
          transition={
            shouldReduceMotion
              ? transitionEaseSmooth
              : { ...transitionEaseSmooth, delay: open ? 0.08 : 0 }
          }
          className={`absolute inset-x-0 top-0 z-10 flex w-full flex-col space-y-2 p-5 ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span className="material-symbols-outlined shrink-0 text-[18px]">
                auto_awesome
              </span>
              <div className="flex min-w-0 flex-row items-center gap-2">
                <span className="block text-[12px] font-bold leading-normal tracking-wider text-white">
                  AI Brief
                </span>
                <span className="flex flex-row items-center gap-2 text-[11px] font-semibold text-white/65">
                  <span className="h-1 w-1 rounded-full bg-white" />
                  {aiInsightDate}
                </span>
              </div>
            </div>

            <button
              type="button"
              aria-label="Tutup AI CFO Brief"
              tabIndex={open ? 0 : -1}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/55 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            >
              <XIcon size={16} />
            </button>
          </div>
          <AiInsightSummaryContent
            summary={data.aiInsight.summary}
            open={open}
            shouldReduceMotion={shouldReduceMotion}
          />

          <div className="flex justify-end mt-2">
            <Link
              href="/ledger?brief=true"
              tabIndex={open ? 0 : -1}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-[11px] font-bold text-zinc-950 shadow-[0_12px_28px_rgba(255,255,255,0.14)] transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-teal/60"
              title="Analisis Penuh"
            >
              Full Analysis
            </Link>
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}
