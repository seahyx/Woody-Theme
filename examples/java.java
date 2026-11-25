/*
 * java.java - Woody Lumber Yard survey report, written in Java 17.
 * Demonstrates: package and imports (single, wildcard and static), annotations (@Override, @FunctionalInterface, a custom @interface), an enum with fields/constructor/methods, records with a compact constructor, a sealed interface with permits, generics with bounded wildcards, switch expressions with yield, instanceof patterns, streams with lambdas and method references, text blocks, var, try-with-resources, Pattern regex with named groups, labelled break and Javadoc.
 * Every top-level type is package-private because a public class would have to be named after the file.
 */
package woody.lumberyard;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.lang.annotation.*;
import java.util.*;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static java.lang.Math.PI;
import static java.util.stream.Collectors.groupingBy;

/** Marks a type with the survey plot its data came from. */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@interface SurveyPlot {
    /** Plot code painted on the marker post. */
    String code();

    /** Plot area in hectares. */
    double areaHectares() default 0.25;
}

/** Tree species stocked by the yard, each with the form factor used for volume estimates. */
enum Species {
    ENGLISH_OAK("Quercus robur", 0.42),
    SCOTS_PINE("Pinus sylvestris", 0.48),
    SILVER_BIRCH("Betula pendula", 0.45),
    DOUGLAS_FIR("Pseudotsuga menziesii", 0.50);

    private final String latinName;
    private final double formFactor;

    Species(String latinName, double formFactor) {
        this.latinName = latinName;
        this.formFactor = formFactor;
    }

    /** @return the Latin binomial, e.g. {@code "Quercus robur"} */
    String latinName() { return latinName; }

    /** @return the ratio between real stem volume and a cylinder of the same size */
    double formFactor() { return formFactor; }

    /** @return {@code true} for needle-bearing species */
    boolean isConifer() { return this == SCOTS_PINE || this == DOUGLAS_FIR; }
}

/**
 * A standing tree measured in a survey plot.
 *
 * @param tag        number on the aluminium tag nailed to the trunk
 * @param species    the tree's {@link Species}
 * @param diameterCm diameter at breast height, in centimetres
 * @param heightM    total height, in metres
 */
record Tree(int tag, Species species, double diameterCm, double heightM) {
    /** Compact constructor: validates before the fields are assigned. */
    Tree {
        if (diameterCm <= 0.0 || heightM <= 0.0) {
            throw new IllegalArgumentException("non-positive measurement for tag " + tag);
        }
    }

    /** @return estimated stem volume in cubic metres */
    double volume() {
        final double r = diameterCm / 200.0;
        return PI * r * r * heightM * species.formFactor();
    }
}

/** A sensor sample from the drying kiln; only the listed records may implement it. */
sealed interface Reading permits MoistureReading, TemperatureReading {
    /** @return the id stencilled on the sensor housing */
    String sensorId();
}

/** Moisture content as a percentage of oven-dry weight. */
record MoistureReading(String sensorId, double percent) implements Reading {}

/** Air temperature inside the kiln, in degrees Celsius. */
record TemperatureReading(String sensorId, double celsius) implements Reading {}

/**
 * Assigns a grade label to an item.
 *
 * @param <T> the type of item being graded
 */
@FunctionalInterface
interface Grader<T> {
    /** @return the grade label for {@code item} */
    String grade(T item);

    /**
     * Wraps this grader so items rejected by {@code accept} get a fixed label instead.
     *
     * @param accept   predicate an item must pass to be graded normally
     * @param fallback label used for every other item
     * @return a new grader
     */
    default Grader<T> unless(Predicate<? super T> accept, String fallback) {
        return item -> accept.test(item) ? grade(item) : fallback;
    }
}

/**
 * A typed collection of trees.
 *
 * @param <T> the kind of tree stored
 */
final class Inventory<T extends Tree> implements Iterable<T> {
    private final List<T> items = new ArrayList<>();

    /** Producer-extends: accepts any collection of T or a subtype. */
    void addAll(Collection<? extends T> more) { items.addAll(more); }

    /** Consumer-super: copies every item into a sink that can hold T. */
    void drainTo(Collection<? super T> sink) { sink.addAll(items); }

    @Override
    public Iterator<T> iterator() { return items.iterator(); }
}

/** Builds the yard's daily survey and kiln report. */
@SurveyPlot(code = "PLOT-042", areaHectares = 0.5)
final class LumberYardReport {
    static final double KILN_THRESHOLD = 19.5;
    static final long SURVEY_SEED = 0xCAFE_F00DL;
    private static final Pattern BATCH_CODE = Pattern.compile("^SB-(?<year>\\d{4})-(\\d{2,3})(?:-(day|night))?$", Pattern.CASE_INSENSITIVE);

    private LumberYardReport() {}

    /**
     * Maps a defect count to a commercial grade.
     *
     * @param defects number of knots, splits and wane marks found on the plank
     * @return {@code "A"}, {@code "B"}, {@code "C"} or {@code "reject"}
     */
    static String gradeFor(int defects) {
        return switch (defects) {
            case 0 -> "A";
            case 1, 2 -> "B";
            default -> {
                if (defects > 5) {
                    yield "reject";
                }
                yield "C";
            }
        };
    }

    /**
     * Describes a kiln reading using {@code instanceof} patterns.
     *
     * @param reading the sample to describe
     * @return a one-line summary
     */
    static String describe(Reading reading) {
        if (reading instanceof MoistureReading m && m.percent() > KILN_THRESHOLD) {
            return String.format("%s: too wet (%.1f%%)", m.sensorId(), m.percent());
        } else if (reading instanceof TemperatureReading t) {
            return "%s: %+.1f°C".formatted(t.sensorId(), t.celsius());
        }
        return reading.sensorId() + ": ok";
    }

    /**
     * Extracts the year from a batch code such as {@code SB-2024-07-night}.
     *
     * @param code the stencilled batch code
     * @return the four-digit year
     * @throws IllegalArgumentException if {@code code} does not match {@link #BATCH_CODE}
     */
    static int batchYear(String code) {
        Matcher matcher = BATCH_CODE.matcher(code);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("bad batch code: \"" + code + "\"");
        }
        return Integer.parseInt(matcher.group("year"));
    }

    /**
     * Entry point: parses the survey sheet, summarises it and checks the kiln.
     *
     * @param args unused
     * @throws IOException if the survey sheet cannot be read
     */
    public static void main(String[] args) throws IOException {
        final String sheet = """
            tag,species,diameter_cm,height_m
            1001,ENGLISH_OAK,92.5,24.0
            1002,SCOTS_PINE,41.0,31.5
            1003,SILVER_BIRCH,18.25,14.0
            1004,DOUGLAS_FIR,1.05e2,55.0
            """;

        var inventory = new Inventory<Tree>();
        try (var reader = new BufferedReader(new StringReader(sheet))) {
            List<Tree> parsed = reader.lines()
                .skip(1)
                .map(line -> line.split(","))
                .map(f -> new Tree(Integer.parseInt(f[0]), Species.valueOf(f[1]), Double.parseDouble(f[2]), Double.parseDouble(f[3])))
                .toList();
            inventory.addAll(parsed);
        }

        List<Object> everything = new ArrayList<>();
        inventory.drainTo(everything);

        Map<Species, Long> counts = everything.stream()
            .filter(Tree.class::isInstance)
            .map(Tree.class::cast)
            .collect(groupingBy(Tree::species, () -> new EnumMap<>(Species.class), Collectors.counting()));
        counts.forEach((species, n) -> System.out.printf("%-22s %d%n", species.latinName(), n));

        Grader<Tree> grader = tree -> tree.volume() > 2.0 ? "veneer" : "sawlog";
        Grader<Tree> safeGrader = grader.unless(t -> !t.species().isConifer() || t.heightM() < 50, "check");
        for (Tree tree : inventory) {
            System.out.println("\t#" + tree.tag() + " -> " + safeGrader.grade(tree) + ", grade " + gradeFor(tree.tag() % 7));
        }

        List<Reading> readings = List.of(new MoistureReading("K-01", 22.75), new TemperatureReading("K-02", 6.5e1), new MoistureReading("K-03", 12.0));
        boolean anyWet = false;
        outer:
        for (int pass = 0; pass < 2; pass++) {
            for (Reading r : readings) {
                System.out.println(describe(r));
                if (r instanceof MoistureReading m && m.percent() > KILN_THRESHOLD) {
                    anyWet = true;
                    break outer;
                }
            }
        }

        SurveyPlot plot = LumberYardReport.class.getAnnotation(SurveyPlot.class);
        System.out.printf("plot %s (%.2f ha), batch year %d, wet=%b, seed=%x%n", plot.code(), plot.areaHectares(), batchYear("SB-2024-07-night"), anyWet, SURVEY_SEED);
    }
}
