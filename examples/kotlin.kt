// kotlin.kt - Woody Lumber Yard kiln and survey report, written in Kotlin 1.9 with kotlinx.coroutines.
// Demonstrates: file annotations, package and imports, const val, enum class with properties, data class, value class, sealed interface and sealed class, object and companion object, extension functions and properties, generics with out/in variance and reified type parameters, coroutines (suspend, launch, async, coroutineScope), when expressions, null safety (?., ?:, !!), string templates, raw strings, Regex with groups, labels and KDoc.

@file:JvmName("WoodyReport")
@file:Suppress("MagicNumber")

package woody.lumberyard

import kotlin.math.PI
import kotlin.math.pow
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/** Moisture content (%) above which a plank goes back to the kiln. */
const val KILN_THRESHOLD = 19.5

/**
 * Tree species stocked by the yard.
 *
 * @property latinName the Latin binomial, e.g. `Quercus robur`
 * @property formFactor ratio between real stem volume and a cylinder of the same size
 */
enum class Species(val latinName: String, val formFactor: Double) {
    ENGLISH_OAK("Quercus robur", 0.42),
    SCOTS_PINE("Pinus sylvestris", 0.48),
    SILVER_BIRCH("Betula pendula", 0.45),
    DOUGLAS_FIR("Pseudotsuga menziesii", 0.50);

    /** True for needle-bearing species. */
    val isConifer: Boolean
        get() = this == SCOTS_PINE || this == DOUGLAS_FIR
}

/** A survey plot code such as `PLOT-042`, wrapped without runtime overhead. */
@JvmInline
value class PlotCode(val code: String)

/**
 * A standing tree measured in a survey plot.
 *
 * @property tag number on the aluminium tag nailed to the trunk
 * @property diameterCm diameter at breast height, in centimetres
 * @property plot the plot the tree stands in, or `null` if it was surveyed off-plot
 */
data class Tree(val tag: Int, val species: Species, val diameterCm: Double, val heightM: Double, val plot: PlotCode? = null) {
    /** Estimated stem volume in cubic metres. */
    val volume: Double
        get() = PI * (diameterCm / 200).pow(2) * heightM * species.formFactor

    companion object {
        // Groups: tag, species, diameter, height and an optional plot code.
        private val CSV_ROW = Regex("""^(\d+),([A-Z_]+),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:,(PLOT-\d{3}))?$""")

        /**
         * Parses one row of the survey sheet.
         *
         * @param row a comma-separated row
         * @return the parsed tree, or `null` if the row is malformed
         */
        @JvmStatic
        fun parse(row: String): Tree? {
            val match = CSV_ROW.matchEntire(row.trim()) ?: return null
            val (tag, species, dbh, height, plot) = match.destructured
            return Tree(tag.toInt(), Species.valueOf(species), dbh.toDouble(), height.toDouble(), plot.takeIf { it.isNotEmpty() }?.let(::PlotCode))
        }
    }
}

/** Extension property: diameter at breast height in inches. */
val Tree.diameterInches: Double
    get() = diameterCm / 2.54

/**
 * Formats a number as a percentage.
 *
 * @receiver the value to format, already in percent
 * @param decimals digits after the decimal point
 * @return e.g. `"22.8%"`
 */
fun Double.asPercent(decimals: Int = 1): String = "%.${decimals}f%%".format(this)

/** A sample sent by a kiln sensor; the compiler knows every implementation. */
sealed interface Reading {
    val sensorId: String
}

/** Moisture content as a percentage of oven-dry weight. */
data class Moisture(override val sensorId: String, val percent: Double) : Reading

/** Air temperature inside the kiln, in degrees Celsius. */
data class Temperature(override val sensorId: String, val celsius: Double) : Reading

/** The sensor did not answer. */
data class Offline(override val sensorId: String) : Reading

/** Outcome of grading a kiln load. */
sealed class GradeResult {
    /** The load is dry; [grade] is the commercial grade. */
    data class Passed(val grade: Char) : GradeResult()

    /** The load must be dried again because of the listed sensors. */
    data class Rekiln(val wetSensors: List<String>) : GradeResult()

    /** Grading never ran. */
    data object NotGraded : GradeResult()
}

/** Yard-wide settings; `object` makes this a lazily created singleton. */
object YardConfig {
    const val NAME = "Woody Lumber Yard"
    val sensorIds = listOf("K-01", "K-02", "K-03")

    @Volatile
    var verbose = false
}

/** A producer of items; `out` lets a `Source<Tree>` be used where a `Source<Any>` is expected. */
interface Source<out T> {
    /** @return the next item, or `null` when exhausted */
    fun next(): T?
}

/** A consumer of items; `in` lets a `Sink<Any>` accept trees. */
fun interface Sink<in T> {
    /** Receives one item. */
    fun accept(item: T)
}

/** A [Source] backed by a list. */
class ListSource<out T>(private val items: List<T>) : Source<T> {
    private var index = 0
    override fun next(): T? = items.getOrNull(index++)
}

/**
 * Moves every item from [source] into [sink].
 *
 * @return the number of items moved
 */
fun <T : Any> pump(source: Source<T>, sink: Sink<T>): Int {
    var moved = 0
    while (true) {
        val item = source.next() ?: break
        sink.accept(item)
        moved++
    }
    return moved
}

/** Keeps only the readings of type [R]; `reified` makes `R` available at runtime. */
inline fun <reified R : Reading> List<Reading>.only(): List<R> = filterIsInstance<R>()

/**
 * Reads one sensor, suspending instead of blocking the thread.
 *
 * @param id sensor id stencilled on the housing
 * @param sample index of the sample, used to fake drifting values
 */
suspend fun readSensor(id: String, sample: Int): Reading {
    delay(10L * sample)
    return when {
        id.endsWith("3") && sample > 1 -> Offline(id)
        id == "K-02" -> Temperature(id, 65.0 + sample)
        else -> Moisture(id, 24.5 - sample * 1.75)
    }
}

/**
 * Reads every sensor concurrently and grades the kiln load.
 *
 * @param sensors ids of the sensors to poll
 * @return [GradeResult.Passed] when every moisture reading is under [KILN_THRESHOLD]
 */
suspend fun gradeKiln(sensors: List<String>): GradeResult = coroutineScope {
    val readings = sensors.map { id -> async { readSensor(id, sample = 2) } }.awaitAll()
    val wet = readings.only<Moisture>().filter { it.percent > KILN_THRESHOLD }.map(Moisture::sensorId)
    if (wet.isEmpty()) GradeResult.Passed('A') else GradeResult.Rekiln(wet)
}

fun main() = runBlocking {
    val sheet = """
        |1001,ENGLISH_OAK,92.5,24.0,PLOT-042
        |1002,SCOTS_PINE,41.0,31.5
        |1003,SILVER_BIRCH,18.25,14.0,PLOT-043
        |not a tree
    """.trimMargin()
    val trees = sheet.lines().mapNotNull(Tree::parse)

    val collected = mutableListOf<Any>()
    val moved = pump(ListSource(trees), Sink<Any> { collected += it })
    println("${YardConfig.NAME}: $moved trees, total volume ${"%.3f".format(trees.sumOf { it.volume })} m³")

    for (tree in trees) {
        val size = when (tree.diameterCm.toInt()) {
            in 0 until 20 -> "pole"
            in 20..59 -> "mature"
            else -> "veteran"
        }
        println("\t#${tree.tag} ${tree.species.latinName.padEnd(18)} $size, plot ${tree.plot?.code ?: "off-plot"}")
    }

    val heartbeat = launch {
        repeat(3) { i -> if (YardConfig.verbose) println("heartbeat $i"); delay(5) }
    }
    val message = when (val result = gradeKiln(YardConfig.sensorIds)) {
        is GradeResult.Passed -> "passed with grade ${result.grade}"
        is GradeResult.Rekiln -> "re-kiln needed: ${result.wetSensors.joinToString(separator = ", ")}"
        GradeResult.NotGraded -> "not graded"
    }
    heartbeat.join()
    println(message)

    val oak = trees.find { it.species == Species.ENGLISH_OAK }!!
    outer@ for (species in Species.values()) {
        for (tree in trees) {
            if (tree.species == species && species.isConifer) {
                println("first conifer: ${tree.tag} (${tree.heightM}m, ${(tree.heightM / 40 * 100).asPercent()} of max)")
                break@outer
            }
        }
    }
    println("oak #${oak.tag} is ${oak.diameterInches.toInt()} in across; sensors 0x${0xFF.toString(16)}, flags 0b${0b1010.toString(2)}, budget \$${"%,d".format(1_250_000L)}")
}
