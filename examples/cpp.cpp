/**
 * @file cpp.cpp
 * @brief Woody Lumber Yard tree inventory, written in C++20.
 *
 * Demonstrates: nested namespaces and a namespace alias, using-declarations and aliases, class vs struct, inheritance with virtual/override/final, templates, a concept with requires, operator overloading (+, <<, ==), a user-defined literal, new/delete and smart pointers, lambdas with captures, enum class, constexpr, raw string literals, std::regex, range-for, structured bindings, casts, exceptions and Doxygen comments.
 */

#include <concepts>
#include <cstdint>
#include <format>
#include <iostream>
#include <map>
#include <memory>
#include <numbers>
#include <regex>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

#define WOODY_VERSION "2.0.1"

namespace woody::inventory {

using namespace std::string_literals;
using Centimetres = double;

/** @brief Species stocked by the yard; the underlying type keeps records compact. */
enum class Species : std::uint8_t { Oak, ScotsPine, SilverBirch, DouglasFir };

/** @brief Number of species, kept next to the enum so the two stay in sync. */
inline constexpr std::size_t kSpeciesCount = 4;

/**
 * @brief Converts centimetres to inches, at compile time when the argument is constant.
 * @param cm Length in centimetres.
 * @return Length in inches.
 */
constexpr double to_inches(Centimetres cm) noexcept { return cm / 2.54; }
static_assert(to_inches(2.54) == 1.0, "inch conversion must be exact");

/** @brief Strong type for lengths in metres, produced by the _m literal. */
struct Metres {
    long double value;
};

/**
 * @brief User-defined literal so heights can be written as `23.5_m`.
 * @param v The literal value in metres.
 * @return A Metres wrapper around the value.
 */
constexpr Metres operator""_m(long double v) { return Metres{v}; }

/** @brief A single trunk measurement taken in a survey plot. */
struct Measurement {
    Centimetres diameter{0.0};
    long double height_m{0.0L};

    /**
     * @brief Adds two measurements component-wise, used to accumulate plot totals.
     * @param other The measurement to add.
     * @return The component-wise sum.
     */
    Measurement operator+(const Measurement& other) const { return {diameter + other.diameter, height_m + other.height_m}; }

    /** @brief Two measurements are equal when both components match exactly. */
    bool operator==(const Measurement&) const = default;
};

/**
 * @brief Streams a measurement as `⌀ 42.00 cm × 23.5 m`.
 * @param os The output stream.
 * @param m The measurement to print.
 * @return The same stream, for chaining.
 */
std::ostream& operator<<(std::ostream& os, const Measurement& m)
{
    return os << std::format("⌀ {:.2f} cm × {} m", m.diameter, static_cast<double>(m.height_m));
}

/** @brief Thrown when a plot code or measurement cannot be parsed. */
class SurveyError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

/** @brief Abstract base for every tree in the inventory. */
class Tree {
public:
    /**
     * @brief Creates a tree with an id and a trunk measurement.
     * @param id Tag number nailed to the trunk.
     * @param m Diameter at breast height and total height.
     */
    Tree(std::uint32_t id, Measurement m) : id_{id}, measurement_{m} {}
    virtual ~Tree() = default;

    /** @brief Latin binomial of the species. */
    [[nodiscard]] virtual std::string latin_name() const = 0;

    /** @brief Form factor used to turn a cylinder volume into a realistic stem volume. */
    [[nodiscard]] virtual double form_factor() const { return 0.5; }

    /**
     * @brief Estimates stem volume in cubic metres.
     * @return π r² h scaled by the species form factor.
     */
    [[nodiscard]] double volume() const
    {
        const double r = measurement_.diameter / 200.0;
        return std::numbers::pi * r * r * static_cast<double>(measurement_.height_m) * form_factor();
    }

    [[nodiscard]] std::uint32_t id() const noexcept { return id_; }
    [[nodiscard]] const Measurement& measurement() const noexcept { return measurement_; }

protected:
    std::uint32_t id_;
    Measurement measurement_;
};

/** @brief English oak; the class is final so no further species can derive from it. */
class Oak final : public Tree {
public:
    using Tree::Tree;
    [[nodiscard]] std::string latin_name() const override { return "Quercus robur"s; }
    [[nodiscard]] double form_factor() const override { return 0.42; }
};

/** @brief Intermediate base for needle-bearing species. */
class Conifer : public Tree {
public:
    using Tree::Tree;
    [[nodiscard]] double form_factor() const override { return 0.48; }
};

/** @brief Scots pine, a conifer with the default conifer form factor. */
class ScotsPine final : public Conifer {
public:
    using Conifer::Conifer;
    [[nodiscard]] std::string latin_name() const override { return "Pinus sylvestris"s; }
};

/** @brief Anything that can report a volume in cubic metres. */
template <typename T>
concept Measurable = requires(const T& t) {
    { t.volume() } -> std::convertible_to<double>;
};

/**
 * @brief Sums the volume of every item behind a pointer-like handle.
 * @tparam Ptr A smart or raw pointer whose pointee satisfies Measurable.
 * @param items The handles to sum.
 * @return Total volume in cubic metres.
 */
template <typename Ptr>
    requires Measurable<std::remove_cvref_t<decltype(*std::declval<Ptr>())>>
double total_volume(const std::vector<Ptr>& items)
{
    double sum = 0.0;
    for (const auto& item : items) {
        sum += item->volume();
    }
    return sum;
}

/**
 * @brief Parses a plot code such as `PLOT-042-NW-north`.
 * @param code The code painted on the plot marker.
 * @return The numeric plot id.
 * @throws SurveyError if the code does not match the expected format.
 */
int parse_plot_code(const std::string& code)
{
    // Groups: 1 = plot number, 2 = compass sector, 3 = optional slope side.
    static const std::regex pattern{R"(^PLOT-(\d{3})-([NSEW]{1,2})(?:-(north|south))?$)", std::regex::ECMAScript};
    std::smatch match;
    if (!std::regex_match(code, match, pattern)) {
        throw SurveyError{"bad plot code: \""s + code + "\"\n"};
    }
    return std::stoi(match[1].str());
}

} // namespace woody::inventory

namespace inv = woody::inventory;

/**
 * @brief Builds a small inventory, prints per-species tallies and the total stem volume.
 * @return 0 on success, 1 if any plot code was rejected.
 */
int main()
{
    using inv::operator""_m;
    std::vector<std::unique_ptr<inv::Tree>> trees;
    trees.push_back(std::make_unique<inv::Oak>(1'001u, inv::Measurement{42.0, (23.5_m).value}));
    trees.push_back(std::make_unique<inv::ScotsPine>(0x3EAu, inv::Measurement{31.25, (18.0_m).value}));

    // Raw new/delete, kept only to show the operators; prefer smart pointers.
    auto* sapling = new inv::Oak{0b1111'1111, {4.5e0, 2.0L}};
    std::shared_ptr<inv::Tree> shared{new inv::ScotsPine{77, {12.0, 9.5L}}};
    trees.emplace_back(sapling);
    sapling = nullptr;

    std::map<std::string, int> tally;
    int visited = 0;
    auto count_species = [&tally, &visited](const inv::Tree& t) { ++tally[t.latin_name()]; ++visited; };
    auto next_tag = [tag = 5'000] () mutable { return tag++; };

    for (const auto& tree : trees) {
        count_species(*tree);
        std::cout << "#" << tree->id() << '\t' << tree->measurement() << '\n';
    }
    count_species(*shared);

    for (const auto& [name, count] : tally) {
        std::cout << std::format("{:<20} x{:>3}\n", name, count);
    }

    const auto total = inv::total_volume(trees) + shared->volume();
    std::cout << std::format("total volume: {:.3f} m³ across {} trees (next tag {})\n", total, visited, next_tag());

    if (auto* oak = dynamic_cast<inv::Oak*>(trees.front().get()); oak != nullptr && oak->measurement() == inv::Measurement{42.0, 23.5L}) {
        std::cout << "first tree is the reference oak\n";
    }

    int status = 0;
    for (const char* code : {"PLOT-042-NW-north", "PLOT-7-X"}) {
        try {
            const int plot = inv::parse_plot_code(code);
            std::cout << "plot " << plot << " ok\n";
        } catch (const inv::SurveyError& e) {
            std::cerr << "error: " << e.what();
            status = 1;
        }
    }

    // Offcut lengths in millimetres, on the heap to pair new[] with delete[].
    auto* offcuts = new int[3]{120, 85, 0x28};
    const int offcut_total = offcuts[0] + offcuts[1] + offcuts[2];
    delete[] offcuts;
    std::cout << "woody v" WOODY_VERSION ", offcuts " << offcut_total << " mm, sizeof(Measurement)=" << sizeof(inv::Measurement) << ", oak dbh " << inv::to_inches(42.0) << " in" << std::endl;
    return status;
}
