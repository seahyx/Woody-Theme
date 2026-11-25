// swift.swift - Woody Lumber Yard survey and kiln report, written in Swift 5.9.
// Demonstrates: import, enums with raw values and associated values, a protocol with an associated type and a protocol extension, structs, a class hierarchy with final/override, extensions, a @propertyWrapper, generics with where clauses, optionals (if let, guard let, ??, ?.), closures with trailing-closure syntax, throws/do-catch, async/await with a task group, operator overloading, is/as?, string interpolation, raw and multi-line strings, NSRegularExpression, a labelled loop and Swift /// docs.

import Foundation

/// Moisture content (%) above which a plank goes back to the kiln.
let kilnThreshold = 19.5

/// Tree species stocked by the yard; the raw value is the Latin binomial.
enum Species: String, CaseIterable {
    case englishOak = "Quercus robur"
    case scotsPine = "Pinus sylvestris"
    case silverBirch = "Betula pendula"
    case douglasFir = "Pseudotsuga menziesii"

    /// Ratio between real stem volume and a cylinder of the same size.
    var formFactor: Double {
        switch self {
        case .englishOak: return 0.42
        case .scotsPine, .douglasFir: return 0.48
        case .silverBirch: return 0.45
        }
    }
}

/// A sample sent by a kiln sensor, carrying different data per case.
enum Reading {
    case moisture(sensor: String, percent: Double)
    case temperature(sensor: String, celsius: Double)
    case offline(sensor: String)
}

/// Errors raised while parsing the survey sheet.
enum SurveyError: Error, CustomStringConvertible {
    case malformedRow(String)
    case unknownSpecies(code: String)

    var description: String {
        switch self {
        case .malformedRow(let row): return "malformed row \"\(row)\""
        case .unknownSpecies(let code): return "unknown species code '\(code)'"
        }
    }
}

/// Clamps the wrapped value into a closed range on every write.
@propertyWrapper
struct Clamped<Value: Comparable> {
    private var value: Value
    let range: ClosedRange<Value>

    /// - Parameters:
    ///   - wrappedValue: The initial value, clamped immediately.
    ///   - range: The inclusive range values are kept within.
    init(wrappedValue: Value, _ range: ClosedRange<Value>) {
        self.range = range
        self.value = min(max(wrappedValue, range.lowerBound), range.upperBound)
    }

    var wrappedValue: Value {
        get { value }
        set { value = min(max(newValue, range.lowerBound), range.upperBound) }
    }
}

/// Anything whose timber volume can be estimated.
protocol Measurable {
    /// Estimated volume in cubic metres.
    var volume: Double { get }
}

/// A collection of surveyed items; conformers choose the concrete `Item` type.
protocol Inventory {
    associatedtype Item
    var items: [Item] { get }
    mutating func add(_ item: Item)
}

extension Inventory where Item: Measurable {
    /// Total volume of every item, available to any inventory of measurable things.
    var totalVolume: Double { items.reduce(0) { $0 + $1.volume } }
}

/// A standing tree measured in a survey plot.
struct Tree: Measurable, Hashable {
    let tag: Int
    let species: Species
    var diameterCm: Double
    var heightM: Double
    var plot: String?

    var volume: Double {
        let r = diameterCm / 200
        return .pi * r * r * heightM * species.formFactor
    }
}

/// One plank; the property wrapper keeps the moisture reading within 0–100 %.
struct Plank {
    let id: Int
    @Clamped(0...100) var moisturePercent: Double = 12.0
    var defects: Set<String> = []
}

/// The trees surveyed in one session.
struct Survey: Inventory {
    private(set) var items: [Tree] = []

    mutating func add(_ item: Tree) { items.append(item) }

    /// Merges two surveys into one.
    static func + (lhs: Survey, rhs: Survey) -> Survey {
        var merged = lhs
        rhs.items.forEach { merged.add($0) }
        return merged
    }
}

/// Base class for every powered machine in the yard.
class Machine {
    let name: String

    init(name: String) { self.name = name }

    /// A short label for logs.
    func describe() -> String { "machine \(name)" }
}

/// The drying kiln; `final` because nothing specialises it further.
final class Kiln: Machine {
    private(set) var readings: [Reading] = []

    override func describe() -> String { "kiln \(name) holding \(readings.count) readings" }

    /// Stores a reading for the next report.
    func record(_ reading: Reading) { readings.append(reading) }
}

extension Tree: CustomStringConvertible {
    var description: String { "#\(tag) \(species.rawValue) \u{2300}\(diameterCm) cm, plot \(plot ?? "off-plot")" }
}

extension Double {
    /// Formats the value as a percentage with one decimal place.
    var asPercent: String { String(format: "%.1f%%", self) }
}

/// Returns the largest element by a derived weight.
/// - Parameters:
///   - items: The collection to search.
///   - weight: Maps an element to the value being compared.
/// - Returns: The heaviest element, or `nil` if `items` is empty.
func heaviest<C: Collection>(_ items: C, by weight: (C.Element) -> Double) -> C.Element? where C.Element: Measurable {
    items.max { weight($0) < weight($1) }
}

/// Parses one row of the survey sheet.
/// - Parameter row: A comma-separated row such as `1001,englishOak,92.5,24.0,PLOT-042`.
/// - Returns: The parsed tree.
/// - Throws: `SurveyError` if the row or its species code is invalid.
func parseTree(_ row: String) throws -> Tree {
    // Groups: tag, species code, diameter, height and an optional plot code.
    let regex = try NSRegularExpression(pattern: #"^(\d+),([a-zA-Z]+),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(?:,(PLOT-\d{3}))?$"#)
    guard let match = regex.firstMatch(in: row, range: NSRange(row.startIndex..., in: row)) else {
        throw SurveyError.malformedRow(row)
    }
    func group(_ index: Int) -> String? {
        Range(match.range(at: index), in: row).map { String(row[$0]) }
    }
    guard let tag = group(1).flatMap(Int.init), let code = group(2), let dbh = group(3).flatMap(Double.init), let height = group(4).flatMap(Double.init) else {
        throw SurveyError.malformedRow(row)
    }
    guard let species = Species.allCases.first(where: { "\($0)" == code }) else {
        throw SurveyError.unknownSpecies(code: code)
    }
    return Tree(tag: tag, species: species, diameterCm: dbh, heightM: height, plot: group(5))
}

/// Reads one kiln sensor without blocking the calling thread.
/// - Parameters:
///   - id: The id stencilled on the sensor housing.
///   - sample: Index of the sample, used to fake drifting values.
/// - Returns: The sensor's reading.
func readSensor(_ id: String, sample: Int) async throws -> Reading {
    try await Task.sleep(nanoseconds: 5_000_000)
    switch id {
    case "K-02": return .temperature(sensor: id, celsius: 65 + Double(sample))
    case let other where other.hasSuffix("3") && sample > 1: return .offline(sensor: other)
    default: return .moisture(sensor: id, percent: 24.5 - Double(sample) * 1.75)
    }
}

@main
struct WoodyReport {
    static func main() async {
        let sheet = """
            1001,englishOak,92.5,24.0,PLOT-042
            1002,scotsPine,41.0,31.5
            1003,silverBirch,18.25,14.0,PLOT-043
            1004,larch,30,20
            """
        var survey = Survey()
        for row in sheet.split(separator: "\n") {
            do {
                try survey.add(parseTree(String(row)))
            } catch let error as SurveyError {
                print("skipped: \(error)")
            } catch {
                print("unexpected: \(error.localizedDescription)")
            }
        }
        survey = survey + Survey()
        print("Woody Lumber Yard: \(survey.items.count) trees, \(String(format: "%.3f", survey.totalVolume)) m\u{00B3}")
        survey.items.sorted { $0.volume > $1.volume }.forEach { print("\t\($0)") }

        if let biggest = heaviest(survey.items, by: \.volume), let plot = biggest.plot?.uppercased() {
            print("largest stem stands in \(plot)")
        }

        let kiln = Kiln(name: "K")
        let readings = (try? await withThrowingTaskGroup(of: Reading.self) { group in
            for id in ["K-01", "K-02", "K-03"] {
                group.addTask { try await readSensor(id, sample: 2) }
            }
            return try await group.reduce(into: [Reading]()) { $0.append($1) }
        }) ?? []
        readings.forEach(kiln.record)

        outer: for reading in kiln.readings {
            switch reading {
            case let .moisture(sensor, percent) where percent > kilnThreshold:
                print("\(sensor): too wet (\(percent.asPercent))")
                break outer
            case .moisture(let sensor, _), .temperature(let sensor, _):
                print("\(sensor): ok")
            case .offline(let sensor):
                print("\(sensor): offline")
            }
        }

        var plank = Plank(id: 0x2A)
        plank.moisturePercent = 140 // clamped to 100 by the property wrapper
        let machine: Machine = kiln
        print("\(machine.describe()); is kiln: \(machine is Kiln); plank \(plank.id) at \((machine as? Kiln) != nil ? plank.moisturePercent.asPercent : "n/a"), mask \(0b1010 | 0o5), scale \(0x1p4 * 2.5e-1)")
    }
}
