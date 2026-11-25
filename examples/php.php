<?php

// Woody Theme syntax showcase: PHP 8.2.
// Demonstrates: strict_types, namespaces and `use` (class, function, const), namespaced constants, numeric literal forms (hex, binary, exponent, separators), backed enums with constants and methods, attributes, interfaces, abstract/final/readonly classes, constructor property promotion, readonly typed properties, static properties and late static binding, `new` in initialisers, match, arrow functions and first-class callables, a generator with `yield from`, heredoc with {$obj->prop} interpolation and nowdoc, preg_match/preg_match_all with named groups, null coalescing (??, ??=) and nullsafe (?->), variadics and named arguments, try/catch/finally and throw expressions, instanceof/new/clone, alternative control-structure syntax in an embedded HTML template, and PHPDoc.

declare(strict_types=1);

namespace Woody\Inventory;

use Attribute;
use DateTimeImmutable;
use InvalidArgumentException;
use RuntimeException;
use function array_filter;
use function sprintf;
use const PREG_UNMATCHED_AS_NULL;

/** Moisture content (%) at or below which timber counts as kiln-dry. */
const MAX_MOISTURE = 19.5;
/** Kiln shut-off temperature in °C. */
const KILN_LIMIT_C = 8.25e1;
/** Square metres in one hectare, and in one 20 m x 20 m survey plot. */
const M2_PER_HECTARE = 10_000;
const PLOT_AREA_M2 = 400;

/** Label printed on each drying stack; a nowdoc keeps the `{$...}` placeholders literal so strtr() can fill them later. */
const STACK_LABEL = <<<'LABEL'
    WOODY LUMBER YARD
    Stack {$id} :: {$species}
    Keep dry, kiln limit {$limit}
    LABEL;

/** Species codes as printed on trunk tags. */
enum Species: string
{
    case EnglishOak = 'QR';
    case ScotsPine = 'PS';
    case SilverBirch = 'BP';
    case DouglasFir = 'PM';

    /** @return string The binomial (Latin) name. */
    public function latinName(): string
    {
        return match ($this) {
            self::EnglishOak => 'Quercus robur',
            self::ScotsPine => 'Pinus sylvestris',
            self::SilverBirch => 'Betula pendula',
            self::DouglasFir => 'Pseudotsuga menziesii',
        };
    }
}

/** Commercial plank grades, best first, plus the defect bit flags used to assign them. */
enum Grade: int
{
    case Prime = 1;
    case Select = 2;
    case Common = 3;
    case Firewood = 0x10;

    public const KNOT = 0b0001;
    public const SPLIT = 0b0010;
    public const WANE = 0b0100;
    public const STAIN = 0b1000;

    /** Grade a plank from its defect flags (a bitwise OR of the constants above) and its length in millimetres. */
    public static function assess(int $defects, int $lengthMm): self
    {
        return match (true) {
            $defects === 0 && $lengthMm >= 2_400 => self::Prime,
            ($defects & (self::SPLIT | self::WANE)) === 0 => self::Select,
            $lengthMm >= 1_200 && !($defects & self::SPLIT) => self::Common,
            default => self::Firewood,
        };
    }
}

/** Marks a method or function whose calls should be written to the audit log. */
#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_FUNCTION)]
final class Audited
{
    public function __construct(public string $label = 'inventory') {}
}

/** Anything with a measurable trunk. */
interface Measurable
{
    /** @return float Cross-sectional area at breast height, in m². */
    public function basalArea(): float;
}

/** Base class for every record collected in the field. */
abstract class Specimen implements Measurable
{
    protected static int $created = 0;

    public function __construct(
        public readonly int $id,
        public readonly DateTimeImmutable $measuredAt = new DateTimeImmutable(),
    ) {
        static::$created++;
    }

    /** @return string One-line, human-readable summary. */
    abstract public function describe(): string;

    /** @return int Number of specimens created during this request. */
    public static function created(): int
    {
        return static::$created;
    }
}

/** A single measured tree in a survey plot. */
final class Tree extends Specimen
{
    /** Matches tags such as "PLOT-07/QR-0042@24.5m": plot, species code, tree number and an optional height in metres. */
    private const TAG_PATTERN = '/^PLOT-(?<plot>\d{2})\/(?<species>QR|PS|BP|PM)-(?<tree>\d{4})(?:@(?<height>\d+(?:\.\d+)?)m)?$/';

    /** @param string[] $notes Free-text field observations. */
    public function __construct(
        int $id,
        public readonly Species $species,
        public readonly float $dbhCm,
        public readonly ?float $heightM = null,
        private array $notes = [],
    ) {
        parent::__construct($id);
    }

    /** @throws InvalidArgumentException If the tag is malformed. */
    public static function fromTag(string $tag, float $dbhCm): self
    {
        if (preg_match(self::TAG_PATTERN, trim($tag), $m, PREG_UNMATCHED_AS_NULL) !== 1) {
            throw new InvalidArgumentException("Unrecognised tree tag \"{$tag}\"");
        }

        return new self((int) $m['tree'], Species::from($m['species']), $dbhCm, heightM: $m['height'] !== null ? (float) $m['height'] : null);
    }

    public function basalArea(): float
    {
        return M_PI * ($this->dbhCm / 200) ** 2;
    }

    #[Audited('notes')]
    public function addNote(string $note): void
    {
        $this->notes[] = $note;
    }

    public function describe(): string
    {
        $height = $this->heightM !== null ? sprintf('%.1f m', $this->heightM) : 'unmeasured';

        return sprintf("#%04d %s (%s)\t%.1f cm, %s", $this->id, $this->species->name, $this->species->latinName(), $this->dbhCm, $height);
    }
}

/** An immutable moisture or temperature reading from one probe. */
final readonly class Reading
{
    public function __construct(public string $sensorId, public float $value, public string $kind = 'moisture') {}

    public function isDry(): bool
    {
        return $this->kind === 'moisture' && $this->value <= MAX_MOISTURE;
    }
}

/**
 * In-memory register of surveyed trees.
 *
 * @implements \IteratorAggregate<int, Tree>
 */
final class Inventory implements \Countable, \IteratorAggregate
{
    /** @var array<int, Tree> Trees keyed by tag number. */
    private array $trees = [];

    public function __construct(public readonly string $name = 'Woody Lumber Yard') {}

    public function add(Tree ...$trees): self
    {
        foreach ($trees as $tree) {
            $this->trees[$tree->id] ??= $tree; // the first measurement of a tag wins
        }

        return $this;
    }

    public function count(): int
    {
        return count($this->trees);
    }

    /** @return \Generator<int, Tree> Trees from largest to smallest basal area. */
    public function getIterator(): \Generator
    {
        $sorted = $this->trees;
        usort($sorted, static fn (Tree $a, Tree $b): int => $b->basalArea() <=> $a->basalArea());
        yield from $sorted;
    }
}

/**
 * Render a plain-text survey report.
 *
 * @param array<string, Reading> $readings Latest probe readings keyed by sensor ID.
 */
#[Audited('report')]
function renderReport(Inventory $inventory, array $readings = []): string
{
    $density = number_format(count($inventory) / PLOT_AREA_M2 * M2_PER_HECTARE, 1);
    $dry = implode(', ', array_keys(array_filter($readings, fn (Reading $r): bool => $r->isDry()))) ?: 'none';
    $largest = $inventory->getIterator()->current()?->describe() ?? 'n/a';

    return <<<TXT
        {$inventory->name} \u{2014} survey report
        Trees measured:\t{$inventory->count()}
        Largest:\t{$largest}
        Density:\t{$density} stems/ha
        Dry stacks:\t{$dry}
        TXT;
}

// Demo: parse the field sheet, poll the probes and render an HTML summary.
$inventory = new Inventory();
$fieldSheet = ['PLOT-07/QR-0042@24.5m' => 86.0, 'PLOT-07/PS-0101' => 31.2, 'plot-9/??' => 12.0, 'PLOT-12/PM-0007@41.25m' => 64.8];
foreach ($fieldSheet as $tag => $dbh) {
    try {
        $inventory->add(Tree::fromTag($tag, $dbh));
    } catch (InvalidArgumentException $e) {
        error_log("Skipping row: {$e->getMessage()}");
    } finally {
        $rowsRead = ($rowsRead ?? 0) + 1;
    }
}

$readings = ['stack-A' => new Reading('stack-A', 17.25), 'stack-B' => new Reading('stack-B', 2.15e1)];
$snapshot = clone $readings['stack-A']; // readonly objects can still be cloned
$veterans = array_filter(iterator_to_array($inventory, false), fn (Tree $t): bool => $t->dbhCm >= 80 && $t->species === Species::EnglishOak);
$toUpper = strtoupper(...); // first-class callable syntax
$batchIds = preg_match_all('/\bSM(?<year>\d{2})-(?<seq>[0-9]{1,5})\b/i', 'Shipped SM26-00317 and sm26-00318', $matches) > 0 ? array_map($toUpper, $matches[0]) : [];
$label = strtr(STACK_LABEL, ['{$id}' => 'A', '{$species}' => Species::ScotsPine->latinName(), '{$limit}' => KILN_LIMIT_C . '°C']);
$grade = Grade::assess(Grade::KNOT | Grade::STAIN, lengthMm: 1_900);
$report = renderReport($inventory, $readings) ?: throw new RuntimeException('Empty report');
?>
<section class="inventory">
  <h1><?= htmlspecialchars($inventory->name) ?> &mdash; <?= count($inventory) ?> trees from <?= $rowsRead ?> rows (<?= Specimen::created() ?> specimens)</h1>
  <pre><?= htmlspecialchars($report) ?></pre>
  <table>
    <tr><th>Tag</th><th>Species</th><th>DBH (cm)</th></tr>
<?php foreach ($inventory as $tree): ?>
    <tr class="<?= $tree instanceof Tree && in_array($tree, $veterans, true) ? 'veteran' : '' ?>">
      <td><?= sprintf('%04d', $tree->id) ?></td>
      <td><abbr title="<?= $tree->species->latinName() ?>"><?= $tree->species->name ?></abbr></td>
      <td><?= number_format($tree->dbhCm, 1) ?></td>
    </tr>
<?php endforeach; ?>
  </table>
<?php if ($batchIds !== []): ?>
  <p>Shipped batches: <?= implode(', ', $batchIds) ?>; last plank graded <?= $grade->name ?>; probe <?= $snapshot->sensorId ?> reads <?= $snapshot->value ?>%.</p>
<?php endif; ?>
  <pre class="label"><?= htmlspecialchars($label) ?></pre>
</section>
