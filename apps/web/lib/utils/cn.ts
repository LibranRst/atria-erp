import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-eyebrow",
        "text-meta",
        "text-support",
        "text-row",
        "text-section",
        "text-title",
        "text-focal",
      ],
      rounded: ["rounded-owner", "rounded-inset", "rounded-icon"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs));
}
