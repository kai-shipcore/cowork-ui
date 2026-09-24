import type {
  ApprovalGrant,
  ApprovalType,
  ShapeAssignment,
} from '@/shared/types/db-workflow';
import type {
  AppUser,
  Complaint,
  Dealer,
  MasterProduct,
  MasterProductPackaging,
  MasterProductSku,
  ProductReferenceItem,
  ProductTypeId,
  SampleRequest,
  SampleRequestItem,
  SampleShipment,
  SeatCoverCode,
  SeatCoverCodeOptionValue,
  SeatCoverPart,
  UniqueVehicle,
  VehicleConfiguration,
  VehicleOptionKey,
  VehicleOptionValue,
  VehicleProductRegistration,
  VehicleProductRegistrationItem,
  VehicleProductShape,
  VehicleProjectGroup,
  VehicleZone,
  VehicleZoneProject,
  Visit,
} from '@/shared/types/workbench';

const WORKBENCH_TIME_ZONE = 'America/Los_Angeles';

/**
 * A day in the month the operator is looking at right now.
 *
 * Seed visits carry no meaning of their own — they exist so the month
 * calendar opens with something on it. Fixed dates would drift out of the
 * current month and leave that screen blank, so the day is offset from today
 * and clamped into this month.
 */
function dayThisMonth(offsetFromToday: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WORKBENCH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = value('year');
  const month = value('month');
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(value('day') + offsetFromToday, 1), lastDay);
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Date of the seeded SCAN visit VS-01, shared with the project detail seed. */
export const SEED_SCAN_VISIT_DATE = dayThisMonth(6);

function createZoneProjects(
  projectGroupId: string,
  productTypeId: string,
  vehicleResearchId: string,
  zones: readonly (readonly [string, string])[],
  currentStage: VehicleZoneProject['currentStage'],
  productShapeByZone: Readonly<Record<string, string>> = {},
): readonly VehicleZoneProject[] {
  return zones.map(([code, label]) => ({
    id: `${projectGroupId}-${code}`,
    projectGroupId,
    productTypeId,
    vehicleResearchId,
    zoneId: `ZONE-${productTypeId.replace('PT-', '')}-${code}`,
    code,
    label,
    managerId: 'USR-KAI',
    currentStage,
    status: 'ACTIVE',
    priority: code === 'F' ? 'HIGH' : 'NORMAL',
    ...(currentStage !== 'Approved'
      ? {
          targetAt: `2026-09-${code === 'F' ? '03' : code === 'B' ? '08' : '12'}T17:00:00-07:00`,
        }
      : {}),
    lastActivityAt: `2026-09-${code === 'F' ? '02' : code === 'B' ? '01' : '01'}T09:00:00-07:00`,
    ...(productShapeByZone[code]
      ? { productShapeId: productShapeByZone[code] }
      : {}),
  }));
}

const REFERENCE_TIMESTAMP = '2026-07-01T09:00:00-07:00';

function base(
  id: string,
  productTypeId: ProductTypeId,
  code: string,
  name: string,
): ProductReferenceItem {
  return {
    id,
    productTypeId,
    code,
    name,
    createdAt: REFERENCE_TIMESTAMP,
    updatedAt: REFERENCE_TIMESTAMP,
  };
}

// Codes come from the internal "SKU Format" document and are emitted verbatim
// into generated SKUs, so they must never be invented.
export const PRODUCT_MATERIALS: readonly ProductReferenceItem[] = [
  base('MAT-SC-10', 'PT-SC', '10', 'Oxford'),
  base('MAT-CC-03', 'PT-CC', '03', 'PVC'),
  base('MAT-CC-07', 'PT-CC', '07', 'TPU'),
  base('MAT-CC-10', 'PT-CC', '10', 'Oxford'),
  base('MAT-CC-15', 'PT-CC', '15', 'Pongee'),
  // TODO: confirm the material name for Floor Mat code 80 — described only as
  // a "rubber-like PVC mat material".
  base('MAT-FM-80', 'PT-FM', '80', 'PVC (Mat)'),
];

// Renamed codes (BKGR -> BKLG, GRBK -> LGBK) are seeded with the new code
// only; the old spellings may still exist on previously issued SKUs.
//
// Floor Mat has no colour code and ships in a single colour, but
// `vehicle_cover_product.product_color_id` is NOT NULL — so one placeholder
// row exists purely to satisfy the FK. It is never rendered into a SKU, and
// there is deliberately no second row: the Floor Mat SKU is determined by
// material + F# alone, so a second colour would collide on the UNIQUE sku.
export const PRODUCT_COLORS: readonly ProductReferenceItem[] = [
  base('CLR-SC-BE', 'PT-SC', 'BE', 'Beige'),
  base('CLR-SC-BK', 'PT-SC', 'BK', 'Black'),
  base('CLR-SC-GR', 'PT-SC', 'GR', 'Gray'),
  base('CLR-SC-DG', 'PT-SC', 'DG', 'Dark Gray'),
  base('CLR-SC-BR', 'PT-SC', 'BR', 'Brown'),
  base('CLR-SC-DB', 'PT-SC', 'DB', 'Dark Brown'),
  base('CLR-SC-WR', 'PT-SC', 'WR', 'Wine Red'),
  base('CLR-SC-PK', 'PT-SC', 'PK', 'Pink'),
  base('CLR-SC-RD', 'PT-SC', 'RD', 'Red'),
  base('CLR-SC-WH', 'PT-SC', 'WH', 'White'),
  base('CLR-SC-OR', 'PT-SC', 'OR', 'Orange'),
  base('CLR-SC-BKRD', 'PT-SC', 'BKRD', 'Black Red'),
  base('CLR-SC-BKWH', 'PT-SC', 'BKWH', 'Black White'),
  base('CLR-CC-BK', 'PT-CC', 'BK', 'Black'),
  base('CLR-CC-GR', 'PT-CC', 'GR', 'Gray'),
  base('CLR-CC-BKLG', 'PT-CC', 'BKLG', 'Black Light-Gray'),
  base('CLR-CC-BKRD', 'PT-CC', 'BKRD', 'Black Red'),
  base('CLR-CC-LGBK', 'PT-CC', 'LGBK', 'Light-Gray Black'),
  base('CLR-CC-DGBK', 'PT-CC', 'DGBK', 'Dark-Gray Black'),
  base('CLR-CC-BLLG', 'PT-CC', 'BLLG', 'Blue Light-Gray'),
  base('CLR-FM-NA', 'PT-FM', 'NA', 'Single Color (no code)'),
];

function stamped<T extends object>(row: T) {
  return {
    ...row,
    createdAt: REFERENCE_TIMESTAMP,
    updatedAt: REFERENCE_TIMESTAMP,
  };
}

export const APP_USERS: readonly AppUser[] = [
  stamped({
    id: 'USR-KAI',
    email: 'kai.c@shipcore.com',
    name: 'Kai',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'USR-YOUNG',
    email: 'young@coverland.com',
    name: 'Young',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'USR-CHRISTIAN',
    email: 'christian@coverland.com',
    name: 'Christian',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'USR-JH',
    email: 'jh@coverland.com',
    name: 'JH',
    status: 'ACTIVE' as const,
    designerInitial: 'J',
  }),
  stamped({
    id: 'USR-TAEHO',
    email: 'taeho@coverland.com',
    name: 'Taeho',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'USR-MIN',
    email: 'min@coverland.com',
    name: 'Min',
    status: 'ACTIVE' as const,
    designerInitial: 'M',
  }),
  stamped({
    id: 'USR-SOO',
    email: 'soo@coverland.com',
    name: 'Soo',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'USR-DANIEL',
    email: 'daniel@coverland.com',
    name: 'Daniel',
    status: 'INACTIVE' as const,
  }),
];

export const VEHICLE_ZONES: readonly VehicleZone[] = [
  stamped({
    id: 'ZONE-SC-F',
    productTypeId: 'PT-SC',
    code: 'F',
    name: 'Front Row',
  }),
  stamped({
    id: 'ZONE-SC-B',
    productTypeId: 'PT-SC',
    code: 'B',
    name: '2nd Row',
  }),
  stamped({
    id: 'ZONE-SC-E',
    productTypeId: 'PT-SC',
    code: 'E',
    name: '3rd Row',
  }),
  stamped({
    id: 'ZONE-FM-F',
    productTypeId: 'PT-FM',
    code: 'F',
    name: '1st Row Floor',
  }),
  stamped({
    id: 'ZONE-FM-B',
    productTypeId: 'PT-FM',
    code: 'B',
    name: '2nd Row Floor',
  }),
  stamped({
    id: 'ZONE-CC-EX',
    productTypeId: 'PT-CC',
    code: 'EX',
    name: 'Exterior',
  }),
  stamped({
    id: 'ZONE-SWC-W',
    productTypeId: 'PT-SWC',
    code: 'W',
    name: 'Steering Wheel',
  }),
  stamped({
    id: 'ZONE-WS-F',
    productTypeId: 'PT-WS',
    code: 'F',
    name: 'Front Windshield',
  }),
];

// Migrated out of the hardcoded CONFIGURATION_VALUES constant that used to
// live in the Vehicle Research screen. Car Cover charts are untitled, so they
// carry the single generic `Submodel` key (DDL note on vehicle_option_key).
const OPTION_DICTIONARY: readonly (readonly [
  ProductTypeId,
  string,
  readonly string[],
])[] = [
  ['PT-SC', 'Powertrain', ['Hybrid', 'Gas', 'EV', 'Plug-in Hybrid']],
  ['PT-SC', 'Body', ['Sedan', 'Coupe', 'Wagon', 'Hatchback', 'Touring']],
  ['PT-SC', 'Seats', ['5 Seats', '7 Seats', '8 Seats', '2 Seats']],
  [
    'PT-SC',
    'Front Seat',
    [
      'Bucket',
      'Bucket w/ Manual Controls',
      'Bucket w/ Driver Side Power Controls',
      'Captain',
    ],
  ],
  [
    'PT-SC',
    '2nd Row Seat',
    [
      'Bench',
      'Bench w/ separated headrest',
      'Bench w/ integrated headrest',
      'Captain',
    ],
  ],
  ['PT-SC', '3rd Row Seat', ['Bench', 'Captain', 'N/A']],
  ['PT-SC', 'Headrest', ['Adjustable', 'Integrated', 'Fixed']],
  ['PT-SC', 'Seat Controls', ['Manual', 'Power', 'Driver Side Power']],
  ['PT-SC', 'Armrest', ['With Armrest', 'Without Armrest']],
  ['PT-SC', 'Seatbelt', ['Seat Integrated', 'Pillar Mounted']],
  ['PT-SC', 'Console', ['With Console', 'Without Console']],
  ['PT-SC', 'Under-seat Storage', ['No Storage', 'With Storage']],
  ['PT-FM', 'Powertrain', ['Hybrid', 'Gas', 'EV']],
  ['PT-FM', 'Seats', ['5 Seats', '7 Seats']],
  ['PT-CC', 'Submodel', ['Base', 'Sport', 'Long Wheelbase']],
];

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase();
}

function optionKeyId(productTypeId: ProductTypeId, name: string): string {
  return `VOK-${productTypeId.replace('PT-', '')}-${slug(name)}`;
}

/** Stable id for an option value, used by the seat-cover-code links below. */
export function optionValueId(
  productTypeId: ProductTypeId,
  keyName: string,
  value: string,
): string {
  return `VOV-${productTypeId.replace('PT-', '')}-${slug(keyName)}-${slug(value)}`;
}

export const VEHICLE_OPTION_KEYS: readonly VehicleOptionKey[] =
  OPTION_DICTIONARY.map(([productTypeId, name]) =>
    stamped({ id: optionKeyId(productTypeId, name), productTypeId, name }),
  );

export const VEHICLE_OPTION_VALUES: readonly VehicleOptionValue[] =
  OPTION_DICTIONARY.flatMap(([productTypeId, name, values]) =>
    values.map((value) =>
      stamped({
        id: optionValueId(productTypeId, name, value),
        vehicleOptionKeyId: optionKeyId(productTypeId, name),
        value,
      }),
    ),
  );

// `isCustom: false` rows are the closed legacy universal set — the part IS its
// own pattern, hence vehicleProductDesignId. New parts are always custom.
export const SEAT_COVER_PARTS: readonly SeatCoverPart[] = [
  stamped({
    id: 'SCP-FH-D',
    name: 'FH-D',
    description: 'Front headrest, universal legacy part',
    vehicleZoneId: 'ZONE-SC-F',
    category: 'HEADREST',
    isForMiddleSeat: false,
    isCustom: false,
    vehicleProductDesignId: 'VPD-FH-D',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCP-BT-D',
    name: 'BT-D',
    description: '2nd row top, universal legacy part',
    vehicleZoneId: 'ZONE-SC-B',
    category: 'TOP',
    isForMiddleSeat: false,
    isCustom: false,
    vehicleProductDesignId: 'VPD-BT-D',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCP-FA',
    name: 'FA',
    vehicleZoneId: 'ZONE-SC-F',
    category: 'ARM',
    isForMiddleSeat: false,
    isCustom: true,
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCP-FH',
    name: 'FH',
    vehicleZoneId: 'ZONE-SC-F',
    category: 'HEADREST',
    isForMiddleSeat: false,
    isCustom: true,
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCP-FB',
    name: 'FB',
    vehicleZoneId: 'ZONE-SC-F',
    category: 'BOTTOM',
    isForMiddleSeat: false,
    isCustom: true,
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCP-FMB',
    name: 'FMB',
    description: 'Middle-seat variant of FB',
    vehicleZoneId: 'ZONE-SC-F',
    category: 'BOTTOM',
    isForMiddleSeat: true,
    isCustom: true,
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCP-BB',
    name: 'BB',
    vehicleZoneId: 'ZONE-SC-B',
    category: 'BOTTOM',
    isForMiddleSeat: false,
    isCustom: true,
    status: 'ACTIVE' as const,
  }),
];

export const SEAT_COVER_CODES: readonly SeatCoverCode[] = [
  stamped({
    id: 'SCC-424BEN',
    code: '424BEN',
    description: '40/20/40 split-cushion bench',
    status: 'ACTIVE' as const,
  }),
  stamped({
    id: 'SCC-46BENMEG',
    code: '46BENMEG',
    description: '40/60 bench, middle seat integrated headrest',
    status: 'ACTIVE' as const,
  }),
];

export const SEAT_COVER_CODE_OPTION_VALUES: readonly SeatCoverCodeOptionValue[] =
  [
    stamped({
      id: 'SCCX-424BEN-BENCH',
      seatCoverCodeId: 'SCC-424BEN',
      vehicleOptionValueId: optionValueId('PT-SC', '2nd Row Seat', 'Bench'),
    }),
    stamped({
      id: 'SCCX-424BEN-5SEATS',
      seatCoverCodeId: 'SCC-424BEN',
      vehicleOptionValueId: optionValueId('PT-SC', 'Seats', '5 Seats'),
    }),
    stamped({
      id: 'SCCX-46BENMEG-INTEGRATED',
      seatCoverCodeId: 'SCC-46BENMEG',
      vehicleOptionValueId: optionValueId(
        'PT-SC',
        '2nd Row Seat',
        'Bench w/ integrated headrest',
      ),
    }),
  ];

function shape(
  id: string,
  productTypeId: ProductTypeId,
  name: string,
): VehicleProductShape {
  return {
    id,
    productTypeId,
    name,
    status: 'ACTIVE',
    source: 'NEW',
    ...(productTypeId === 'PT-CC'
      ? {
          dimensions: {
            length: 480,
            frontWidth: 190,
            backWidth: 190,
            height: 140,
            unit: 'CM' as const,
          },
        }
      : {}),
    createdBy: 'USR-KAI',
    createdAt: REFERENCE_TIMESTAMP,
  };
}

// `vehicle_product_shape.name` IS the SKU's size segment — Seat Cover renders
// it whole (`F-10`), Car Cover splits it at the first hyphen around the
// material (`CN-M` -> `CC-CN-{material}-M`). Floor Mat shapes are molds and
// never appear in a SKU.
export const VEHICLE_PRODUCT_SHAPES: readonly VehicleProductShape[] = [
  shape('SHP-SC-F-10', 'PT-SC', 'F-10'),
  shape('SHP-SC-B-40', 'PT-SC', 'B-40'),
  shape('SHP-SC-R-90', 'PT-SC', 'R-90'),
  shape('SHP-SC-E-12', 'PT-SC', 'E-12'),
  shape('SHP-CC-CN-M', 'PT-CC', 'CN-M'),
  shape('SHP-CC-CN-B', 'PT-CC', 'CN-B'),
  shape('SHP-CC-CS-H', 'PT-CC', 'CS-H'),
  shape('SHP-CC-SN-B', 'PT-CC', 'SN-B'),
  shape('SHP-FM-S1-TT-SI03', 'PT-FM', 'S1-TT-SI03'),
  shape('SHP-FM-S2-TT-SI03', 'PT-FM', 'S2-TT-SI03'),
];

export const VEHICLE_CONFIGURATIONS: readonly VehicleConfiguration[] = [
  {
    id: 'c01',
    vehicle: '2023–2026 Toyota RAV4',
    vehicleClass: 'SUV',
    options: [
      ['Powertrain', 'Hybrid'],
      ['Seats', '5 Seats'],
      ['Front Seat', 'Bucket'],
      ['2nd Row Seat', 'Bench'],
      ['Headrest', 'Adjustable'],
      ['Under-seat Storage', 'No Storage'],
    ],
    researchStatus: 'COMPLETE',
    projectGroupIds: ['PG-00124', 'PG-00126'],
  },
  {
    id: 'c02',
    vehicle: '2023–2026 Toyota RAV4',
    vehicleClass: 'SUV',
    options: [
      ['Powertrain', 'Hybrid'],
      ['Seats', '5 Seats'],
      ['Front Seat', 'Bucket'],
      ['2nd Row Seat', 'Bench'],
      ['Under-seat Storage', 'With Storage'],
    ],
    researchStatus: 'COMPLETE',
    projectGroupIds: [],
  },
  {
    id: 'c03',
    vehicle: '2023–2026 Toyota RAV4',
    vehicleClass: 'SUV',
    options: [
      ['Powertrain', 'Gas'],
      ['Seats', '5 Seats'],
      ['Front Seat', 'Bucket'],
      ['Headrest', 'Fixed'],
    ],
    researchStatus: 'RESEARCHING',
    projectGroupIds: [],
  },
  {
    id: 'c04',
    vehicle: '2026 Honda CR-V',
    vehicleClass: 'SUV',
    options: [
      ['Powertrain', 'Hybrid'],
      ['2nd Row Seat', 'Bench'],
      ['Headrest', 'Adjustable'],
    ],
    researchStatus: 'COMPLETE',
    projectGroupIds: ['PG-00125'],
  },
  {
    id: 'c05',
    vehicle: '2023–2026 Toyota Highlander',
    vehicleClass: 'SUV',
    options: [
      ['Powertrain', 'Hybrid'],
      ['Seats', '7 Seats'],
      ['2nd Row Seat', 'Captain'],
      ['3rd Row Seat', 'Bench'],
    ],
    researchStatus: 'COMPLETE',
    projectGroupIds: ['PG-00127'],
  },
  {
    id: 'c06',
    vehicle: '2025 Toyota Camry',
    vehicleClass: 'Sedan',
    options: [
      ['Powertrain', 'Hybrid'],
      ['Body', 'Sedan'],
      ['Seats', '5 Seats'],
      ['2nd Row Seat', 'Bench'],
    ],
    researchStatus: 'COMPLETE',
    projectGroupIds: ['PG-00122'],
  },
  {
    id: 'c07',
    vehicle: '2024 Ford Mustang',
    vehicleClass: 'Coupe',
    options: [
      ['Powertrain', 'Gas'],
      ['Body', 'Coupe'],
      ['Seats', '2 Seats'],
    ],
    researchStatus: 'COMPLETE',
    projectGroupIds: ['PG-00118'],
  },
];

export const VEHICLE_PROJECTS: readonly VehicleProjectGroup[] = [
  {
    id: 'PG-00118',
    productTypeId: 'PT-CC',
    vehicle: '2024 Ford Mustang',
    vehicleResearchId: 'c07',
    options: VEHICLE_CONFIGURATIONS[6]?.options ?? [],
    product: 'Car Cover',
    zoneProjects: createZoneProjects(
      'PG-00118',
      'PT-CC',
      'c07',
      [['EX', 'Exterior']],
      'Sample',
      { EX: 'SHAPE-CC-MUSTANG-EX' },
    ),
    stage: 'Sample',
    status: 'IN PROGRESS',
    created: '2026-07-10',
  },
  {
    id: 'PG-00122',
    productTypeId: 'PT-FM',
    vehicle: '2025 Toyota Camry',
    vehicleResearchId: 'c06',
    options: VEHICLE_CONFIGURATIONS[5]?.options ?? [],
    product: 'Floor Mat',
    zoneProjects: createZoneProjects(
      'PG-00122',
      'PT-FM',
      'c06',
      [
        ['F', '1st Row'],
        ['B', '2nd Row'],
      ],
      'Sample',
      { F: 'SHAPE-FM-CAMRY-F', B: 'SHAPE-FM-CAMRY-B' },
    ),
    stage: 'Sample',
    status: 'IN PROGRESS',
    created: '2026-07-24',
  },
  {
    id: 'PG-00124',
    productTypeId: 'PT-SC',
    vehicle: '2023–2026 Toyota RAV4',
    vehicleResearchId: 'c01',
    options: VEHICLE_CONFIGURATIONS[0]?.options ?? [],
    product: 'Seat Cover',
    zoneProjects: createZoneProjects(
      'PG-00124',
      'PT-SC',
      'c01',
      [
        ['F', 'Front Row'],
        ['B', '2nd Row'],
      ],
      'Scan',
    ),
    stage: 'Scan',
    status: 'IN PROGRESS',
    created: '2026-08-02',
  },
  {
    id: 'PG-00125',
    productTypeId: 'PT-SC',
    vehicle: '2026 Honda CR-V',
    vehicleResearchId: 'c04',
    options: VEHICLE_CONFIGURATIONS[3]?.options ?? [],
    product: 'Seat Cover',
    zoneProjects: createZoneProjects(
      'PG-00125',
      'PT-SC',
      'c04',
      [
        ['F', 'Front Row'],
        ['B', '2nd Row'],
      ],
      'Design',
      { F: 'SHAPE-SC-CRV-F', B: 'SHAPE-SC-CRV-B' },
    ),
    stage: 'Design',
    status: 'IN PROGRESS',
    created: '2026-08-10',
  },
  {
    id: 'PG-00126',
    productTypeId: 'PT-FM',
    vehicle: '2023–2026 Toyota RAV4',
    vehicleResearchId: 'c01',
    options: VEHICLE_CONFIGURATIONS[0]?.options ?? [],
    product: 'Floor Mat',
    zoneProjects: createZoneProjects(
      'PG-00126',
      'PT-FM',
      'c01',
      [
        ['F', '1st Row'],
        ['B', '2nd Row'],
      ],
      'Vehicle Hunt',
    ),
    stage: 'Vehicle Hunt',
    status: 'IN PROGRESS',
    created: '2026-08-18',
  },
  {
    id: 'PG-00127',
    productTypeId: 'PT-CC',
    vehicle: '2023–2026 Toyota Highlander',
    vehicleResearchId: 'c05',
    options: VEHICLE_CONFIGURATIONS[4]?.options ?? [],
    product: 'Car Cover',
    zoneProjects: createZoneProjects(
      'PG-00127',
      'PT-CC',
      'c05',
      [['EX', 'Exterior']],
      '3D Model',
      { EX: 'SHAPE-CC-HIGHLANDER-EX' },
    ),
    stage: '3D Model',
    status: 'IN PROGRESS',
    created: '2026-08-19',
  },
];

export const VISITS: readonly Visit[] = [
  {
    id: 'VS-01',
    vehicle: '2023–2026 Toyota RAV4',
    projectGroupId: 'PG-00124',
    product: 'Seat Cover',
    vehicleProjectIds: ['PG-00124-F'],
    dealer: 'Galpin Ford',
    date: SEED_SCAN_VISIT_DATE,
    time: '10:00',
    taskIds: [],
    staffIds: ['USR-YOUNG'],
    kind: 'SCAN',
    status: 'SCHEDULED',
  },
  {
    id: 'VS-02',
    vehicle: '2026 Honda CR-V',
    projectGroupId: 'PG-00125',
    product: 'Seat Cover',
    vehicleProjectIds: ['PG-00125-F', 'PG-00125-B'],
    dealer: 'AutoNation Toyota Cerritos',
    date: dayThisMonth(-1),
    time: '13:30',
    taskIds: [],
    kind: 'SCAN',
    status: 'COMPLETED',
  },
];

export const DEALERS: readonly Dealer[] = [
  {
    id: 'd1',
    name: 'Galpin Ford',
    brand: 'Ford / Lincoln',
    type: 'Dealer',
    address: 'North Hills, CA',
    contact: 'J. Alvarez · (818) 555-0134',
    note: 'Friday morning visits preferred',
    lastVisit: '08/07',
  },
  {
    id: 'd2',
    name: 'AutoNation Toyota Cerritos',
    brand: 'Toyota',
    type: 'Dealer',
    address: 'Cerritos, CA',
    contact: 'Front desk',
    note: 'Appointment required',
    lastVisit: '08/17',
  },
  {
    id: 'd3',
    name: 'Enterprise Rent-A-Car',
    brand: 'Rental vehicles — all brands',
    type: 'Rental',
    address: 'Van Nuys, CA',
    contact: 'M. Chen · (818) 555-0192',
    note: 'Check mileage limits',
    lastVisit: '07/29',
  },
  {
    id: 'd4',
    name: 'LA Auto Partner',
    brand: 'Older / discontinued vehicles',
    type: 'Partner',
    address: 'Signal Hill, CA',
    contact: 'D. Whitman · (562) 555-0102',
    note: 'Contact in advance',
    lastVisit: '07/08',
  },
];

export const COMPLAINTS: readonly Complaint[] = [
  {
    id: 'CP-0021',
    fNumber: 'F#20831',
    vehicle: '2021–2024 Ford Bronco',
    product: 'Seat Cover',
    issue: 'Front headrest cover is too tight after installation.',
    design: 'FH-J-D',
    revision: 'Rev 2 → Rev 3',
    reported: '2026-08-14',
    owner: 'JH',
    status: 'REWORK',
  },
  {
    id: 'CP-0019',
    fNumber: 'F#20798',
    vehicle: '2022–2025 Hyundai Tucson',
    product: 'Floor Mat',
    issue: 'Driver mat retention hole alignment check.',
    design: 'S1-TT03',
    revision: 'Rev 1',
    reported: '2026-08-05',
    owner: 'Kai',
    status: 'OPEN',
  },
  {
    id: 'CP-0014',
    fNumber: 'F#20672',
    vehicle: '2020–2023 Tesla Model Y',
    product: 'Car Cover',
    issue: 'Mirror pocket fit verified; product is normal.',
    design: 'TEMY02',
    revision: 'Rev 2',
    reported: '2026-07-18',
    owner: 'Christian',
    status: 'RESOLVED',
  },
];

export const SAMPLE_REQUESTS: readonly SampleRequest[] = [
  // Camry round 1: received and superseded by the round-2 request below. The
  // CR-V Seat Cover project deliberately has no sample yet, so it stays a
  // clean Design-stage example after "Reset Mock Data".
  {
    id: 'SR-1039',
    projectGroupId: 'PG-00122',
    vehicle: '2025 Toyota Camry',
    product: 'Floor Mat',
    factory: 'Ningbo Ruixin',
    sentAt: '2026-08-05T09:00:00-07:00',
    sentBy: 'USR-KAI',
    createdAt: '2026-08-05T08:30:00-07:00',
  },
  {
    id: 'SR-1041',
    projectGroupId: 'PG-00122',
    vehicle: '2025 Toyota Camry',
    product: 'Floor Mat',
    factory: 'Ningbo Ruixin',
    sentAt: '2026-08-12T09:00:00-07:00',
    sentBy: 'USR-KAI',
    createdAt: '2026-08-12T08:30:00-07:00',
  },
  {
    id: 'SR-1040',
    projectGroupId: 'PG-00118',
    vehicle: '2024 Ford Mustang',
    product: 'Car Cover',
    factory: 'Qingdao TX',
    createdAt: '2026-08-09T08:30:00-07:00',
  },
];

export const SAMPLE_SHIPMENTS: readonly SampleShipment[] = [
  {
    id: 'SHIP-499',
    factory: 'Ningbo Ruixin',
    sampleReadyAt: '2026-08-07T10:00:00-07:00',
    shippedAt: '2026-08-08T09:00:00-07:00',
    expectedArrivalDate: '2026-08-14',
    arrivedAt: '2026-08-13T15:20:00-07:00',
    externalReference: 'SF-284910573',
  },
  {
    id: 'SHIP-500',
    factory: 'Ningbo Ruixin',
    sampleReadyAt: '2026-08-14T10:00:00-07:00',
    shippedAt: '2026-08-15T09:00:00-07:00',
    expectedArrivalDate: '2026-08-24',
    externalReference: 'UPS-1Z38W049',
  },
];

export const SAMPLE_REQUEST_ITEMS: readonly SampleRequestItem[] = [
  ...Array.from({ length: 3 }, (_, index) => ({
    id: `SRI-1039-${String(index + 1)}`,
    sampleRequestId: 'SR-1039',
    vehicleProductDesignId: `DS-CAMRY-${String(index + 1)}`,
    vehicleProductDesignRevisionId: `REV-CAMRY-${String(index + 1)}-1`,
    sampleRound: 1,
    priority: 'NORMAL' as const,
    sampleReceivedAt: '2026-08-13T15:20:00-07:00',
    sampleShipmentId: 'SHIP-499',
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    id: `SRI-1041-${String(index + 1)}`,
    sampleRequestId: 'SR-1041',
    vehicleProductDesignId: `DS-CAMRY-${String(index + 1)}`,
    vehicleProductDesignRevisionId: `REV-CAMRY-${String(index + 1)}-2`,
    sampleRound: 2,
    priority: index === 0 ? ('URGENT' as const) : ('NORMAL' as const),
    sampleShipmentId: 'SHIP-500',
  })),
  {
    id: 'SRI-1040-1',
    sampleRequestId: 'SR-1040',
    vehicleProductDesignId: 'DS-MUSTANG-1',
    vehicleProductDesignRevisionId: 'REV-MUSTANG-1-1',
    sampleRound: 1,
    priority: 'NORMAL',
  },
];

// F# is issued per vehicle + product type, so the prefix mirrors the product
// category (SC / CC / FM). Floor Mat SKUs embed this value verbatim.
export const UNIQUE_VEHICLES: readonly UniqueVehicle[] = [
  {
    fNumber: 'SC20855',
    vehicle: '2026 Honda CR-V',
    product: 'Seat Cover',
    vehicleResearchId: 'c04',
    options: [
      ['Powertrain', 'Hybrid'],
      ['2nd Row Seat', 'Bench'],
      ['Headrest', 'Adjustable'],
    ],
    projectGroupId: 'PG-00125',
    shapes: ['SHP-SC-F-10', 'SHP-SC-B-40'],
    skuStatus: 'DRAFT',
  },
  {
    fNumber: 'CC20854',
    vehicle: '2024 Ford Mustang',
    product: 'Car Cover',
    vehicleResearchId: 'c07',
    options: [
      ['Body', 'Coupe'],
      ['Seats', '2 Seats'],
    ],
    projectGroupId: 'PG-00118',
    shapes: ['SHP-CC-CN-M'],
    skuStatus: 'DRAFT',
  },
  {
    fNumber: 'FM10237',
    vehicle: '2025 Toyota Camry',
    product: 'Floor Mat',
    vehicleResearchId: 'c06',
    options: [
      ['Powertrain', 'Hybrid'],
      ['Body', 'Sedan'],
      ['Seats', '5 Seats'],
    ],
    projectGroupId: 'PG-00122',
    shapes: ['SHP-FM-S1-TT-SI03', 'SHP-FM-S2-TT-SI03'],
    skuStatus: 'DRAFT',
  },
];

/**
 * Current PRIMARY Shape per zone for the demo F# vehicles, so a registration
 * request can be raised without first walking through the assignment panel.
 */
export const SHAPE_ASSIGNMENTS: readonly ShapeAssignment[] = [
  ['SA-001', 'SC20855', 'ZONE-SC-F', 'SHP-SC-F-10'],
  ['SA-002', 'SC20855', 'ZONE-SC-B', 'SHP-SC-B-40'],
  ['SA-003', 'CC20854', 'ZONE-CC-EX', 'SHP-CC-CN-M'],
  ['SA-004', 'FM10237', 'ZONE-FM-F', 'SHP-FM-S1-TT-SI03'],
  ['SA-005', 'FM10237', 'ZONE-FM-B', 'SHP-FM-S2-TT-SI03'],
].map(([id, uniqueVehicleId, vehicleZoneId, vehicleProductShapeId]) => ({
  id,
  uniqueVehicleId,
  vehicleZoneId,
  vehicleProductShapeId,
  type: 'PRIMARY' as const,
  validFrom: REFERENCE_TIMESTAMP,
}));

export const MASTER_PRODUCTS: readonly MasterProduct[] = [];

export const MASTER_PRODUCT_SKUS: readonly MasterProductSku[] = [];

export const MASTER_PRODUCT_PACKAGINGS: readonly MasterProductPackaging[] = [];

export const PRODUCT_REGISTRATIONS: readonly VehicleProductRegistration[] = [];

export const PRODUCT_REGISTRATION_ITEMS: readonly VehicleProductRegistrationItem[] =
  [];

/** The only approval type wired in so far: the sign-off for a registration of new SKUs. */
export const APPROVAL_TYPES: readonly ApprovalType[] = [
  {
    id: 'VEHICLE_PRODUCT_REGISTRATION',
    code: 'REGISTRATION',
    name: 'SKU registration',
    status: 'ACTIVE',
  },
  {
    id: 'VEHICLE_RESEARCH_HANDOFF',
    code: 'RESEARCH_HANDOFF',
    name: 'Research → project handoff',
    status: 'ACTIVE',
  },
];

/** Demo grants so a route can be built without a server: Kai and JH can do either step. */
export const APPROVAL_GRANTS: readonly ApprovalGrant[] = [
  {
    id: 'AG-001',
    appUserId: 'USR-KAI',
    approvalTypeId: 'VEHICLE_PRODUCT_REGISTRATION',
    canForward: true,
    canFinalApprove: true,
    status: 'ACTIVE',
  },
  {
    id: 'AG-002',
    appUserId: 'USR-YOUNG',
    approvalTypeId: 'VEHICLE_PRODUCT_REGISTRATION',
    canForward: true,
    canFinalApprove: false,
    status: 'ACTIVE',
  },
  {
    id: 'AG-003',
    appUserId: 'USR-CHRISTIAN',
    approvalTypeId: 'VEHICLE_PRODUCT_REGISTRATION',
    canForward: false,
    canFinalApprove: true,
    status: 'ACTIVE',
  },
  {
    id: 'AG-004',
    appUserId: 'USR-JH',
    approvalTypeId: 'VEHICLE_PRODUCT_REGISTRATION',
    canForward: true,
    canFinalApprove: true,
    status: 'ACTIVE',
  },
  ...[
    ['AG-101', 'USR-KAI', true, true],
    ['AG-102', 'USR-YOUNG', true, false],
    ['AG-103', 'USR-CHRISTIAN', false, true],
    ['AG-104', 'USR-JH', true, true],
  ].map(([id, appUserId, canForward, canFinalApprove]) => ({
    id: String(id),
    appUserId: String(appUserId),
    approvalTypeId: 'VEHICLE_RESEARCH_HANDOFF',
    canForward: Boolean(canForward),
    canFinalApprove: Boolean(canFinalApprove),
    status: 'ACTIVE' as const,
  })),
];
