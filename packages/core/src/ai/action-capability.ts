export type AiActionCapability = {
  readonly tool: string;
  readonly label: string;
  readonly mode: "read" | "proposal";
  readonly scope: "any" | "project" | "global";
};
