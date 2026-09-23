import type { ColorType, ProductTypeId } from '@/shared/types/workbench';

/**
 * Internal SKU generation, per the internal "SKU Format" document.
 *
 * The size segment is never a separate reference table: it is
 * `vehicle_product_shape.name` — the size-chart code (`F-10`, `CN-M`). Seat
 * Cover renders each covered zone's shape name whole and in order; Car Cover
 * splits its single shape name at the first hyphen around the material.
 *
 * Channel SKUs (`EB-…-00001`) are assembled at listing time and are
 * deliberately neither produced nor stored here.
 */

/** Leading category segments. Only Car Cover breaks the `CA-` pattern. */
const CATEGORY_SEGMENTS: Record<ProductTypeId, readonly string[]> = {
  'PT-SC': ['CA', 'SC'],
  'PT-FM': ['CA', 'FM'],
  'PT-CC': ['CC'],
  'PT-SWC': ['CA', 'SWC'],
  'PT-WS': ['CA', 'WS'],
};

/**
 * Which colour types a material may carry, keyed by material code. From the
 * document's fabric table, not the schema — `product_material` has no such
 * column. A material absent here is unconstrained.
 */
const MATERIAL_COLOR_TYPES: Readonly<Record<string, readonly ColorType[]>> = {
  // Seat Cover
  '10': ['1TO', 'STI'],
  // Car Cover
  '03': ['1TO'],
  '07': ['1TO'],
  '15': ['1TO', 'STR'],
};

/**
 * Which colour type each colour code belongs to. From the document's colour
 * tables, not the schema — `product_color` has no such column. A colour absent
 * here is offered under every type.
 *
 * `BKRD` is deliberately absent: it is STI for Seat Cover and STR for Car
 * Cover, so it must stay selectable under both.
 */
const COLOR_TYPE_BY_CODE: Readonly<Record<string, ColorType>> = {
  BE: '1TO',
  BK: '1TO',
  GR: '1TO',
  DG: '1TO',
  BR: '1TO',
  DB: '1TO',
  WR: '1TO',
  PK: '1TO',
  RD: '1TO',
  WH: '1TO',
  OR: '1TO',
  BKWH: 'STI',
  BKLG: 'STR',
  LGBK: 'STR',
  DGBK: 'STR',
  BLLG: 'STR',
};

const ALL_COLOR_TYPES: readonly ColorType[] = ['1TO', 'STI', 'STR'];

/** Colour types a material allows, or every type when it is unconstrained. */
export function allowedColorTypes(materialCode: string): readonly ColorType[] {
  return MATERIAL_COLOR_TYPES[materialCode] ?? ALL_COLOR_TYPES;
}

/** True when the colour may be used with the given colour type. */
export function colorFitsType(
  colorCode: string,
  colorType: ColorType,
): boolean {
  const known = COLOR_TYPE_BY_CODE[colorCode];
  return known === undefined || known === colorType;
}

/**
 * Codes that were renamed but still appear on previously issued SKUs. A
 * duplicate check must compare canonical forms, or the same product gets
 * registered twice under the old and the new spelling.
 */
const CODE_ALIASES: Readonly<Record<string, string>> = {
  B: 'R',
  BKGR: 'BKLG',
  GRBK: 'LGBK',
};

/** Rewrites renamed segments to their current spelling. */
export function canonicalSku(sku: string): string {
  return sku
    .split('-')
    .map((segment) => CODE_ALIASES[segment] ?? segment)
    .join('-');
}

export type SkuResult =
  { status: 'ok'; sku: string } | { status: 'unsupported'; reason: string };

export interface SkuInput {
  materialCode: string;
  /** Shape names in zone order — the size segment(s). */
  shapeNames: readonly string[];
  colorCode: string;
  colorType: ColorType;
  /** Floor Mat only: the F# stands in for the shape segment. */
  fNumber: string;
}

/** `CA-FM-{material}-{F#}` — e.g. `CA-FM-80-FM10237`. */
function floorMatSku(input: SkuInput): SkuResult {
  if (!input.materialCode || !input.fNumber) {
    return {
      status: 'unsupported',
      reason: 'Both a material code and F# are required to generate a SKU.',
    };
  }
  return {
    status: 'ok',
    sku: [
      ...CATEGORY_SEGMENTS['PT-FM'],
      input.materialCode,
      input.fNumber,
    ].join('-'),
  };
}

/**
 * `CA-SC-{material}-{shape}[-{shape}…]-{color}-{colorType}`
 *
 * One shape name per covered zone, so the number of zones decides whether the
 * SKU is a Single (`CA-SC-10-F-10-BK-1TO`) or a Full Set
 * (`CA-SC-10-F-10-B-40-BK-1TO`) — there is no separate flag.
 */
function seatCoverSku(input: SkuInput): SkuResult {
  if (!input.materialCode || !input.colorCode || !input.shapeNames.length) {
    return {
      status: 'unsupported',
      reason: 'Material, Shape, and Color are all required.',
    };
  }
  return {
    status: 'ok',
    sku: [
      ...CATEGORY_SEGMENTS['PT-SC'],
      input.materialCode,
      ...input.shapeNames,
      input.colorCode,
      input.colorType,
    ].join('-'),
  };
}

/**
 * `CC-{shapeHead}-{material}-{shapeTail}-{color}-{colorType}`
 *
 * The shape name carries both the vehicle/mirror code and the size
 * (`CN-M` → `CC-CN-15-M-…`), so it is split at its first hyphen and the
 * material goes between the halves.
 */
function carCoverSku(input: SkuInput): SkuResult {
  const shapeName = input.shapeNames[0];
  if (!input.materialCode || !input.colorCode || !shapeName) {
    return {
      status: 'unsupported',
      reason: 'Material, Shape, and Color are all required.',
    };
  }
  const hyphen = shapeName.indexOf('-');
  if (hyphen <= 0 || hyphen === shapeName.length - 1) {
    return {
      status: 'unsupported',
      reason: `Shape name "${shapeName}" must use the "vehicle-mirror-size" format (example: CN-M).`,
    };
  }
  return {
    status: 'ok',
    sku: [
      ...CATEGORY_SEGMENTS['PT-CC'],
      shapeName.slice(0, hyphen),
      input.materialCode,
      shapeName.slice(hyphen + 1),
      input.colorCode,
      input.colorType,
    ].join('-'),
  };
}

export function buildSku(
  productTypeId: ProductTypeId,
  input: Partial<SkuInput>,
): SkuResult {
  const resolved: SkuInput = {
    materialCode: input.materialCode ?? '',
    shapeNames: input.shapeNames ?? [],
    colorCode: input.colorCode ?? '',
    colorType: input.colorType ?? '1TO',
    fNumber: input.fNumber ?? '',
  };
  if (productTypeId === 'PT-FM') return floorMatSku(resolved);
  if (productTypeId === 'PT-CC') return carCoverSku(resolved);
  return seatCoverSku(resolved);
}
