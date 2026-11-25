// Woody Theme syntax showcase: TypeScript.
// Demonstrates: string, numeric and const enums, interfaces with `extends`, readonly and optional members, type aliases, union and intersection types, literal and template-literal types, mapped types with `as` remapping and modifiers, conditional types with `infer`, keyof/typeof/indexed access, generic functions and classes with constraints and defaults, function overloads, type guards and assertion functions, abstract classes and `implements`, access modifiers (public/private/protected/readonly) plus #private fields and parameter properties, experimental class and method decorators, namespaces, `as const` and `satisfies`, async/await, and TSDoc comments.

/** Species codes as printed on trunk tags. */
export enum SpeciesCode {
  EnglishOak = "QR",
  ScotsPine = "PS",
  SilverBirch = "BP",
  DouglasFir = "PM",
}

/** Commercial plank grades; numeric so they sort from best to worst. */
export enum Grade {
  Prime = 1,
  Select,
  Common,
  Firewood = 0x10,
}

/** Bit flags for plank defects, inlined at compile time. */
const enum Defect {
  None = 0,
  Knot = 1 << 0,
  Split = 1 << 1,
  Wane = 1 << 2,
  Stain = 1 << 3,
}

/** Anything stamped with the moment it was measured. */
interface Measured {
  readonly measuredAt: Date;
}

/** A single tree recorded in a survey plot. */
export interface Tree extends Measured {
  readonly id: number;
  species: SpeciesCode;
  /** Diameter at breast height (1.3 m), in centimetres. */
  dbhCm: number;
  heightM?: number | null;
  tags: readonly string[];
}

/** A plank cut from a sawmill batch. */
export interface Plank extends Measured {
  batchId: `SM${number}-${number}`;
  lengthMm: number;
  defects: Defect;
}

/** Sensor kinds installed around the yard. */
export type SensorKind = "moisture" | "temperature";
/** A reading tagged with its kind; the intersection mixes in the shared `Measured` fields. */
export type Reading = { kind: SensorKind; value: number; sensorId: string } & Measured;

/** Strip `readonly` from every property. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
/** Getter signatures such as `getDbhCm()` for each property of `T`. */
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
/** Keys of `T` whose values are numbers. */
type NumericKeys<T> = { [K in keyof T]-?: T[K] extends number ? K : never }[keyof T];
/** The resolved value of an async function type. */
type AsyncResult<F> = F extends (...args: any[]) => Promise<infer R> ? R : never;

/** Latin names for each species: checked for completeness by `satisfies`, but kept as literal types by `as const`. */
export const LATIN_NAMES = {
  [SpeciesCode.EnglishOak]: "Quercus robur",
  [SpeciesCode.ScotsPine]: "Pinus sylvestris",
  [SpeciesCode.SilverBirch]: "Betula pendula",
  [SpeciesCode.DouglasFir]: "Pseudotsuga menziesii",
} as const satisfies Record<SpeciesCode, string>;

/** Union of the Latin-name literals, derived from the object above. */
export type LatinName = (typeof LATIN_NAMES)[keyof typeof LATIN_NAMES];

const MAX_MOISTURE = 19.5;
// Tags look like "PLOT-07/QR-0042@24.5m": plot number, species code, tree number and an optional measured height.
const TREE_TAG = /^PLOT-(?<plot>\d{2})\/(?<species>QR|PS|BP|PM)-(?<tree>\d{4})(?:@(?<height>\d+(?:\.\d+)?)m)?$/;

/** Class decorator: seals the constructor and prototype so no members can be added at runtime. */
function sealed<TCtor extends new (...args: any[]) => object>(constructor: TCtor): TCtor {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
  return constructor;
}

/** Method decorator factory that logs every call, prefixed with `label`, along with its argument count. */
function logged(label: string) {
  return function (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (this: unknown, ...args: unknown[]): unknown {
      console.debug(`[${label}] ${String(propertyKey)}(${args.length} args)`);
      return original.apply(this, args);
    };
    return descriptor;
  };
}

/** Cross-sectional trunk area at breast height, in square metres. */
export const basalArea = ({ dbhCm }: Pick<Tree, "dbhCm">): number => Math.PI * (dbhCm / 200) ** 2;

/**
 * Base class for keyed, in-memory collections of inventory records.
 * @typeParam TItem - The record type; it must expose a readonly `id`.
 * @typeParam TKey - The type of that `id`.
 */
export abstract class Repository<TItem extends { readonly id: TKey }, TKey extends PropertyKey = number> implements Iterable<TItem> {
  protected readonly items = new Map<TKey, TItem>();

  constructor(public readonly name: string) {}

  /** Return true if `item` may be stored. */
  protected abstract validate(item: TItem): boolean;

  /** Add records, skipping any that fail validation; returns `this` for chaining. */
  add(...items: TItem[]): this {
    for (const item of items) {
      if (this.validate(item)) this.items.set(item.id, item);
    }
    return this;
  }

  get size(): number {
    return this.items.size;
  }

  *[Symbol.iterator](): IterableIterator<TItem> {
    yield* this.items.values();
  }
}

/** Repository of surveyed trees for the Woody Lumber Yard. */
@sealed
export class TreeRegistry extends Repository<Tree> {
  private static instances = 0;
  readonly #auditLog: string[] = [];

  constructor(name = "Woody Lumber Yard", private readonly maxDbhCm = 5e2) {
    super(name);
    TreeRegistry.instances++;
  }

  protected override validate(tree: Tree): boolean {
    const ok = tree.dbhCm > 0 && tree.dbhCm < this.maxDbhCm;
    if (!ok) this.#auditLog.push(`rejected #${tree.id}: dbh ${tree.dbhCm} cm`);
    return ok;
  }

  /** The `limit` largest trees by basal area. */
  @logged("registry")
  largest(limit = 5): Tree[] {
    return [...this].sort((a, b) => basalArea(b) - basalArea(a)).slice(0, limit);
  }

  /** Rejection messages recorded during validation. */
  get audit(): readonly string[] {
    return this.#auditLog;
  }

  static get instanceCount(): number {
    return TreeRegistry.instances;
  }
}

/**
 * Parse a trunk tag such as `PLOT-07/QR-0042@24.5m`.
 * @param tag - Raw tag text read in the field.
 * @param dbhCm - Diameter measured alongside the tag.
 * @param strict - When true (the default), invalid tags throw instead of returning `null`.
 * @throws {@link SyntaxError} If `strict` is true and the tag is invalid.
 */
export function parseTag(tag: string, dbhCm: number): Tree;
export function parseTag(tag: string, dbhCm: number, strict: false): Tree | null;
export function parseTag(tag: string, dbhCm: number, strict = true): Tree | null {
  const groups = TREE_TAG.exec(tag.trim())?.groups;
  if (groups === undefined) {
    if (strict) throw new SyntaxError(`Unrecognised tree tag: "${tag}"`);
    return null;
  }
  const height = groups["height"];
  return { id: Number(groups["tree"]), species: groups["species"] as SpeciesCode, dbhCm, heightM: height ? parseFloat(height) : null, tags: [tag], measuredAt: new Date() };
}

/** Type guard: narrows an unknown value to a {@link SpeciesCode}. */
export function isSpeciesCode(value: unknown): value is SpeciesCode {
  return typeof value === "string" && (Object.values(SpeciesCode) as string[]).includes(value);
}

/** Assertion function: throws unless `value` is neither `null` nor `undefined`. */
export function assertDefined<T>(value: T, message = "value is missing"): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new TypeError(message);
}

/** Extract one numeric metric, such as `"dbhCm"`, from every record. */
export function pluck<T, K extends NumericKeys<T>>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

/** Assign a commercial grade from a plank's defects and length. */
export function gradePlank({ lengthMm, defects }: Pick<Plank, "lengthMm" | "defects">): Grade {
  if (defects === Defect.None && lengthMm >= 2_400) return Grade.Prime;
  if (!(defects & (Defect.Split | Defect.Wane))) return Grade.Select;
  return lengthMm >= 1_200 && !(defects & Defect.Split) ? Grade.Common : Grade.Firewood;
}

/** Unit conversions used at the sawmill. */
export namespace Units {
  export const CM_PER_INCH = 2.54;
  /** A length in centimetres, branded so plain numbers can't be passed by mistake. */
  export type Centimetres = number & { readonly __brand: "cm" };

  export function fromInches(inches: number): Centimetres {
    return (inches * CM_PER_INCH) as Centimetres;
  }

  /** Board-feet for a plank measured in inches (thickness, width) and feet (length). */
  export const boardFeet = (thicknessIn: number, widthIn: number, lengthFt: number): number => (thicknessIn * widthIn * lengthFt) / 12;
}

/** Simulated network read of one probe in a drying stack. */
async function readProbe(sensorId: string, kind: SensorKind = "moisture"): Promise<Reading> {
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return { kind, value: 12 + (sensorId.length % 9) / 10, sensorId, measuredAt: new Date() };
}

/** Poll every probe concurrently and report which stacks are dry. */
export async function pollStacks(sensorIds: readonly string[]): Promise<{ readings: Reading[]; dry: Set<string> }> {
  const readings = await Promise.all(sensorIds.map((id) => readProbe(id)));
  return { readings, dry: new Set(readings.filter((r) => r.kind === "moisture" && r.value <= MAX_MOISTURE).map((r) => r.sensorId)) };
}

/** Demo entry point. */
async function main(): Promise<void> {
  const registry = new TreeRegistry();
  registry.add(parseTag("PLOT-07/QR-0042@24.5m", 86), parseTag("PLOT-12/PM-0007@41.25m", 64.8));
  const maybe = parseTag("plot-9/??", 12, false);
  if (maybe !== null && isSpeciesCode(maybe.species)) registry.add(maybe);

  const [biggest] = registry.largest(1);
  assertDefined(biggest, "registry is empty");
  const editable: Mutable<Tree> = { ...biggest, tags: [...biggest.tags, "veteran"] };
  const getters: Partial<Getters<Plank>> = { getLengthMm: () => 2_600 };
  const latin: LatinName = LATIN_NAMES[editable.species];
  const { dry }: AsyncResult<typeof pollStacks> = await pollStacks(["stack-A", "stack-B"]);

  console.log(`${registry.name} \u{2014}\t${registry.size} trees, largest ${latin} (${pluck([...registry], "dbhCm").join(", ")} cm); dry stacks: ${[...dry].join(", ")}`);
  console.log(Grade[gradePlank({ lengthMm: 1_900, defects: Defect.Knot | Defect.Stain })], Units.boardFeet(2, 6, 8), getters.getLengthMm?.(), registry.audit, TreeRegistry.instanceCount);
}

void main();
