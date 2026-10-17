/** A failed source must not become an empty collection or an authorization verdict. */
export type SettingsReadSource =
  | { readonly status: "ready" | "not-requested" }
  | {
      readonly status: "restricted" | "unavailable" | "unauthorized";
      readonly message: string;
    };

export type SettingsReadSources = {
  readonly administration: SettingsReadSource;
  readonly setup: SettingsReadSource;
  readonly initialStock: SettingsReadSource;
  readonly openingBatches: SettingsReadSource;
  readonly approvalThresholds: SettingsReadSource;
};
