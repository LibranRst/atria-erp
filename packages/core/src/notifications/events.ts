import type { NotificationReferenceType, NotificationSeverity } from "./types";
import type { PermissionKey } from "../auth/permissions";
export type NotificationEvent = {
  referenceType: NotificationReferenceType;
  referenceId: string;
  projectId?: string;
  stage: string;
  rule?: string;
  title: string;
  message: string;
  permission?: PermissionKey;
  recipients?: readonly string[];
  actionRequired?: boolean;
  severity?: NotificationSeverity;
  actionUrl: string;
  actorId?: string;
};
export function dueStage(
  dueDate: Date,
  outstanding: number,
  now: Date = new Date(),
): "UPCOMING" | "DUE" | "OVERDUE" | null {
  if (outstanding <= 0) return null;
  const day = (value: Date): number => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000;
  };
  const remaining = day(dueDate) - day(now);
  return remaining < 0 ? "OVERDUE" : remaining === 0 ? "DUE" : remaining <= 3 ? "UPCOMING" : null;
}
