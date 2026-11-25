# Woody Theme syntax showcase: Python 3.12+.
# Demonstrates: module docstring, imports, module-level constants, numeric literal forms (int, float, exponent, hex, binary, separators), Enum and IntFlag, a frozen dataclass with field(), Protocol, TypeVar and Generic, a user-defined decorator factory, @classmethod/@staticmethod/@property, generators and `yield from`, async/await with asyncio.gather, `match` with class/mapping/sequence/or patterns and guards, f-strings with format specs, conversions and escapes, raw-string regex with named groups, anchors, classes, quantifiers and alternation, dict/set/list comprehensions, lambda, the walrus operator, try/except/else/finally, `raise ... from`, `with` and a context manager, `nonlocal`, `assert`, `del`, and the `__main__` guard.
"""Survey, sensor and sawmill helpers for the fictional Woody Lumber Yard."""

from __future__ import annotations

import asyncio
import functools
import math
import re
import time
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import Enum, IntFlag, auto
from typing import Any, Generic, Protocol, TypeVar, runtime_checkable

T = TypeVar("T")

YARD_NAME: str = "Woody Lumber Yard"
MAX_MOISTURE_PCT = 19.5  # timber at or below this moisture content is considered kiln-dry
KILN_TEMP_LIMIT_C = 8.25e1
PLOT_AREA_M2 = 4.0e2  # each survey plot is 20 m x 20 m
M2_PER_HECTARE = 10_000
SENSOR_MASK = 0xFF_00
DEBUG = False

# Tags look like "PLOT-07/QR-0042@24.5m": plot number, species code, tree number and an optional measured height.
TREE_TAG_RE = re.compile(r"^PLOT-(?P<plot>\d{2})/(?P<species>QR|PS|BP|PM)-(?P<tree>\d{4})(?:@(?P<height>\d+(?:\.\d+)?)m)?$")
# Sawmill batch IDs are "SM" + two-digit year + "-" + up to five digits, e.g. "SM26-00317".
BATCH_ID_RE = re.compile(r"\bSM(?P<year>\d{2})-(?P<seq>[0-9]{1,5})\b", re.IGNORECASE)

class Species(Enum):
    """Tree species recorded in survey plots (English oak, Scots pine, silver birch, Douglas fir), keyed by the code printed on trunk tags."""

    ENGLISH_OAK = "QR"
    SCOTS_PINE = "PS"
    SILVER_BIRCH = "BP"
    DOUGLAS_FIR = "PM"


class Defect(IntFlag):
    """Bit flags for defects found while grading a plank; combine them with ``|``."""

    NONE = 0
    KNOT = auto()
    SPLIT = auto()
    WANE = auto()
    STAIN = auto()


@dataclass(frozen=True, slots=True)
class Tree:
    """A single measured tree in a survey plot.

    Attributes:
        tree_id: Four-digit number from the trunk tag.
        species: Recorded species.
        dbh_cm: Diameter at breast height (1.3 m), in centimetres.
        height_m: Total height in metres, or ``None`` if not yet measured.
    """

    tree_id: int
    species: Species
    dbh_cm: float
    height_m: float | None = None
    notes: list[str] = field(default_factory=list)

    @property
    def basal_area_m2(self) -> float:
        """float: Cross-sectional trunk area at breast height, in square metres."""
        return math.pi * (self.dbh_cm / 200) ** 2

    @classmethod
    def from_tag(cls, tag: str, dbh_cm: float) -> Tree:
        """Build a tree from a trunk tag such as ``"PLOT-07/QR-0042@24.5m"``.

        Raises:
            ValueError: If the tag does not match ``TREE_TAG_RE``.
        """
        if (match := TREE_TAG_RE.match(tag.strip())) is None:
            raise ValueError(f"Unrecognised tree tag: {tag!r}")
        height = float(raw) if (raw := match["height"]) else None
        return cls(int(match["tree"]), Species(match["species"]), dbh_cm, height)


@runtime_checkable
class Sensor(Protocol):
    """Anything in the yard that can asynchronously report a single reading."""

    sensor_id: str

    async def read(self) -> float: ...


class MoistureProbe:
    """Pin-type moisture meter embedded in a drying stack; satisfies ``Sensor`` structurally, without inheriting from it."""

    def __init__(self, sensor_id: str, baseline_pct: float = 12.0) -> None:
        self.sensor_id = sensor_id
        self._baseline = baseline_pct

    async def read(self) -> float:
        """Simulate a network round-trip and return the moisture content in percent."""
        await asyncio.sleep(0.01)
        raw = (sum(map(ord, self.sensor_id)) << 8) & SENSOR_MASK  # keep only the high byte, as the firmware does
        return round(self._baseline + (raw >> 8) % 90 / 10, 1)

    @staticmethod
    def is_kiln_dry(reading: float) -> bool:
        """Return True if ``reading`` is a plausible kiln-dry moisture value."""
        return 0 < reading <= MAX_MOISTURE_PCT


class Ledger(Generic[T]):
    """An append-only, filterable record of items such as trees or sawmill batches."""

    def __init__(self) -> None:
        self.items: list[T] = []

    def add(self, item: T) -> Ledger[T]:
        """Append ``item`` and return the ledger so calls can be chained."""
        self.items.append(item)
        return self

    def where(self, predicate: Callable[[T], bool]) -> Iterator[T]:
        """Lazily yield only the items for which ``predicate`` returns True."""
        yield from (item for item in self.items if predicate(item))


def timed(label: str) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator factory that prints how long each call to the wrapped function takes, prefixed with ``label``."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        calls = 0

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            nonlocal calls  # rebinds the counter in the enclosing decorator scope
            calls += 1
            start = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                print(f"[{label}] {func.__name__} call #{calls} took {time.perf_counter() - start:.4f}s")

        return wrapper

    return decorator


@timed("grading")
def grade_plank(length_mm: int, defects: Defect) -> str:
    """Return ``"prime"``, ``"select"``, ``"common"`` or ``"firewood"`` for a plank of the given length and defects."""
    assert length_mm > 0, "plank length must be positive"
    if defects is Defect.NONE and length_mm >= 2_400:
        return "prime"
    elif not defects & (Defect.SPLIT | Defect.WANE):
        return "select"
    elif length_mm >= 1_200 and Defect.SPLIT not in defects:
        return "common"
    return "firewood"


def describe(record: object) -> str:
    """Return a one-line summary of a ``Tree``, a batch mapping, a coordinate pair, or anything else."""
    match record:
        case Tree(species=Species.ENGLISH_OAK, dbh_cm=dbh) if dbh >= 80:
            return f"Veteran oak, {dbh:.0f} cm DBH — protected"
        case Tree(species=species, height_m=None):
            return f"{species.name.replace('_', ' ').title()}: height not yet measured"
        case Tree(tree_id=tree_id, height_m=height):
            return f"Tree #{tree_id:04d} stands {height:>6.2f} m"
        case {"batch": str(batch_id), "planks": [first, *rest]}:
            return f"Batch {batch_id.upper()}: {len(rest) + 1} planks, first is {first!r}"
        case (float(x) | int(x), float(y) | int(y)):
            return f"Plot corner at ({x:+.4f}, {y:+.4f})"
        case _:
            return f"Unrecognised record of type {type(record).__name__}"


@contextmanager
def kiln_session(kiln_id: int) -> Iterator[dict[str, float]]:
    """Light a kiln for a drying run, yield its mutable state, and always shut the burners off afterwards."""
    state = {"temp_c": 20.0, "hours": 0.0}
    print(f"Kiln #{kiln_id:02d} lit\t(limit {KILN_TEMP_LIMIT_C:.1f}°C)")
    try:
        yield state
    finally:
        print(f"Kiln #{kiln_id:02d} off after {state['hours']:g} h\n")


async def poll_sensors(sensors: Sequence[Sensor], *, retries: int = 3) -> dict[str, float]:
    """Read every sensor concurrently, retrying the whole sweep up to ``retries`` times on transient failures.

    Raises:
        RuntimeError: If every attempt fails.
    """
    for attempt in range(1, retries + 1):
        try:
            readings = await asyncio.gather(*(sensor.read() for sensor in sensors))
        except (TimeoutError, OSError) as exc:
            if attempt == retries:
                raise RuntimeError(f"sensors unreachable after {retries} attempts") from exc
            await asyncio.sleep(0.1 * 2**attempt)  # exponential back-off before the next sweep
        else:
            return {sensor.sensor_id: value for sensor, value in zip(sensors, readings, strict=True)}
    return {}


def main() -> None:
    """Run a small end-to-end demo of the inventory helpers."""
    ledger: Ledger[Tree] = Ledger()
    for tag, dbh in [("PLOT-07/QR-0042@24.5m", 86.0), ("PLOT-07/PS-0101", 31.2), ("plot-9/??", 12.0), ("PLOT-12/PM-0007@41.25m", 64.8)]:
        try:
            ledger.add(Tree.from_tag(tag, dbh))
        except ValueError as err:
            print(f"Skipping row: {err}")

    large = sorted(ledger.where(lambda t: t.dbh_cm > 30), key=lambda t: t.basal_area_m2, reverse=True)
    counts = {sp.name.replace("_", " ").title(): sum(1 for t in ledger.items if t.species is sp) for sp in Species}
    print(f"{YARD_NAME!s:=^40}\nCounts: {counts}\nDensity: {len(ledger.items) / PLOT_AREA_M2 * M2_PER_HECTARE:,.1f} stems/ha")
    print(*(describe(tree) for tree in large), describe({"batch": "sm26-00317", "planks": ["P-1", "P-2"]}), describe((51.4778, -0.0014)), sep="\n")

    probes = [MoistureProbe("stack-A"), MoistureProbe("stack-B", baseline_pct=14.5)]
    assert all(isinstance(probe, Sensor) for probe in probes)
    readings = asyncio.run(poll_sensors(probes))
    dry_stacks = {sid for sid, pct in readings.items() if MoistureProbe.is_kiln_dry(pct)}
    print(f"Dry stacks: {', '.join(sorted(dry_stacks)) or 'none'}")

    with kiln_session(3) as kiln:
        while kiln["temp_c"] < KILN_TEMP_LIMIT_C:
            kiln["temp_c"] += 12.5
            kiln["hours"] += 1.5
            if kiln["temp_c"] > 70 and not DEBUG:
                break

    grades = [grade_plank(length, defects) for length, defects in [(2_600, Defect.NONE), (1_900, Defect.KNOT | Defect.STAIN), (800, Defect(0b0110))]]
    del ledger  # release the demo data before the final summary
    if (batch := BATCH_ID_RE.search("Shipped SM26-00317 to the joinery")) is not None:
        print(f"Batch {batch['seq']} from 20{batch['year']} graded {grades}")


if __name__ == "__main__":
    main()
