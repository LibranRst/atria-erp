export const DEMO_BASELINE_DATE = "2026-07-22";
export const DEMO_TIME_ZONE = "Asia/Jakarta";
export const DEMO_SEED_ANCHOR_ENV = "ATRIA_DEMO_SEED_DATE";
export const DEMO_FIXTURE_DIRECTORY = ".atria-demo";

export const DEMO_IDS = {
  users: {
    owner: "11111111-1111-1111-1111-111111111111",
    finance: "22222222-2222-2222-2222-222222222222",
    pmBudi: "33333333-3333-3333-3333-333333333331",
    pmSiti: "33333333-3333-3333-3333-333333333332",
    purchasing: "33333333-3333-3333-3333-333333333333",
  },
  bankAccounts: {
    bcaOperational: "66666666-6666-6666-6666-666666666661",
    pettyCashBudi: "66666666-6666-6666-6666-666666666662",
    mandiriMain: "66666666-6666-6666-6666-666666666663",
    pettyCashSiti: "66666666-6666-6666-6666-666666666664",
  },
  projects: {
    menteng: "77777777-7777-7777-7777-777777777771",
    sudirman: "77777777-7777-7777-7777-777777777772",
    brawijaya: "77777777-7777-7777-7777-777777777773",
    kemang: "77777777-7777-7777-7777-777777777774",
    senopati: "77777777-7777-7777-7777-777777777776",
    bsd: "77777777-7777-7777-7777-777777777777",
    pik: "77777777-7777-7777-7777-777777777778",
    pakubuwono: "77777777-7777-7777-7777-777777777779",
    cipete: "77777777-7777-7777-7777-777777777780",
  },
  internalTransfer: "12121212-3434-5656-7878-909090909001",
} as const;

export type DemoClock = {
  readonly anchorDate: string;
  readonly anchor: Date;
  readonly fromBaseline: (value: string) => Date;
  readonly day: (offset: number, hour?: number, minute?: number) => Date;
};

type JakartaDateParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

function parseDateOnly(value: string): JakartaDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${DEMO_SEED_ANCHOR_ENV} wajib memakai format YYYY-MM-DD.`);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    candidate.getUTCFullYear() !== parts.year ||
    candidate.getUTCMonth() !== parts.month - 1 ||
    candidate.getUTCDate() !== parts.day
  ) {
    throw new Error(`${DEMO_SEED_ANCHOR_ENV} berisi tanggal yang tidak valid.`);
  }
  return parts;
}

function jakartaToday(now: Date): JakartaDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEMO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function jakartaNoonUtc(parts: JakartaDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 5, 0, 0));
}

function dateOnly(parts: JakartaDateParts): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function createDemoClock(options?: {
  readonly now?: Date;
  readonly anchorDate?: string;
}): DemoClock {
  const anchorParts = options?.anchorDate
    ? parseDateOnly(options.anchorDate)
    : jakartaToday(options?.now ?? new Date());
  const anchor = jakartaNoonUtc(anchorParts);
  const baseline = jakartaNoonUtc(parseDateOnly(DEMO_BASELINE_DATE));

  return {
    anchorDate: dateOnly(anchorParts),
    anchor,
    fromBaseline: (value: string): Date => {
      const source = new Date(value);
      if (Number.isNaN(source.getTime())) throw new Error(`Tanggal demo tidak valid: ${value}`);
      return new Date(anchor.getTime() + source.getTime() - baseline.getTime());
    },
    day: (offset: number, hour = 12, minute = 0): Date =>
      new Date(anchor.getTime() + offset * 86_400_000 + (hour - 12) * 3_600_000 + minute * 60_000),
  };
}

export function demoClockFromEnvironment(now = new Date()): DemoClock {
  return createDemoClock({ now, anchorDate: process.env[DEMO_SEED_ANCHOR_ENV] });
}

export function parseMoneyToMinor(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error(`Nominal demo tidak valid: ${value}`);
  const fraction = (match[3] ?? "").padEnd(2, "0");
  const amount = BigInt(match[2]) * 100n + BigInt(fraction || "0");
  return match[1] === "-" ? -amount : amount;
}

export function formatMinorMoney(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function csvDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type DemoCsvFixture = {
  readonly fileName: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly content: string;
};

function csvFixture(
  clock: DemoClock,
  input: Omit<DemoCsvFixture, "content"> & {
    readonly rows: readonly {
      readonly dayOffset: number;
      readonly description: string;
      readonly inflow?: string;
      readonly outflow?: string;
    }[];
  },
): DemoCsvFixture {
  const rows = input.rows.map((row) =>
    [
      csvDate(clock.day(row.dayOffset)),
      `"${row.description.replaceAll('"', '""')}"`,
      row.inflow ?? "",
      row.outflow ?? "",
    ].join(","),
  );
  return {
    fileName: input.fileName,
    bankAccountId: input.bankAccountId,
    bankAccountName: input.bankAccountName,
    content: ["tanggal,deskripsi,dana_masuk,dana_keluar", ...rows].join("\n"),
  };
}

export function createDemoCsvFixtures(clock: DemoClock): readonly DemoCsvFixture[] {
  return [
    csvFixture(clock, {
      fileName: `bca-operasional-${clock.anchorDate}.csv`,
      bankAccountId: DEMO_IDS.bankAccounts.bcaOperational,
      bankAccountName: "BCA Operasional",
      rows: [
        {
          dayOffset: 0,
          description: "Pelunasan INV/DEMO/MENTENG/02",
          inflow: "200000000",
        },
        { dayOffset: 0, description: "Pembayaran vendor demo tahap kecil", outflow: "4000000" },
        {
          dayOffset: 0,
          description: "Pembayaran vendor demo persetujuan Owner",
          outflow: "10000000",
        },
        { dayOffset: 0, description: "Transfer kas kecil PM Budi", outflow: "5000000" },
      ],
    }),
    csvFixture(clock, {
      fileName: `kas-pm-budi-${clock.anchorDate}.csv`,
      bankAccountId: DEMO_IDS.bankAccounts.pettyCashBudi,
      bankAccountName: "Kas Kecil PM Budi",
      rows: [
        { dayOffset: 0, description: "Penerimaan transfer kas kecil", inflow: "5000000" },
        { dayOffset: 0, description: "Pencairan expense operasional demo", outflow: "1050000" },
        { dayOffset: 0, description: "Pencairan expense material Menteng", outflow: "5000000" },
      ],
    }),
    csvFixture(clock, {
      fileName: `mandiri-utama-${clock.anchorDate}.csv`,
      bankAccountId: DEMO_IDS.bankAccounts.mandiriMain,
      bankAccountName: "Mandiri Giro Utama",
      rows: [{ dayOffset: 0, description: "Pencairan expense approval Owner", outflow: "6200000" }],
    }),
  ];
}
