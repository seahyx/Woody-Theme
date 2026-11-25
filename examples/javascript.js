// Woody Theme syntax showcase: JavaScript (ES2022+, ES module).
// Demonstrates: import/export (named, namespace, default), JSDoc (@typedef, @param, @returns, @yields, @throws), numeric literal forms (hex, binary, octal, exponent, separators, BigInt), regex literals with named groups, classes, anchors, quantifiers and alternation, classes with #private fields/methods, static fields/methods and `#x in obj` brand checks, getters/setters, generator functions and yield*, async/await with Promise.all, template literals with nested ${} expressions and escapes, destructuring with defaults and renaming, spread/rest, optional chaining, nullish coalescing, a labelled loop with `continue label`, switch, try/catch/finally, throw, typeof/instanceof/in/new/delete/void, Map/Set, and arrow functions.

import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { EventEmitter } from "node:events";

/** Name printed at the top of every report. */
export const YARD_NAME = "Woody Lumber Yard";
/** Moisture content (%) at or below which timber counts as kiln-dry. */
export const MAX_MOISTURE = 19.5;
const KILN_LIMIT_C = 8.25e1;
const PLOT_AREA_M2 = 4e2; // each survey plot is 20 m x 20 m
const M2_PER_HECTARE = 10_000;
const SENSOR_MASK = 0xff_00;
const REPORT_MODE = 0o644;
/** Bit flags for plank defects; combine with `|`. */
export const Defect = Object.freeze({ NONE: 0, KNOT: 0b0001, SPLIT: 0b0010, WANE: 0b0100, STAIN: 0b1000 });
/** Running total of board-feet processed; a BigInt because the yard's lifetime total outgrows 2^53. */
let boardFeetProcessed = 9_007_199_254_740_993n;

/** Matches trunk tags such as `PLOT-07/QR-0042@24.5m`; groups are `plot`, `species`, `tree` and the optional `height` in metres. */
const TREE_TAG = /^PLOT-(?<plot>\d{2})\/(?<species>QR|PS|BP|PM)-(?<tree>\d{4})(?:@(?<height>\d+(?:\.\d+)?)m)?$/;
/** Matches sawmill batch IDs such as `SM26-00317` anywhere in a sentence. */
const BATCH_ID = /\bSM(?<year>\d{2})-(?<seq>[0-9]{1,5})\b/gi;

/** Species codes from trunk tags, mapped to common and Latin names. @readonly @enum {{ common: string, latin: string }} */
export const Species = Object.freeze({
  QR: { common: "English oak", latin: "Quercus robur" },
  PS: { common: "Scots pine", latin: "Pinus sylvestris" },
  BP: { common: "Silver birch", latin: "Betula pendula" },
  PM: { common: "Douglas fir", latin: "Pseudotsuga menziesii" },
});

/**
 * @typedef {object} Tree
 * @property {number} id Four-digit number from the trunk tag.
 * @property {keyof typeof Species} species Species code.
 * @property {number} dbhCm Diameter at breast height, in centimetres.
 * @property {number | null} heightM Total height in metres, or null if not yet measured.
 * @property {number} plot Survey plot number.
 */

/**
 * Parse a trunk tag into a {@link Tree}.
 * @param {string} tag Raw tag text read in the field.
 * @param {{ dbhCm?: number, strict?: boolean }} [options] Measured diameter, and whether invalid tags throw.
 * @returns {Tree | null} The parsed tree, or null when `strict` is false and the tag is invalid.
 * @throws {SyntaxError} When `strict` is true and the tag is invalid.
 */
export function parseTag(tag, { dbhCm = 0, strict = true } = {}) {
  const match = TREE_TAG.exec(tag.trim());
  if (match === null) {
    if (strict) throw new SyntaxError(`Unrecognised tree tag: "${tag}"`);
    return null;
  }
  const { plot, species, tree: id, height } = match.groups;
  return { id: Number.parseInt(id, 10), species, dbhCm, heightM: height ? Number(height) : null, plot: +plot };
}

/** In-memory register of surveyed trees; emits an `added` event for each new tree. */
export class Inventory extends EventEmitter {
  /** Number of inventories created in this process. */
  static created = 0;
  /** @type {Map<string, Inventory>} */
  static #registry = new Map();
  /** @type {Map<number, Tree>} */
  #trees = new Map();
  #name;

  /** @param {string} [name] Display name used in reports. */
  constructor(name = YARD_NAME) {
    super();
    this.#name = name;
    Inventory.created += 1;
    Inventory.#registry.set(name, this);
  }

  /** @returns {string} The display name. */
  get name() {
    return this.#name;
  }

  /** @param {string} value A new, non-empty display name. */
  set name(value) {
    if (typeof value !== "string" || value.length === 0) throw new TypeError("name must be a non-empty string");
    this.#name = value;
  }

  /** @returns {number} How many trees are registered. */
  get size() {
    return this.#trees.size;
  }

  /** Register trees, silently skipping any with an unknown species code. @param {...Tree} trees @returns {this} */
  add(...trees) {
    for (const tree of trees) {
      if (!(tree?.species in Species)) continue;
      this.#trees.set(tree.id, tree);
      this.emit("added", tree);
    }
    return this;
  }

  /**
   * Yield trees from largest to smallest basal area.
   * @param {number} [limit] Maximum number of trees to yield.
   * @yields {Tree}
   */
  *largest(limit = Infinity) {
    yield* [...this.#trees.values()].sort((a, b) => Inventory.#basalArea(b) - Inventory.#basalArea(a)).slice(0, limit);
  }

  /** @param {Pick<Tree, "dbhCm">} tree @returns {number} Cross-sectional trunk area at breast height, in m². */
  static #basalArea({ dbhCm }) {
    return Math.PI * (dbhCm / 200) ** 2;
  }

  /** @param {unknown} value @returns {value is Inventory} True for real inventories, even across subclasses. */
  static isInventory(value) {
    return typeof value === "object" && value !== null && #trees in value;
  }
}

/** Yield the kiln chamber temperature (°C) for each hour of a drying run. @param {number} [startC] @param {number} [stepC] @yields {number} */
export function* kilnSchedule(startC = 20, stepC = 12.5) {
  for (let temperature = startC; temperature < KILN_LIMIT_C; temperature += stepC) {
    yield temperature;
  }
  return `limit of ${KILN_LIMIT_C}\u00b0C reached`;
}

/** Simulate a network read of one moisture probe. @param {string} sensorId @param {{ baseline?: number, delayMs?: number }} [options] @returns {Promise<{ sensorId: string, moisture: number, takenAt: Date }>} */
async function readSensor(sensorId, { baseline = 12, delayMs = 10 } = {}) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const raw = ([...sensorId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) << 8) & SENSOR_MASK; // keep the high byte only
  return { sensorId, moisture: baseline + ((raw >> 8) % 90) / 10, takenAt: new Date() };
}

/** Read every drying-stack probe concurrently. @param {string[]} sensorIds @returns {Promise<{ readings: Map<string, number>, dry: Set<string> }>} */
export async function pollStacks(sensorIds) {
  const results = await Promise.all(sensorIds.map((id) => readSensor(id)));
  const readings = new Map(results.map(({ sensorId, moisture }) => [sensorId, moisture]));
  const dry = new Set([...readings].filter(([, moisture]) => moisture <= MAX_MOISTURE).map(([id]) => id));
  return { readings, dry };
}

/**
 * Find the first split plank across several sawmill batches. Planks in a batch are sorted longest-first, so the first offcut ends that batch's scan.
 * @param {Record<string, Array<{ lengthMm: number, defects?: number }>>} batches
 * @returns {{ batchId: string, index: number, checked: number } | undefined}
 */
export function findFirstSplit(batches) {
  let checked = 0;
  batchLoop: for (const [batchId, planks] of Object.entries(batches)) {
    for (let index = 0; index < planks.length; index++) {
      const { lengthMm, defects = Defect.NONE } = planks[index];
      checked++;
      if (lengthMm < 1_800) continue batchLoop;
      if ((defects & Defect.SPLIT) !== 0) return { batchId, index, checked };
    }
  }
  return undefined;
}

/** Assign a commercial grade to a plank. @param {{ lengthMm: number, defects?: number }} plank @returns {"prime" | "select" | "common" | "firewood"} */
export function gradePlank({ lengthMm, defects = Defect.NONE }) {
  switch (true) {
    case defects === Defect.NONE && lengthMm >= 2_400:
      return "prime";
    case (defects & (Defect.SPLIT | Defect.WANE)) === 0:
      return "select";
    case lengthMm >= 1_200 && !(defects & Defect.SPLIT):
      return "common";
    default:
      return "firewood";
  }
}

/** Load a plot's trees from a JSON export, dropping surveyor-only fields. @param {string} file @returns {Promise<Tree[]>} Empty if the file is malformed. */
export async function loadPlot(file) {
  try {
    const rows = JSON.parse(await readFile(path.resolve(file), "utf8"), (key, value) => (key === "dbhCm" ? Number(value) : value));
    return rows.map((row) => {
      const tree = { heightM: null, ...row };
      delete tree._surveyorNotes;
      return tree;
    });
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn(`Malformed JSON in ${path.basename(file)}:\n\t${error.message}`);
    return [];
  } finally {
    console.debug(`loadPlot(${file}) finished`);
  }
}

/** Render a plain-text report. @param {Inventory} inventory @param {Map<string, number>} [readings] Moisture by probe ID. @returns {string} */
export function formatReport(inventory, readings = new Map()) {
  const lines = [`${inventory.name} \u2014 ${inventory.size} trees`];
  for (const { id, species, dbhCm, heightM } of inventory.largest(3)) {
    const { common = "Unknown", latin = "?" } = Species[species] ?? {};
    lines.push(`\t#${String(id).padStart(4, "0")} ${common} (${latin}): ${dbhCm.toFixed(1)} cm${heightM != null ? `, ${heightM} m` : ""}`);
  }
  const density = (inventory.size / PLOT_AREA_M2) * M2_PER_HECTARE;
  lines.push(`Density: ${density.toFixed(1)} stems/ha`, ...[...readings].map(([id, pct]) => `Probe ${id}: ${pct.toFixed(1)}%`));
  return lines.join("\n");
}

/** Demo entry point: parse a few tags, poll the probes, grade some planks and write a report. @returns {Promise<void>} */
export default async function main() {
  const inventory = new Inventory();
  inventory.on("added", (tree) => void console.log(`+ tree ${tree.id}`));
  const sheet = [["PLOT-07/QR-0042@24.5m", 86], ["PLOT-07/PS-0101", 31.2], ["plot-9/??", 12], ["PLOT-12/PM-0007@41.25m", 64.8]];
  inventory.add(...sheet.map(([tag, dbhCm]) => parseTag(tag, { dbhCm, strict: false })).filter(Boolean));
  console.assert(Inventory.isInventory(inventory), "brand check failed");

  const { readings, dry } = await pollStacks(["stack-A", "stack-B"]);
  const planks = { "SM26-00317": [{ lengthMm: 2_600 }, { lengthMm: 1_900, defects: Defect.KNOT | Defect.SPLIT }], "SM26-00318": [{ lengthMm: 900 }] };
  const firstSplit = findFirstSplit(planks);
  boardFeetProcessed += BigInt([...kilnSchedule()].length * 120);

  for (const { groups } of "Shipped SM26-00317 and sm26-00318".matchAll(BATCH_ID)) {
    console.log(`Batch ${groups?.seq ?? "?"} from 20${groups?.year}: ${planks[`SM${groups.year}-${groups.seq}`]?.map(gradePlank).join(", ") ?? "no planks"}`);
  }
  const report = `${formatReport(inventory, readings)}\nDry: ${[...dry].join(", ") || "none"}\nFirst split: ${firstSplit?.batchId ?? "none"}\nBoard-feet: ${boardFeetProcessed}`;
  await writeFile("woody-report.txt", `${report}\n`, { mode: REPORT_MODE });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
