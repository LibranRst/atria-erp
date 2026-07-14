export type SelectOption = {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly meta?: string;
  readonly group?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
};

export const COMMON_UNIT_OPTIONS = [
  "ls",
  "unit",
  "pcs",
  "set",
  "m",
  "m2",
  "m3",
  "lembar",
  "batang",
  "box",
  "roll",
  "kg",
  "liter",
  "hari",
  "paket",
] as const;

export const COMMON_ROOM_OPTIONS = [
  "Kitchen",
  "Living Room",
  "Bedroom",
  "Bathroom",
  "Wardrobe",
  "Pantry",
  "Dining",
  "Foyer",
  "Umum",
] as const;
