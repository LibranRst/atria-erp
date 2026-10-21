import type {
  project,
  projectBudgets,
  projectBudgetCategory,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
  rabEstimate,
  rabEstimateBundle,
  rabEstimateItem,
} from "../schema";
import { DEMO_IDS, formatMinorMoney, parseMoneyToMinor, type DemoClock } from "./demo-contract";

type RapRow = typeof projectRap.$inferInsert;
type RapItemRow = typeof projectRapItem.$inferInsert;
type PlanRow = typeof projectCategoryPlanItem.$inferInsert;
type RabRow = typeof rabEstimate.$inferInsert;
type BundleRow = typeof rabEstimateBundle.$inferInsert;
type RabItemRow = typeof rabEstimateItem.$inferInsert;
type CategoryRow = typeof projectBudgetCategory.$inferInsert;
type CategoryCode = "TUKANG" | "MATERIAL" | "OPERASIONAL" | "LAIN_LAIN" | "SUBCON";

export type DevelopmentPlanningScenario = {
  readonly key: string;
  readonly projectId: string;
  readonly projectRapId: string;
  readonly rabEstimateId: string | null;
  readonly contractValue: string;
  readonly roomCount: number;
  readonly materialItemCount: number;
  readonly categoryPlanItemCount: number;
  readonly plannedMaterialCost: string;
  readonly plannedTukangCost: string;
  readonly plannedSubconCost: string;
};

export type DevelopmentPlanningDataset = {
  readonly projectRaps: RapRow[];
  readonly rapItems: RapItemRow[];
  readonly categoryPlanItems: PlanRow[];
  readonly rabEstimates: RabRow[];
  readonly rabBundles: BundleRow[];
  readonly rabItems: RabItemRow[];
  readonly replaceRabEstimateIds: string[];
  readonly newBudgets: (typeof projectBudgets.$inferInsert)[];
  readonly newBudgetCategories: CategoryRow[];
  readonly categoryAllocationUpdates: {
    readonly id: string;
    readonly allocatedAmount: string;
    readonly ratioPercentage: string;
    readonly isManualOverride: boolean;
  }[];
  readonly projectUpdates: {
    readonly id: string;
    readonly values: Partial<typeof project.$inferInsert>;
  }[];
  readonly scenarios: DevelopmentPlanningScenario[];
};

type MaterialKind =
  | "plywood"
  | "hpl"
  | "stone"
  | "mdf"
  | "hardware"
  | "finish"
  | "led"
  | "mirror"
  | "veneer"
  | "hinge";
type MaterialReference = {
  readonly id: string;
  readonly name: string;
  readonly specification: string;
  readonly unit: string;
  readonly unitCost: number;
  readonly libraryId?: string;
};
const MATERIALS: Record<MaterialKind, MaterialReference> = {
  plywood: {
    id: "13131313-1313-1313-1313-131313131301",
    name: "Multipleks 18mm Meranti",
    specification: "Carcass panel 1220 × 2440 mm, sambungan dowel dan edging tertutup",
    unit: "lembar",
    unitCost: 250000,
    libraryId: "43434343-4343-4343-4343-434343434101",
  },
  hpl: {
    id: "13131313-1313-1313-1313-131313131302",
    name: "HPL Light Oak",
    specification: "Laminasi HPL motif Light Oak dan edging senada pada sisi terlihat",
    unit: "lembar",
    unitCost: 200000,
    libraryId: "43434343-4343-4343-4343-434343434102",
  },
  stone: {
    id: "13131313-1313-1313-1313-131313131303",
    name: "Solid surface putih 12mm",
    specification: "Top kedalaman 600 mm, sambungan rapi, bahan belum termasuk jasa pemasangan",
    unit: "meter",
    unitCost: 2000000,
  },
  mdf: {
    id: "13131313-1313-1313-1313-131313131304",
    name: "MDF MR 12mm",
    specification:
      "Panel moisture resistant untuk backing dan bidang dekoratif; bukan carcass utama",
    unit: "lembar",
    unitCost: 285000,
  },
  hardware: {
    id: "13131313-1313-1313-1313-131313131305",
    name: "Hardware soft-close per modul",
    specification: "Set engsel, runner, handle dan connector per modul kabinet",
    unit: "set",
    unitCost: 1450000,
  },
  finish: {
    id: "13131313-1313-1313-1313-131313131306",
    name: "Bahan finishing PU",
    specification: "Sealer, warna, clear coat semi-matte dan consumable per batch workshop",
    unit: "paket",
    unitCost: 3200000,
  },
  led: {
    id: "13131313-1313-1313-1313-131313131307",
    name: "LED 24V warm white 3000K",
    specification: "Strip, driver dan profil aluminium untuk lampu kabinet",
    unit: "meter",
    unitCost: 185000,
  },
  mirror: {
    id: "13131313-1313-1313-1313-131313131308",
    name: "Cermin bevel 5mm",
    specification: "Cermin bevel untuk vanity dan wardrobe, luas bersih sesuai shop drawing",
    unit: "m2",
    unitCost: 850000,
  },
  veneer: {
    id: "13131313-1313-1313-1313-131313131309",
    name: "Veneer White Oak 0.6mm",
    specification: "Veneer kayu alami dengan arah serat konsisten satu lot",
    unit: "m2",
    unitCost: 325000,
  },
  hinge: {
    id: "13131313-1313-1313-1313-131313131310",
    name: "Engsel heavy duty tambahan",
    specification: "Engsel soft-close 110° untuk daun pintu tinggi, di luar set modul reguler",
    unit: "pasang",
    unitCost: 85000,
  },
};

type Room = {
  readonly area: string;
  readonly label: string;
  readonly specification: string;
  readonly quantity: number;
  readonly unit: string;
  readonly quote: number;
  readonly materials: readonly MaterialKind[];
};
type ExistingMaterial = {
  readonly number: number;
  readonly room: number;
  readonly kind: MaterialKind;
  readonly required: number;
  readonly buffer: number;
  readonly unitCost?: number;
  readonly status?: string;
};
type Scenario = {
  readonly key: string;
  readonly sequence: number;
  readonly projectId: string;
  readonly rapId: string;
  readonly rabId: string | null;
  readonly budgetIndex: number;
  readonly contractValue: number;
  readonly approved: boolean;
  readonly completed?: boolean;
  readonly review?: boolean;
  readonly revision?: number;
  readonly baselineRapId?: string;
  readonly baselineRabId?: string;
  readonly planSequence?: number;
  readonly rooms: readonly Room[];
  readonly existingMaterials: readonly ExistingMaterial[];
  readonly existingLaborId?: string;
  readonly existingSubconId?: string;
  readonly stoneSubconCost?: number;
  readonly extraServiceFee?: number;
};
const JOINERY: readonly MaterialKind[] = ["plywood", "hpl", "hardware", "led"];
const PANEL: readonly MaterialKind[] = ["mdf", "veneer", "finish", "led"];
const WARDROBE: readonly MaterialKind[] = ["plywood", "hpl", "hardware", "mirror", "hinge"];

function room(
  area: string,
  label: string,
  specification: string,
  quantity: number,
  quote: number,
  materials: readonly MaterialKind[] = JOINERY,
  unit = "m1",
): Room {
  return { area, label, specification, quantity, unit, quote, materials };
}
function stableId(group: number, sequence: number, item: number): string {
  return `d1000000-0000-4000-8000-${String(group).padStart(2, "0")}${String(sequence).padStart(3, "0")}${String(item).padStart(7, "0")}`;
}
function originalRapItemId(number: number): string {
  return `17171717-1717-1717-1717-1717171717${String(number).padStart(2, "0")}`;
}
function budgetId(index: number): string {
  return `30303030-3030-3030-3030-30303030300${index}`;
}
function categoryId(index: number, category: CategoryCode): string {
  const position: Record<CategoryCode, number> = {
    TUKANG: 1,
    MATERIAL: 2,
    OPERASIONAL: 3,
    LAIN_LAIN: 4,
    SUBCON: 5,
  };
  return `32323232-3232-3232-3232-323232323${index}0${position[category]}`;
}
function expenseCategoryId(category: CategoryCode): string {
  const position: Record<CategoryCode, number> = {
    TUKANG: 1,
    MATERIAL: 2,
    OPERASIONAL: 3,
    LAIN_LAIN: 4,
    SUBCON: 5,
  };
  return `31313131-3131-3131-3131-31313131310${position[category]}`;
}
function money(value: number): string {
  return value.toFixed(2);
}
function quantityFor(kind: MaterialKind, roomValue: Room): number {
  const length = roomValue.unit === "m2" ? roomValue.quantity / 2.4 : roomValue.quantity;
  switch (kind) {
    case "plywood":
      return Math.ceil(length * 2.1);
    case "hpl":
      return Math.ceil(length * 1.4);
    case "mdf":
      return Math.ceil(length * 1.6);
    case "hardware":
      return Math.ceil(length / 0.6);
    case "led":
      return Math.ceil(length * 2);
    case "veneer":
      return Math.ceil(length * 2.4);
    case "mirror":
      return Math.ceil(length * 0.65);
    case "hinge":
      return Math.ceil(length * 1.2);
    case "finish":
      return Math.max(1, Math.ceil(length / 7));
    case "stone":
      return length;
  }
}

const MENTENG_ROOMS: readonly Room[] = [
  room(
    "Kitchen · Kabinet Bawah",
    "Kabinet bawah kitchen",
    "Kabinet 8 m1, kedalaman 600 mm, soft-close, ruang sink dan kompor mengikuti koordinasi MEP.",
    8,
    150000000,
  ),
  room(
    "Kitchen · Kabinet Atas",
    "Kabinet atas dan tall unit",
    "Kabinet atas 5 m1 ditambah tall unit oven dan kulkas; ventilasi appliance mengikuti shop drawing.",
    7,
    90000000,
  ),
  room(
    "Kitchen · Island",
    "Kitchen island dan breakfast counter",
    "Island 3,2 × 1,1 m dengan storage dua sisi, seating overhang dan stopkontak tersembunyi.",
    3.2,
    110000000,
  ),
  room(
    "Living · TV Wall",
    "TV wall dan console built-in",
    "Panel 5 × 2,8 m, console 4,8 m1, kabel tersembunyi dan akses servis TV.",
    14,
    120000000,
    PANEL,
    "m2",
  ),
  room(
    "Living · Display",
    "Display cabinet dan rak buku",
    "Display 4,2 m1 dengan pintu bawah tertutup, rak adjustable dan LED warm white.",
    4.2,
    80000000,
  ),
  room(
    "Pantry",
    "Kabinet pantry dan coffee station",
    "Pantry 4,8 m1 dengan storage, coffee station dan top tahan air.",
    4.8,
    90000000,
  ),
];
const SUDIRMAN_ROOMS: readonly Room[] = [
  room(
    "Living",
    "Panel dinding living dan console",
    "Panel veneer 54 m2 dengan arah serat satu lot, akses servis dan clear coat semi-matte.",
    54,
    205000000,
    PANEL,
    "m2",
  ),
  room(
    "Dining",
    "Credenza dan dining feature wall",
    "Credenza 5 m1, panel 24 m2 dan kabinet display dengan profil lampu tersembunyi.",
    5,
    125000000,
  ),
  room(
    "Kitchen",
    "Kitchen premium dan tall appliance",
    "Kitchen 10 m1, tall appliance 4 m1, pull-out pantry dan hardware soft-close.",
    14,
    185000000,
  ),
  room(
    "Master Wardrobe",
    "Walk-in wardrobe master suite",
    "Wardrobe 14 m1, tinggi 2,8 m, cermin bevel, laci perhiasan dan rail gantung.",
    14,
    170000000,
    WARDROBE,
  ),
  room(
    "Master Vanity",
    "Vanity dan headboard master",
    "Vanity 3 m1 dan headboard berpanel; pencahayaan makeup dan stopkontak terintegrasi.",
    5,
    85000000,
    WARDROBE,
  ),
  room(
    "Foyer & Corridor",
    "Panel foyer dan storage koridor",
    "Panel veneer 34 m2, shoe storage dan concealed door menuju servis.",
    34,
    90000000,
    PANEL,
    "m2",
  ),
  room(
    "Guest Bedroom",
    "Wardrobe dan study tamu",
    "Wardrobe 4,8 m1, meja kerja 2 m1 dan storage atas, finishing HPL senada.",
    6.8,
    70000000,
    WARDROBE,
  ),
  room(
    "Study",
    "Study cabinet dan bookshelf",
    "Meja built-in 4 m1, bookshelf 6 m1 dan cable management untuk dua pengguna.",
    8,
    70000000,
  ),
];
const SCENARIOS: readonly Scenario[] = [
  {
    key: "menteng",
    sequence: 1,
    projectId: DEMO_IDS.projects.menteng,
    rapId: "16161616-1616-1616-1616-161616161601",
    rabId: "19191919-1919-1919-1919-191919191901",
    budgetIndex: 1,
    contractValue: 800000000,
    approved: true,
    rooms: MENTENG_ROOMS,
    existingLaborId: "35353535-3535-3535-3535-353535353501",
    existingSubconId: "35353535-3535-3535-3535-353535353502",
    stoneSubconCost: 41000000,
    existingMaterials: [
      { number: 1, room: 0, kind: "plywood", required: 45, buffer: 5, status: "WAITING_PURCHASE" },
      { number: 2, room: 3, kind: "hpl", required: 20, buffer: 2, status: "SHORTAGE" },
      { number: 3, room: 0, kind: "stone", required: 12, buffer: 1 },
    ],
  },
  {
    key: "sudirman",
    sequence: 2,
    projectId: DEMO_IDS.projects.sudirman,
    rapId: "16161616-1616-1616-1616-161616161602",
    rabId: "19191919-1919-1919-1919-191919191903",
    budgetIndex: 2,
    contractValue: 1200000000,
    approved: true,
    rooms: SUDIRMAN_ROOMS,
    existingLaborId: "35353535-3535-3535-3535-353535353503",
    existingSubconId: "35353535-3535-3535-3535-353535353504",
    stoneSubconCost: 62000000,
    existingMaterials: [
      { number: 4, room: 0, kind: "veneer", required: 145, buffer: 15, status: "WAITING_PURCHASE" },
      { number: 5, room: 3, kind: "mirror", required: 28, buffer: 2 },
      { number: 6, room: 5, kind: "led", required: 210, buffer: 20, status: "SHORTAGE" },
    ],
  },
  {
    key: "brawijaya",
    sequence: 3,
    projectId: DEMO_IDS.projects.brawijaya,
    rapId: "16161616-1616-1616-1616-161616161603",
    rabId: "19191919-1919-1919-1919-191919191906",
    budgetIndex: 3,
    contractValue: 950000000,
    approved: false,
    existingLaborId: "35353535-3535-3535-3535-353535353505",
    existingSubconId: "35353535-3535-3535-3535-353535353506",
    stoneSubconCost: 60000000,
    rooms: [
      room(
        "Kitchen",
        "Kitchen dan appliance tower",
        "Kitchen 12 m1, tall appliance 3 m1, sink cabinet dan drawer cutlery.",
        15,
        200000000,
      ),
      room(
        "Pantry",
        "Pantry dan breakfast counter",
        "Pantry 6 m1 dengan bar 3 m1 dan top solid surface, tanpa appliance lepas.",
        9,
        115000000,
      ),
      room(
        "Family Room",
        "TV cabinet dan display",
        "TV console 6 m1, storage, panel backing MR dan display sesuai layout family room.",
        8,
        130000000,
      ),
      room(
        "Master Wardrobe",
        "Wardrobe dan vanity master",
        "Wardrobe 10 m1, pintu cermin dan vanity 3 m1 dengan laci soft-close.",
        13,
        165000000,
        WARDROBE,
      ),
      room(
        "Kids Bedroom",
        "Wardrobe dan study anak",
        "Dua modul wardrobe 3 m1 dan meja belajar 3 m1; sudut aman dan rak adjustable.",
        9,
        95000000,
      ),
      room(
        "Foyer",
        "Shoe cabinet dan panel foyer",
        "Shoe cabinet 4 m1 dan panel foyer 18 m2, ventilasi kabinet serta rak payung.",
        6,
        85000000,
      ),
    ],
    existingMaterials: [
      { number: 7, room: 2, kind: "mdf", required: 72, buffer: 8, status: "WAITING_PURCHASE" },
      { number: 8, room: 0, kind: "hpl", required: 58, buffer: 6, status: "SHORTAGE" },
      { number: 9, room: 3, kind: "hardware", required: 42, buffer: 4, status: "PLANNED" },
      { number: 10, room: 3, kind: "finish", required: 9, buffer: 1 },
    ],
  },
  {
    key: "senopati",
    sequence: 4,
    projectId: DEMO_IDS.projects.senopati,
    rapId: stableId(1, 4, 1),
    rabId: "19191919-1919-1919-1919-191919191902",
    budgetIndex: 4,
    contractValue: 500000000,
    approved: true,
    completed: true,
    rooms: [
      room(
        "Director Suite",
        "Meja direktur dan credenza",
        "Meja custom 3 m1, credenza 4 m1, modesty panel dan manajemen kabel.",
        7,
        85000000,
      ),
      room(
        "Meeting Room",
        "Meja rapat dan AV cabinet",
        "Meja rapat 4,8 m1 untuk 12 orang, AV cabinet, cable trough dan power socket.",
        6,
        95000000,
      ),
      room(
        "Reception",
        "Meja resepsionis dan branding wall",
        "Reception counter 3,6 m1 dan branding wall 12 m2, akses maintenance panel.",
        5,
        65000000,
      ),
      room(
        "Lounge",
        "Console lounge dan library",
        "Console 4 m1 dan rak buku 5 m1, veneer natural dan lampu indirect.",
        7,
        65000000,
        PANEL,
      ),
      room(
        "Pantry",
        "Pantry kantor dan storage",
        "Pantry 4,2 m1, sink, pull-out bin dan storage supplies, appliance dikecualikan.",
        4.2,
        60000000,
      ),
      room(
        "Storage & Corridor",
        "Storage dokumen dan panel",
        "Kabinet dokumen 6 m1, pintu lockable serta panel koridor 14 m2.",
        8,
        65000000,
      ),
    ],
    existingMaterials: [],
  },
  {
    key: "bsd",
    sequence: 7,
    projectId: DEMO_IDS.projects.bsd,
    rapId: stableId(1, 7, 1),
    rabId: stableId(4, 7, 1),
    budgetIndex: 7,
    contractValue: 380000000,
    approved: true,
    completed: true,
    rooms: [
      room(
        "Espresso Bar",
        "Counter espresso dan servis",
        "Counter 5 m1, akses drainase dan panel servis; mesin kopi milik operator.",
        5,
        75000000,
      ),
      room(
        "Cashier",
        "Cashier counter dan display pastry",
        "Counter 3 m1 dengan laci kas dan storage; display chiller oleh operator.",
        3,
        45000000,
      ),
      room(
        "Main Dining",
        "Banquette dan storage dining",
        "Banquette 8 m1 dengan storage bawah, rangka plywood dan upholstery terpisah.",
        8,
        70000000,
      ),
      room(
        "Window Seating",
        "Meja bar jendela",
        "Meja bar 6 m1, bracket penopang dan titik charger tersembunyi.",
        6,
        40000000,
      ),
      room(
        "Back Bar",
        "Back bar dan merchandise wall",
        "Display 5 m1, rak merchandise adjustable dan lampu warm white.",
        5,
        55000000,
      ),
      room(
        "Service Area",
        "Storage servis dan wash station",
        "Storage 4 m1 dengan area wash, finishing tahan lembap dan ventilasi.",
        4,
        50000000,
      ),
    ],
    existingMaterials: [],
  },
  {
    key: "kemang",
    sequence: 8,
    projectId: DEMO_IDS.projects.kemang,
    rapId: stableId(1, 8, 1),
    rabId: stableId(4, 8, 1),
    budgetIndex: 8,
    contractValue: 260000000,
    approved: false,
    rooms: [
      room(
        "Master · Wardrobe Kiri",
        "Wardrobe sisi kiri",
        "Wardrobe 4,2 m1, tinggi 2,6 m, hanging rail, laci dan pintu HPL.",
        4.2,
        55000000,
        WARDROBE,
      ),
      room(
        "Master · Wardrobe Kanan",
        "Wardrobe sisi kanan",
        "Wardrobe 3,6 m1 untuk pakaian lipat dan linen, rak adjustable.",
        3.6,
        45000000,
        WARDROBE,
      ),
      room(
        "Walk-in Closet",
        "Island wardrobe",
        "Island 2 × 0,9 m, tray aksesori dan laci dua sisi; perubahan belum untuk produksi.",
        2,
        35000000,
      ),
      room(
        "Vanity",
        "Vanity dan cermin",
        "Vanity 2,4 m1, laci makeup dan cermin bevel; dimensi menunggu survey ulang.",
        2.4,
        35000000,
        WARDROBE,
      ),
      room(
        "Master · Headboard",
        "Headboard dan bedside",
        "Panel headboard 10 m2, dua bedside drawer dan jalur lampu indirect.",
        10,
        35000000,
        PANEL,
        "m2",
      ),
      room(
        "Dressing Storage",
        "Linen dan shoe storage",
        "Storage 3 m1, ventilasi shoe cabinet dan rak linen; instalasi setelah izin akses.",
        3,
        30000000,
      ),
    ],
    existingMaterials: [],
  },
  {
    key: "cipete",
    sequence: 6,
    projectId: DEMO_IDS.projects.cipete,
    rapId: "16161616-1616-1616-1616-161616161605",
    rabId: null,
    budgetIndex: 6,
    contractValue: 420000000,
    approved: false,
    review: true,
    existingLaborId: "35353535-3535-3535-3535-353535353509",
    existingSubconId: "35353535-3535-3535-3535-353535353510",
    stoneSubconCost: 41000000,
    rooms: [
      room(
        "Kitchen · Kabinet Bawah",
        "Kabinet bawah kitchen",
        "Kabinet 6 m1 dengan sink, pull-out bin dan akses plumbing.",
        6,
        75000000,
      ),
      room(
        "Kitchen · Tall Unit",
        "Tall appliance dan pantry",
        "Tall unit 3 m1, oven tower dan pull-out pantry, koordinasi listrik wajib sebelum produksi.",
        3,
        60000000,
      ),
      room(
        "Family Room",
        "TV cabinet dan rak display",
        "Console 4 m1, display 3 m1 dan panel HPL, akses servis TV tertutup.",
        7,
        65000000,
      ),
      room(
        "Master Wardrobe",
        "Wardrobe master",
        "Wardrobe 6 m1 dengan laci, soft-close dan hanging rail.",
        6,
        70000000,
        WARDROBE,
      ),
      room(
        "Master Vanity",
        "Vanity master dan cermin",
        "Vanity 2 m1 dengan LED makeup dan cermin bevel.",
        2,
        35000000,
        WARDROBE,
      ),
      room(
        "Foyer",
        "Shoe cabinet dan foyer",
        "Shoe storage 3 m1, ventilasi dan panel MR.",
        3,
        35000000,
      ),
    ],
    existingMaterials: [
      { number: 15, room: 0, kind: "plywood", required: 52, buffer: 6, status: "WAITING_PURCHASE" },
      { number: 16, room: 2, kind: "hpl", required: 30, buffer: 4, status: "SHORTAGE" },
      { number: 17, room: 3, kind: "hardware", required: 28, buffer: 3, status: "PLANNED" },
    ],
  },
];

const BASE_LABOR_COSTS: Readonly<Record<string, number>> = {
  menteng: 28500000,
  sudirman: 46500000,
  brawijaya: 76000000,
  cipete: 45000000,
};
function addMaterial(
  scenario: Scenario,
  roomValue: Room,
  kind: MaterialKind,
  id: string,
  required: number,
  buffer: number,
  date: Date,
  options?: { readonly unitCost?: number; readonly status?: string },
): RapItemRow {
  const material = MATERIALS[kind];
  const total = required + buffer;
  const unitCost = options?.unitCost ?? material.unitCost;
  return {
    id,
    projectRapId: scenario.rapId,
    materialId: material.id,
    sourceLibraryItemId: material.libraryId ?? null,
    area: roomValue.area,
    name: `${material.name} · ${roomValue.label}`,
    description: material.specification,
    requiredQuantity: money(required),
    bufferQuantity: money(buffer),
    totalQuantity: money(total),
    unit: material.unit,
    estimatedUnitCost: money(unitCost),
    estimatedTotalCost: money(total * unitCost),
    suggestedClientUnitPrice: money(unitCost * 1.3),
    source: kind === "plywood" || kind === "hardware" ? "STOCK_AND_PURCHASE" : "PURCHASE",
    status: options?.status ?? "PLANNED",
    internalNote: `BOM ${roomValue.area}; volume dari ukuran shop drawing. Buffer ${money(buffer)} ${material.unit} untuk potongan dan cadangan. Bahan dan jasa dipisah agar biaya tidak dihitung dua kali.`,
    createdAt: date,
    updatedAt: date,
  };
}
function makePlan(
  scenario: Scenario,
  input: {
    readonly id: string;
    readonly category: "TUKANG" | "SUBCON";
    readonly area: string;
    readonly name: string;
    readonly description: string;
    readonly quantity: number;
    readonly unit: string;
    readonly unitCost: number;
    readonly date: Date;
    readonly vendorId?: string;
    readonly libraryId?: string;
    readonly revision?: number;
    readonly supersedesId?: string;
  },
): PlanRow {
  return {
    id: input.id,
    projectId: scenario.projectId,
    projectBudgetId: budgetId(scenario.budgetIndex),
    projectBudgetCategoryId: categoryId(scenario.budgetIndex, input.category),
    expenseCategoryId: expenseCategoryId(input.category),
    vendorId: input.vendorId ?? null,
    sourceLibraryItemId: input.libraryId ?? null,
    supersedesProjectCategoryPlanItemId: input.supersedesId ?? null,
    revision: input.revision ?? 1,
    name: input.name,
    scopeDescription: input.description,
    area: input.area,
    quantity: money(input.quantity),
    unit: input.unit,
    estimatedUnitCost: money(input.unitCost),
    estimatedTotalCost: money(input.quantity * input.unitCost),
    suggestedClientUnitPrice: money(input.unitCost * 1.25),
    status: scenario.completed ? "DONE" : "ACTIVE",
    lockedById: scenario.review ? null : DEMO_IDS.users.owner,
    lockedAt: scenario.review ? null : input.date,
    internalNote:
      "Pembayaran berdasarkan progres terverifikasi PM; scope eksklusif terhadap material BOM dan paket lain. Harga ini fixture simulasi development, bukan quotation vendor aktual.",
    displayOrder: input.category === "TUKANG" ? 10 : 100,
    createdAt: input.date,
    updatedAt: input.date,
  };
}
function uniqueRows<T extends { readonly id?: string }>(rows: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    if (!row.id) throw new Error("Planning fixture wajib memakai ID deterministik.");
    byId.set(row.id, row);
  }
  return [...byId.values()];
}
function sumCost(rows: readonly { readonly estimatedTotalCost?: string | null }[]): bigint {
  return rows.reduce((sum, row) => sum + parseMoneyToMinor(row.estimatedTotalCost ?? "0.00"), 0n);
}

/** Deterministic synthetic Jakarta interior projects, with exact arithmetic and source lineage. */
export function buildDevelopmentPlanningDataset(clock: DemoClock): DevelopmentPlanningDataset {
  const dataset: DevelopmentPlanningDataset = {
    projectRaps: [],
    rapItems: [],
    categoryPlanItems: [],
    rabEstimates: [],
    rabBundles: [],
    rabItems: [],
    replaceRabEstimateIds: [],
    newBudgets: [],
    newBudgetCategories: [],
    categoryAllocationUpdates: [],
    projectUpdates: [],
    scenarios: [],
  };
  const baseSudirman = SCENARIOS.find((scenario) => scenario.key === "sudirman");
  if (!baseSudirman) throw new Error("Scenario Sudirman baseline tidak tersedia.");
  const revisedSudirman: Scenario = {
    ...baseSudirman,
    key: "sudirman-revision",
    sequence: 5,
    planSequence: 2,
    rapId: "16161616-1616-1616-1616-161616161604",
    rabId: "19191919-1919-1919-1919-191919191905",
    revision: 2,
    approved: false,
    contractValue: 1335000000,
    baselineRapId: baseSudirman.rapId,
    baselineRabId: baseSudirman.rabId ?? undefined,
    existingSubconId: "35353535-3535-3535-3535-353535353508",
    stoneSubconCost: 74400000,
    rooms: SUDIRMAN_ROOMS.map((value, index) => ({
      ...value,
      quote:
        value.quote +
        (index === 3 ? 45000000 : index === 5 ? 40000000 : index === 0 ? 50000000 : 0),
      specification:
        index === 3
          ? `${value.specification} Revisi menambah island wardrobe 2,4 × 1,1 m.`
          : index === 5
            ? `${value.specification} Revisi menambah 40 m2 veneer foyer.`
            : index === 0
              ? `${value.specification} Revisi driver dimmable DALI dan commissioning smart lighting.`
              : value.specification,
    })),
    existingMaterials: [
      {
        number: 11,
        room: 0,
        kind: "veneer",
        required: 185,
        buffer: 15,
        unitCost: 340000,
        status: "WAITING_PURCHASE",
      },
      { number: 12, room: 3, kind: "mirror", required: 34, buffer: 2, unitCost: 875000 },
      {
        number: 13,
        room: 5,
        kind: "led",
        required: 240,
        buffer: 24,
        unitCost: 225000,
        status: "SHORTAGE",
      },
      { number: 14, room: 3, kind: "hardware", required: 12, buffer: 2, unitCost: 1850000 },
    ],
  };
  const allScenarios = [...SCENARIOS, revisedSudirman];
  const allocationSources = new Map<number, DevelopmentPlanningScenario>();
  for (const scenario of allScenarios) {
    const revision = scenario.revision ?? 1;
    const sourceDate = clock.day(
      scenario.completed ? -150 : scenario.review ? -6 : revision > 1 ? -4 : -52,
      9,
    );
    const planDate = scenario.key === "sudirman-revision" ? clock.day(-52, 9) : sourceDate;
    dataset.projectRaps.push({
      id: scenario.rapId,
      projectId: scenario.projectId,
      supersedesProjectRapId: scenario.baselineRapId ?? null,
      status: scenario.review ? "DRAFT" : "LOCKED",
      revision,
      setupStage: scenario.review ? "REVIEW" : "COMPLETE",
      setupUpdatedById: DEMO_IDS.users.finance,
      lockedById: scenario.review ? null : DEMO_IDS.users.owner,
      lockedAt: scenario.review ? null : sourceDate,
      notes: `${scenario.rooms.length} area kerja dengan BOM, allowance potongan, jasa Tukang dan Subcon. ${scenario.review ? "Belum final; RAB belum diterbitkan." : "Baseline volume mengikuti shop drawing dan survey lapangan."}`,
      createdAt: sourceDate,
      updatedAt: sourceDate,
    });
    const materials: RapItemRow[] = [];
    const roomMaterials = new Map<number, RapItemRow[]>();
    let materialCounter = 1;
    for (const [roomIndex, roomValue] of scenario.rooms.entries()) {
      const entries: RapItemRow[] = [];
      const existing = scenario.existingMaterials.filter((value) => value.room === roomIndex);
      for (const value of existing)
        entries.push(
          addMaterial(
            scenario,
            roomValue,
            value.kind,
            originalRapItemId(value.number),
            value.required,
            value.buffer,
            sourceDate,
            value,
          ),
        );
      for (const kind of roomValue.materials) {
        if (existing.some((value) => value.kind === kind)) continue;
        const required = quantityFor(kind, roomValue);
        const buffer =
          kind === "hardware" || kind === "finish" ? 1 : Math.max(1, Math.ceil(required * 0.08));
        entries.push(
          addMaterial(
            scenario,
            roomValue,
            kind,
            stableId(2, scenario.sequence, materialCounter++),
            required,
            buffer,
            sourceDate,
          ),
        );
      }
      roomMaterials.set(roomIndex, entries);
      materials.push(...entries);
    }
    if (!materials.some((value) => value.materialId === MATERIALS.stone.id)) {
      const kitchenIndex = scenario.rooms.findIndex((value) =>
        /Kitchen|Pantry|Bar|Vanity/.test(value.area),
      );
      const index = kitchenIndex >= 0 ? kitchenIndex : 0;
      const roomValue = scenario.rooms[index];
      if (!roomValue) throw new Error("Planning scenario belum memiliki area.");
      const stone = addMaterial(
        scenario,
        roomValue,
        "stone",
        stableId(2, scenario.sequence, materialCounter++),
        Math.max(3, Math.ceil(roomValue.quantity * 0.7)),
        1,
        sourceDate,
      );
      materials.push(stone);
      roomMaterials.get(index)?.push(stone);
    }
    dataset.rapItems.push(...materials);
    const laborRows: PlanRow[] = [];
    const planSequence = scenario.planSequence ?? scenario.sequence;
    const laborCostKey = scenario.key === "sudirman-revision" ? "sudirman" : scenario.key;
    for (const [roomIndex, roomValue] of scenario.rooms.entries()) {
      const original = roomIndex === 0 ? scenario.existingLaborId : undefined;
      const days = Math.max(
        3,
        Math.ceil(roomValue.quantity * (roomValue.unit === "m2" ? 0.22 : 0.8)),
      );
      const row = makePlan(scenario, {
        id: original ?? stableId(3, planSequence, roomIndex + 1),
        category: "TUKANG",
        area: roomValue.area,
        name: `Fabrikasi dan instalasi · ${roomValue.label}`,
        description: `Jasa ukur, fabrikasi workshop, pemasangan, alignment dan punch list ${roomValue.label.toLowerCase()}. Bahan dari BOM Material; pekerjaan MEP, countertop dan kaca spesialis dikecualikan.`,
        quantity: original ? 1 : days,
        unit: original ? "paket" : "hari tim",
        unitCost: original ? (BASE_LABOR_COSTS[laborCostKey] ?? days * 1150000) : 1150000,
        libraryId: original ? "43434343-4343-4343-4343-434343434103" : undefined,
        date: planDate,
      });
      laborRows.push(row);
    }
    const primaryIsGlass = scenario.key.startsWith("sudirman");
    const costBasis = scenario.key === "sudirman-revision" ? 1200000000 : scenario.contractValue;
    const subconRows: PlanRow[] = [
      makePlan(scenario, {
        id: scenario.existingSubconId ?? stableId(3, planSequence, 101),
        category: "SUBCON",
        area: primaryIsGlass ? "Master Suite & Bathroom" : "Kitchen & Pantry",
        name: primaryIsGlass
          ? "Partisi kaca tempered dan fitting custom"
          : "Fabrikasi dan instalasi countertop",
        description: primaryIsGlass
          ? "Partisi kaca tempered 10 mm, fitting, sealant, pengiriman dan instalasi. Cermin wardrobe dibeli terpisah melalui BOM Material; paket ini tidak membeli ulang cermin tersebut."
          : "Template, potongan sink, sambungan, support bracket, polishing, pengiriman dan pemasangan top. Bahan solid surface disediakan Dekoria melalui BOM Material, sehingga tidak dibeli ulang di paket Subcon.",
        quantity: 1,
        unit: "paket",
        unitCost: scenario.stoneSubconCost ?? Math.round(costBasis * 0.045),
        vendorId: primaryIsGlass
          ? "55555555-5555-5555-5555-555555555552"
          : "55555555-5555-5555-5555-555555555553",
        libraryId: primaryIsGlass ? undefined : "43434343-4343-4343-4343-434343434104",
        date: scenario.key === "sudirman-revision" ? sourceDate : planDate,
        revision: scenario.key === "sudirman-revision" ? 2 : 1,
        supersedesId:
          scenario.key === "sudirman-revision" ? "35353535-3535-3535-3535-353535353504" : undefined,
      }),
      makePlan(scenario, {
        id: stableId(3, planSequence, 102),
        category: "SUBCON",
        area: "Seluruh Area",
        name: "Relokasi listrik, plumbing dan commissioning",
        description:
          "Jasa relokasi titik listrik, plumbing minor, pemasangan driver yang dibeli melalui BOM, testing dan commissioning. Appliance, kabel utama gedung dan unit AC baru dikecualikan.",
        quantity: 1,
        unit: "paket",
        unitCost: Math.round(costBasis * 0.035),
        vendorId: "55555555-5555-5555-5555-555555555552",
        date: planDate,
      }),
      makePlan(scenario, {
        id: stableId(3, planSequence, 103),
        category: "SUBCON",
        area: "Living & Master Suite",
        name:
          scenario.key === "bsd" ? "Upholstery banquette cafe" : "Finishing khusus dan upholstery",
        description:
          "Jasa finishing khusus, rangka upholstery, foam dan kain sesuai sampel klien. Bahan PU untuk bidang joinery telah dialokasikan pada BOM; scope upholstery dipisahkan.",
        quantity: 1,
        unit: "paket",
        unitCost: Math.round(costBasis * 0.022),
        vendorId: "55555555-5555-5555-5555-555555555554",
        date: planDate,
      }),
    ];
    if (scenario.key === "sudirman-revision") {
      const extra = makePlan(scenario, {
        id: "35353535-3535-3535-3535-353535353507",
        category: "TUKANG",
        area: "Foyer & Master Wardrobe",
        name: "Instalasi tambahan island wardrobe dan foyer R2",
        description:
          "Pemasangan island wardrobe, perluasan panel foyer dan koordinasi akses maintenance tambahan di luar paket instalasi R1.",
        quantity: 1,
        unit: "paket",
        unitCost: 72000000,
        date: clock.day(-4, 10),
        revision: 2,
      });
      laborRows.push(extra);
    }
    dataset.categoryPlanItems.push(...laborRows, ...subconRows);
    const scenarioMetadata: DevelopmentPlanningScenario = {
      key: scenario.key,
      projectId: scenario.projectId,
      projectRapId: scenario.rapId,
      rabEstimateId: scenario.rabId,
      contractValue: money(scenario.contractValue),
      roomCount: scenario.rooms.length,
      materialItemCount: materials.length,
      categoryPlanItemCount: laborRows.length + subconRows.length,
      plannedMaterialCost: formatMinorMoney(sumCost(materials)),
      plannedTukangCost: formatMinorMoney(sumCost(laborRows)),
      plannedSubconCost: formatMinorMoney(sumCost(subconRows)),
    };
    dataset.scenarios.push(scenarioMetadata);
    allocationSources.set(scenario.budgetIndex, scenarioMetadata);
    if (scenario.rabId)
      addRab(dataset, scenario, materials, roomMaterials, laborRows, subconRows, sourceDate);
    if (scenario.budgetIndex >= 7) {
      const internalBudget = scenario.contractValue * 0.9;
      dataset.newBudgets.push({
        id: budgetId(scenario.budgetIndex),
        projectId: scenario.projectId,
        status: scenario.approved ? "APPROVED" : "DRAFT",
        contractValue: money(scenario.contractValue),
        approvedRabValue: scenario.approved ? money(scenario.contractValue) : "0.00",
        internalBudget: money(internalBudget),
        budgetCapRatio: "0.900000",
        targetGrossAmount: money(scenario.contractValue - internalBudget),
        targetGrossPercentage: "10.0000",
        projectProgressPercentage: scenario.completed ? "100.0000" : "0.0000",
        approvedById: scenario.approved ? DEMO_IDS.users.owner : null,
        approvedAt: scenario.approved ? sourceDate : null,
        notes: scenario.completed
          ? "Riwayat pekerjaan selesai; seluruh scope mengikuti RAB final."
          : "Anggaran awal belum disetujui; pelaksanaan ditahan sampai izin dan kontrak final.",
      });
      dataset.projectUpdates.push({
        id: scenario.projectId,
        values: {
          totalContractValue: scenario.approved ? money(scenario.contractValue) : "0.00",
          notes: scenario.completed
            ? "Cafe telah serah terima. RAP dan RAB final terhubung dengan riwayat keuangan dan material development."
            : "Pelaksanaan ditahan; RAP terkunci dan draft RAB tersedia untuk review quotation, belum menjadi nilai kontrak.",
          updatedAt: sourceDate,
        },
      });
    }
  }
  addCancelledMentengRevision(dataset, clock);
  for (const [index, source] of allocationSources) addAllocations(dataset, index, source);
  return {
    ...dataset,
    projectRaps: uniqueRows(dataset.projectRaps),
    rapItems: uniqueRows(dataset.rapItems),
    categoryPlanItems: uniqueRows(dataset.categoryPlanItems),
    rabEstimates: uniqueRows(dataset.rabEstimates),
  };
}

function addRab(
  dataset: DevelopmentPlanningDataset,
  scenario: Scenario,
  materials: readonly RapItemRow[],
  roomMaterials: ReadonlyMap<number, readonly RapItemRow[]>,
  laborRows: readonly PlanRow[],
  subconRows: readonly PlanRow[],
  sourceDate: Date,
): void {
  const rabId = scenario.rabId;
  if (!rabId) return;
  const documentDate = new Date(sourceDate.getTime() + 86400000);
  const revision = scenario.revision ?? 1;
  dataset.replaceRabEstimateIds.push(rabId);
  dataset.rabEstimates.push({
    id: rabId,
    projectId: scenario.projectId,
    sourceProjectRapId: scenario.rapId,
    supersedesRabEstimateId: scenario.baselineRabId ?? null,
    status: scenario.approved ? "APPROVED" : "DRAFT",
    revision,
    title: `RAB ${scenario.key === "sudirman-revision" ? "Revisi Wardrobe, Foyer & Smart Lighting" : scenario.key === "bsd" ? "Final Interior Cafe BSD" : scenario.key === "kemang" ? "Custom Wardrobe Kemang" : scenario.key.charAt(0).toUpperCase() + scenario.key.slice(1)} · ${scenario.rooms.length} Area`,
    clientNotes: `Lingkup berdasarkan ukuran survey dan shop drawing. ${scenario.rooms.length} area terinci, hardware dan bahan finishing sesuai sampel yang disetujui. Material, fabrikasi dan instalasi joinery tercakup per paket area; jasa spesialis ditagih satu kali pada baris terpisah. Appliance lepas dan pekerjaan struktur dikecualikan. ${scenario.approved ? "Disetujui untuk pelaksanaan sesuai kontrak." : "Draft untuk review klien; belum merupakan instruksi pelaksanaan atau nilai kontrak final."}`,
    approvedValue: scenario.approved ? money(scenario.contractValue) : "0.00",
    approvedAt: scenario.approved ? new Date(sourceDate.getTime() + 86400000) : null,
    createdAt: new Date(sourceDate.getTime() + 86400000),
    updatedAt: new Date(sourceDate.getTime() + 86400000),
  });
  let itemCounter = 1;
  let visibleTotal = 0n;
  for (const [index, subcon] of subconRows.entries()) {
    const unitPrice = subcon.suggestedClientUnitPrice ?? "0.00";
    const quantity = subcon.quantity ?? "1.00";
    const total = (parseMoneyToMinor(quantity) * parseMoneyToMinor(unitPrice) + 50n) / 100n;
    dataset.rabItems.push({
      id: stableId(6, scenario.sequence, itemCounter++),
      rabEstimateId: rabId,
      sourceType: "CATEGORY_PLAN",
      sourceProjectCategoryPlanItemId: subcon.id,
      sourceProjectRapItemId: null,
      sourceLibraryItemId: subcon.sourceLibraryItemId ?? null,
      sourceRevision: subcon.revision ?? 1,
      sourceUpdatedAt: subcon.updatedAt,
      clientLabel: subcon.name,
      description: subcon.scopeDescription,
      quantity,
      unit: subcon.unit ?? "paket",
      unitPrice,
      lineTotal: formatMinorMoney(total),
      displayOrder: scenario.rooms.length + index + 1,
      isBundle: false,
      isHidden: false,
      itemNature: "PRODUCTION",
      createdAt: documentDate,
      updatedAt: documentDate,
    });
    visibleTotal += total;
  }
  const looseTotal = parseMoneyToMinor(money(scenario.contractValue * 0.05));
  dataset.rabItems.push({
    id: stableId(6, scenario.sequence, itemCounter++),
    rabEstimateId: rabId,
    sourceType: "MANUAL",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: null,
    sourceLibraryItemId: null,
    clientLabel:
      scenario.key === "bsd"
        ? "Kursi dining dan stool cafe"
        : "Loose furniture dan aksesori terpilih",
    description:
      scenario.key === "bsd"
        ? "Kursi dan stool sesuai sampel operator; terpisah dari banquette built-in dan upholstery pada paket spesialis."
        : "Kursi aksen, stool dan aksesori sesuai daftar pilihan klien; tidak termasuk appliance dan dekorasi yang belum dipilih.",
    quantity: "1.00",
    unit: "paket",
    unitPrice: formatMinorMoney(looseTotal),
    lineTotal: formatMinorMoney(looseTotal),
    displayOrder: scenario.rooms.length + subconRows.length + 1,
    isBundle: false,
    isHidden: false,
    itemNature: "PRODUCTION",
    createdAt: documentDate,
    updatedAt: documentDate,
  });
  visibleTotal += looseTotal;
  const targetTotal = parseMoneyToMinor(money(scenario.contractValue));
  const mobilizationTarget = parseMoneyToMinor(money(scenario.contractValue * 0.03));
  const roomTarget = targetTotal - visibleTotal - mobilizationTarget;
  const weightTotal = scenario.rooms.reduce((sum, value) => sum + value.quote, 0);
  for (const [roomIndex, roomValue] of scenario.rooms.entries()) {
    const bundleId =
      scenario.key === "brawijaya" && roomIndex === 0
        ? "21212121-2121-2121-2121-212121212101"
        : stableId(5, scenario.sequence, roomIndex + 1);
    const quoteMinor = (roomTarget * BigInt(roomValue.quote)) / BigInt(weightTotal);
    const quantityMinor = parseMoneyToMinor(money(roomValue.quantity));
    const priceIncrement = 100n / greatestCommonDivisor(quantityMinor, 100n);
    const unroundedPrice = (quoteMinor * 100n + quantityMinor / 2n) / quantityMinor;
    const unitPriceMinor =
      ((unroundedPrice + priceIncrement / 2n) / priceIncrement) * priceIncrement;
    const lineTotalMinor = (unitPriceMinor * quantityMinor + 50n) / 100n;
    dataset.rabBundles.push({
      id: bundleId,
      rabEstimateId: rabId,
      clientLabel: roomValue.label,
      description: `${roomValue.area}. ${roomValue.specification} Termasuk bahan joinery, fabrikasi dan pemasangan; paket spesialis pada baris terpisah tidak ditagih ulang di sini.`,
      quantity: money(roomValue.quantity),
      unit: roomValue.unit,
      unitPrice: formatMinorMoney(unitPriceMinor),
      lineTotal: formatMinorMoney(lineTotalMinor),
      displayOrder: roomIndex + 1,
      isHidden: false,
      createdAt: documentDate,
      updatedAt: documentDate,
    });
    visibleTotal += lineTotalMinor;
    for (const source of roomMaterials.get(roomIndex) ?? []) {
      const sourceQuantity = source.totalQuantity;
      const sourcePrice = source.suggestedClientUnitPrice ?? "0.00";
      const sourceTotal =
        (parseMoneyToMinor(sourceQuantity) * parseMoneyToMinor(sourcePrice) + 50n) / 100n;
      dataset.rabItems.push({
        id: stableId(6, scenario.sequence, itemCounter++),
        rabEstimateId: rabId,
        bundleId,
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: source.id,
        sourceProjectCategoryPlanItemId: null,
        sourceLibraryItemId: source.sourceLibraryItemId ?? null,
        sourceRevision: revision,
        sourceUpdatedAt: source.updatedAt,
        clientLabel: source.name,
        description: source.description,
        quantity: sourceQuantity,
        unit: source.unit,
        unitPrice: sourcePrice,
        lineTotal: formatMinorMoney(sourceTotal),
        displayOrder: itemCounter,
        isBundle: true,
        isHidden: false,
        itemNature: "PRODUCTION",
        createdAt: documentDate,
        updatedAt: documentDate,
      });
    }
    const labor = laborRows[roomIndex];
    if (labor)
      dataset.rabItems.push(
        rabFromPlan(labor, rabId, bundleId, scenario.sequence, itemCounter++, documentDate),
      );
    if (scenario.key === "sudirman-revision" && roomIndex === 3) {
      const extra = laborRows[scenario.rooms.length];
      if (extra)
        dataset.rabItems.push(
          rabFromPlan(extra, rabId, bundleId, scenario.sequence, itemCounter++, documentDate),
        );
    }
  }
  const mobilizationTotal = targetTotal - visibleTotal;
  if (mobilizationTotal <= 0n || materials.length < 18)
    throw new Error(`Planning fixture ${scenario.key} tidak lengkap atau melampaui kontrak.`);
  dataset.rabItems.push({
    id: stableId(6, scenario.sequence, itemCounter++),
    rabEstimateId: rabId,
    sourceType: "MANUAL",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: null,
    sourceLibraryItemId: null,
    clientLabel: "Proteksi area, mobilisasi dan serah terima",
    description:
      "Proteksi lantai dan akses gedung, pengiriman bertahap, pembersihan akhir, dokumentasi as-built dan penyerahan garansi. Jasa ini tidak termasuk pada paket instalasi area.",
    quantity: "1.00",
    unit: "paket",
    unitPrice: formatMinorMoney(mobilizationTotal),
    lineTotal: formatMinorMoney(mobilizationTotal),
    displayOrder: scenario.rooms.length + subconRows.length + 2,
    isBundle: false,
    isHidden: false,
    itemNature: "PRODUCTION",
    createdAt: documentDate,
    updatedAt: documentDate,
  });
  if (scenario.key === "brawijaya" || scenario.key === "kemang")
    dataset.rabItems.push({
      id: stableId(6, scenario.sequence, itemCounter),
      rabEstimateId: rabId,
      sourceType: "MANUAL",
      sourceProjectRapItemId: null,
      sourceProjectCategoryPlanItemId: null,
      sourceLibraryItemId: null,
      clientLabel: "Opsi dekorasi tambahan",
      description: "Opsi aksesori yang belum dipilih klien; tidak masuk nilai penawaran aktif.",
      quantity: "1.00",
      unit: "allowance",
      unitPrice: "15000000.00",
      lineTotal: "15000000.00",
      displayOrder: 100,
      isHidden: true,
      isBundle: false,
      itemNature: "PRODUCTION",
      createdAt: documentDate,
      updatedAt: documentDate,
    });
}
function rabFromPlan(
  source: PlanRow,
  rabId: string,
  bundleId: string,
  sequence: number,
  item: number,
  date: Date,
): RabItemRow {
  const quantity = source.quantity ?? "1.00";
  const price = source.suggestedClientUnitPrice ?? "0.00";
  return {
    id: stableId(6, sequence, item),
    rabEstimateId: rabId,
    bundleId,
    sourceType: "CATEGORY_PLAN",
    sourceProjectCategoryPlanItemId: source.id,
    sourceProjectRapItemId: null,
    sourceLibraryItemId: source.sourceLibraryItemId ?? null,
    sourceRevision: source.revision ?? 1,
    sourceUpdatedAt: source.updatedAt,
    clientLabel: source.name,
    description: source.scopeDescription,
    quantity,
    unit: source.unit ?? "paket",
    unitPrice: price,
    lineTotal: formatMinorMoney(
      (parseMoneyToMinor(quantity) * parseMoneyToMinor(price) + 50n) / 100n,
    ),
    displayOrder: item,
    isBundle: true,
    isHidden: false,
    itemNature: "PRODUCTION",
    createdAt: date,
    updatedAt: date,
  };
}
function addAllocations(
  dataset: DevelopmentPlanningDataset,
  index: number,
  scenario: DevelopmentPlanningScenario,
): void {
  const contract = index === 2 ? 1200000000 : Number(scenario.contractValue);
  const cap = parseMoneyToMinor(money(contract * 0.9));
  const planned: Record<CategoryCode, bigint> = {
    MATERIAL: parseMoneyToMinor(scenario.plannedMaterialCost),
    TUKANG: parseMoneyToMinor(scenario.plannedTukangCost),
    SUBCON: parseMoneyToMinor(scenario.plannedSubconCost),
    OPERASIONAL: parseMoneyToMinor(money(contract * 0.035)),
    LAIN_LAIN: parseMoneyToMinor(money(contract * 0.02)),
  };
  const allocated: Record<CategoryCode, bigint> = {
    MATERIAL: (planned.MATERIAL * 115n) / 100n,
    TUKANG: (planned.TUKANG * 115n) / 100n,
    SUBCON: (planned.SUBCON * 115n) / 100n,
    OPERASIONAL: planned.OPERASIONAL,
    LAIN_LAIN: planned.LAIN_LAIN,
  };
  let remaining = cap - Object.values(allocated).reduce((sum, value) => sum + value, 0n);
  if (remaining < 0n) throw new Error(`Planned execution ${scenario.key} melebihi internal cap.`);
  allocated.MATERIAL += remaining / 2n;
  allocated.TUKANG += remaining / 4n;
  allocated.SUBCON += remaining - remaining / 2n - remaining / 4n;
  if (index === 6) {
    // Review story: proposed countertop has not received a Subcon allocation yet.
    allocated.MATERIAL += allocated.SUBCON;
    allocated.SUBCON = 0n;
  }
  remaining = cap - Object.values(allocated).reduce((sum, value) => sum + value, 0n);
  if (remaining !== 0n) throw new Error("Category allocations tidak menjumlah ke internal cap.");
  const categories: readonly CategoryCode[] = [
    "TUKANG",
    "MATERIAL",
    "OPERASIONAL",
    "LAIN_LAIN",
    "SUBCON",
  ];
  for (const [position, category] of categories.entries()) {
    const amount = formatMinorMoney(allocated[category]);
    const ratio = (Number(allocated[category]) / Number(cap)).toFixed(6);
    if (index >= 7)
      dataset.newBudgetCategories.push({
        id: categoryId(index, category),
        projectBudgetId: budgetId(index),
        expenseCategoryId: expenseCategoryId(category),
        ratioPercentage: ratio,
        allocatedAmount: amount,
        pendingAmount: "0.00",
        actualAmount: "0.00",
        paidAmount: "0.00",
        remainingAmount: amount,
        usedPercentage: "0.0000",
        status: "SAFE",
        sortOrder: (position + 1) * 10,
        isManualOverride: true,
      });
    else
      dataset.categoryAllocationUpdates.push({
        id: categoryId(index, category),
        allocatedAmount: amount,
        ratioPercentage: ratio,
        isManualOverride: true,
      });
  }
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  while (right !== 0n) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}
function addCancelledMentengRevision(dataset: DevelopmentPlanningDataset, clock: DemoClock): void {
  const baselineId = "19191919-1919-1919-1919-191919191901";
  const revisedId = "19191919-1919-1919-1919-191919191904";
  const baseline = dataset.rabEstimates.find((row) => row.id === baselineId);
  if (!baseline) throw new Error("RAB baseline Menteng tidak ditemukan.");
  const createdAt = clock.day(-14, 9);
  const cancelledAt = clock.day(-12, 16);
  dataset.replaceRabEstimateIds.push(revisedId);
  dataset.rabEstimates.push({
    ...baseline,
    id: revisedId,
    revision: 2,
    supersedesRabEstimateId: baselineId,
    status: "VOID",
    approvedValue: "0.00",
    approvedAt: null,
    title: "RAB Revisi Area Mini Bar Menteng · Dibatalkan",
    clientNotes:
      "Scope kontrak awal tetap lengkap. Opsi mini bar Rp90.000.000 menambah penawaran menjadi Rp890.000.000 sebelum klien membatalkan opsi tersebut.",
    voidReason: "Klien mempertahankan layout awal dan membatalkan area mini bar.",
    voidedById: DEMO_IDS.users.finance,
    voidedAt: cancelledAt,
    createdAt,
    updatedAt: cancelledAt,
  });
  const bundleMap = new Map<string, string>();
  const baselineBundles = dataset.rabBundles.filter((row) => row.rabEstimateId === baselineId);
  for (const [index, row] of baselineBundles.entries()) {
    if (!row.id) throw new Error("Bundle baseline Menteng membutuhkan ID.");
    const newId = stableId(5, 9, index + 1);
    bundleMap.set(row.id, newId);
    dataset.rabBundles.push({
      ...row,
      id: newId,
      rabEstimateId: revisedId,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const baselineItems = dataset.rabItems.filter((row) => row.rabEstimateId === baselineId);
  for (const [index, row] of baselineItems.entries())
    dataset.rabItems.push({
      ...row,
      id: stableId(6, 9, index + 1),
      rabEstimateId: revisedId,
      bundleId: row.bundleId ? (bundleMap.get(row.bundleId) ?? null) : null,
      createdAt,
      updatedAt: createdAt,
    });
  dataset.rabItems.push({
    id: "20202020-2020-2020-2020-202020202010",
    rabEstimateId: revisedId,
    sourceType: "MANUAL",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: null,
    sourceLibraryItemId: null,
    clientLabel: "Opsi mini bar living area",
    description:
      "Tambahan kabinet mini bar 3 m1, sink kecil, rak display dan relokasi plumbing. Opsi dibatalkan sebelum persetujuan; tidak menjadi pengeluaran atau kontrak aktif.",
    quantity: "1.00",
    unit: "paket",
    unitPrice: "90000000.00",
    lineTotal: "90000000.00",
    displayOrder: 20,
    isHidden: false,
    isBundle: false,
    itemNature: "PRODUCTION",
    createdAt,
    updatedAt: createdAt,
  });
}
