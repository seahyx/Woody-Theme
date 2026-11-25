// Woody Theme syntax showcase: React with TypeScript (TSX).
// Demonstrates: value and type-only imports, props interfaces, function components with destructured default props, useState/useEffect/useMemo/useCallback/useRef, a custom hook with cleanup, JSX elements with string, expression, boolean-shorthand, spread, aria-* and data-* attributes, embedded expressions, conditional rendering with && and ternaries, list rendering with .map and keys, keyed <Fragment> and <>…</> shorthand, typed event handlers, inline style objects, self-closing components, children, template literals, a regex, and TSDoc comments.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";

/** Species codes as printed on trunk tags. */
export type SpeciesCode = "QR" | "PS" | "BP" | "PM";

/** A single measured tree, as returned by the inventory API. */
export interface Tree {
  id: number;
  plot: string;
  species: SpeciesCode;
  /** Diameter at breast height, in centimetres. */
  dbhCm: number;
  heightM?: number | null;
}

/** Common and Latin names for each species. */
const SPECIES: Record<SpeciesCode, readonly [common: string, latin: string]> = {
  QR: ["English oak", "Quercus robur"],
  PS: ["Scots pine", "Pinus sylvestris"],
  BP: ["Silver birch", "Betula pendula"],
  PM: ["Douglas fir", "Pseudotsuga menziesii"],
};

const MAX_MOISTURE = 19.5;
const POLL_INTERVAL_MS = 15_000;

/** State returned by {@link useSensorReading}. */
interface SensorState {
  value: number | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Poll a moisture probe on an interval, aborting any in-flight request when the component unmounts or the sensor changes.
 * @param sensorId - Identifier printed on the probe housing.
 * @param intervalMs - Delay between polls.
 */
export function useSensorReading(sensorId: string, intervalMs = POLL_INTERVAL_MS): SensorState {
  const [state, setState] = useState<SensorState>({ value: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();

    async function poll(): Promise<void> {
      try {
        const response = await fetch(`/api/sensors/${encodeURIComponent(sensorId)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Probe ${sensorId} answered HTTP ${response.status}`);
        const { moisture } = (await response.json()) as { moisture: number };
        setState({ value: moisture, error: null, loading: false });
      } catch (err) {
        if (controller.signal.aborted) return; // unmounted or re-targeted: drop the stale result
        setState((prev) => ({ ...prev, error: err instanceof Error ? err : new Error(String(err)), loading: false }));
      }
    }

    void poll();
    const timer = window.setInterval(poll, intervalMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [sensorId, intervalMs]);

  return state;
}

/** Props for {@link MoistureBadge}. */
interface MoistureBadgeProps {
  sensorId: string;
  /** Readings at or below this percentage are shown as dry. */
  threshold?: number;
}

/** Small pill showing a probe's latest moisture reading. */
export function MoistureBadge({ sensorId, threshold = MAX_MOISTURE }: MoistureBadgeProps) {
  const { value, error, loading } = useSensorReading(sensorId);

  if (loading) return <span className="badge badge--muted">Reading {sensorId}…</span>;
  if (error) return <span className="badge badge--error" title={error.message}>Offline</span>;

  const dry = value !== null && value <= threshold;
  return (
    <span className={`badge ${dry ? "badge--ok" : "badge--warn"}`} aria-label={`${sensorId}: ${value?.toFixed(1)} percent moisture`}>
      {sensorId} {value?.toFixed(1)}%
    </span>
  );
}

/** Props for {@link TreeRow}. */
interface TreeRowProps {
  tree: Tree;
  selected: boolean;
  /** Largest diameter in the table, used to scale the size bar. */
  maxDbhCm: number;
  onSelect: (id: number) => void;
}

/** One table row; clicking it selects the tree. */
function TreeRow({ tree, selected, maxDbhCm, onSelect }: TreeRowProps) {
  const [common, latin] = SPECIES[tree.species];
  return (
    <tr className={selected ? "row row--selected" : "row"} onClick={() => onSelect(tree.id)} data-species={tree.species} aria-selected={selected}>
      <td>{String(tree.id).padStart(4, "0")}</td>
      <td><abbr title={latin}>{common}</abbr></td>
      <td className="num">
        {tree.dbhCm.toFixed(1)}
        <span className="bar" style={{ width: `${Math.round((tree.dbhCm / maxDbhCm) * 100)}%`, opacity: selected ? 1 : 0.6 }} />
      </td>
      <td className="num">{tree.heightM ?? "\u2014"}</td>
    </tr>
  );
}

/** Shown when no tree matches the current filters. */
const EmptyState = ({ query }: { query: string }) => (
  <p className="empty" role="status">
    No trees match <code>{query || "(any plot)"}</code>. Try another plot such as <kbd>PLOT-07</kbd>.
  </p>
);

/** Props for {@link InventoryTable}. */
export interface InventoryTableProps {
  trees: readonly Tree[];
  title?: string;
  sensorIds?: string[];
  children?: ReactNode;
}

/** Filterable, sortable table of surveyed trees, grouped by plot, with live moisture badges. */
export default function InventoryTable({ trees, title = "Woody Lumber Yard", sensorIds = [], children }: InventoryTableProps) {
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState<SpeciesCode | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex metacharacters typed by the user
    const pattern = new RegExp(`^${escaped}`, "i");
    return trees.filter((t) => (species === "all" || t.species === species) && pattern.test(t.plot)).sort((a, b) => (sortDesc ? b.dbhCm - a.dbhCm : a.dbhCm - b.dbhCm));
  }, [trees, query, species, sortDesc]);

  const byPlot = useMemo(() => {
    const groups = new Map<string, Tree[]>();
    for (const tree of visible) groups.set(tree.plot, [...(groups.get(tree.plot) ?? []), tree]);
    return [...groups];
  }, [visible]);
  const maxDbhCm = Math.max(1, ...visible.map((t) => t.dbhCm));

  useEffect(() => {
    document.title = `${title} · ${visible.length} trees`;
  }, [title, visible.length]);

  const handleQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value), []);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedId(visible[0]?.id ?? null);
    searchRef.current?.select(); // keep the query highlighted so the next search replaces it
  };
  const inputProps = { type: "search", autoComplete: "off", spellCheck: false } as const;

  return (
    <section className="inventory" aria-labelledby="inventory-title">
      <header>
        <h2 id="inventory-title">{title}</h2>
        {sensorIds.length > 0 && (
          <p className="sensors">
            {sensorIds.map((id) => <MoistureBadge key={id} sensorId={id} />)}
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} role="search">
        <label htmlFor="plot-filter">Plot</label>
        <input id="plot-filter" ref={searchRef} {...inputProps} value={query} onChange={handleQuery} placeholder="e.g. PLOT-07" autoFocus />
        <select value={species} onChange={(e) => setSpecies(e.target.value as SpeciesCode | "all")}>
          <option value="all">All species</option>
          {(Object.keys(SPECIES) as SpeciesCode[]).map((code) => <option key={code} value={code}>{SPECIES[code][0]}</option>)}
        </select>
        <button type="button" onClick={() => setSortDesc((prev) => !prev)} aria-pressed={sortDesc}>
          DBH {sortDesc ? "\u25BC" : "\u25B2"}
        </button>
      </form>

      {visible.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <>
          <table>
            <thead>
              <tr><th scope="col">Tag</th><th scope="col">Species</th><th scope="col">DBH (cm)</th><th scope="col">Height (m)</th></tr>
            </thead>
            <tbody>
              {byPlot.map(([plot, rows]) => (
                <Fragment key={plot}>
                  <tr className="plot-heading"><th colSpan={4}>{plot}</th></tr>
                  {rows.map((tree) => <TreeRow key={tree.id} tree={tree} selected={tree.id === selectedId} maxDbhCm={maxDbhCm} onSelect={setSelectedId} />)}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="summary">
            Showing <strong>{visible.length}</strong> of {trees.length} trees{selectedId !== null && <> &middot; selected #{selectedId}</>}
          </p>
        </>
      )}
      {children}
    </section>
  );
}
