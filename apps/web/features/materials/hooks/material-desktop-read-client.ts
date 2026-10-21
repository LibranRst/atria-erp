import { getMaterialDesktopActivity } from "@/app/actions/material/operations-dashboard";
import type {
  MaterialDesktopActivityData,
  MaterialDesktopActivityInput,
} from "@atria/core/material/material-desktop";
import type { ActionResponse } from "@atria/core/types/action-response";

/** Presentation read seam: fixtures replace this module, never the stock writers. */
export function readMaterialDesktopActivity(
  input: MaterialDesktopActivityInput,
): Promise<ActionResponse<MaterialDesktopActivityData>> {
  return getMaterialDesktopActivity(input);
}
