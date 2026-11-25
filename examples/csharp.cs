// csharp.cs - Woody Lumber Yard sawmill grading service, written in C# 12.
// Demonstrates: #nullable, using directives (static and alias), a file-scoped namespace, #region, record and record struct, struct, interface, [Flags] enum, a custom attribute, delegate and event, a generic class with where constraints, auto/init/computed properties and an indexer, LINQ query and method syntax, async/await with Task, pattern matching (is, switch expressions, property and positional patterns), interpolated, verbatim and raw strings, Regex with named groups and XML doc comments.

#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using static System.Math;
using Tally = System.Collections.Generic.Dictionary<Woody.LumberYard.Species, int>;

namespace Woody.LumberYard;

#region Domain types

/// <summary>Tree species stocked by the yard.</summary>
public enum Species { EnglishOak, ScotsPine, SilverBirch, DouglasFir }

/// <summary>Plank defects; values combine with <c>|</c> because the enum is marked <see cref="FlagsAttribute"/>.</summary>
[Flags]
public enum Defect : byte
{
    None = 0,
    Knot = 1 << 0,
    Split = 1 << 1,
    Wane = 0b0000_0100,
    Rot = 0x08,
    Structural = Split | Rot,
}

/// <summary>Marks a type with the survey plot its data was collected from.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct, AllowMultiple = false)]
public sealed class SurveyPlotAttribute(string code) : Attribute
{
    /// <summary>Plot code painted on the marker post, e.g. <c>PLOT-042</c>.</summary>
    public string Code { get; } = code;

    /// <summary>Plot area in hectares; settable only from an attribute initializer.</summary>
    public double AreaHectares { get; init; } = 0.25;
}

/// <summary>A standing tree measured during a survey.</summary>
/// <param name="Tag">Number on the aluminium tag nailed to the trunk.</param>
/// <param name="Species">The tree's species.</param>
/// <param name="DiameterCm">Diameter at breast height (1.3 m) in centimetres.</param>
/// <param name="HeightM">Total height in metres.</param>
public record Tree(int Tag, Species Species, double DiameterCm, double HeightM)
{
    /// <summary>Cross-sectional area of the trunk at breast height, in square metres.</summary>
    public double BasalAreaM2 => PI * Pow(DiameterCm / 200.0, 2);
}

/// <summary>A single kiln sensor sample; a value type so large logs stay allocation-free.</summary>
public readonly record struct SensorReading(DateTime Timestamp, float MoisturePct, float TemperatureC);

/// <summary>One plank cut during a sawmill batch.</summary>
public struct Plank
{
    public int Id;
    public double LengthM;
    public Defect Defects;

    /// <summary>True when the plank has no recorded defects.</summary>
    public readonly bool IsClear => Defects == Defect.None;
}

/// <summary>Anything that can be assigned a commercial timber grade.</summary>
public interface IGradeable
{
    /// <summary>Grade label such as <c>"A"</c> or <c>"reject"</c>.</summary>
    string Grade { get; }

    /// <summary>Checks the item against a moisture limit.</summary>
    /// <param name="maxMoisture">Highest acceptable moisture content, in percent.</param>
    /// <returns><see langword="true"/> if the item is dry enough to sell.</returns>
    bool Passes(double maxMoisture);
}

#endregion

/// <summary>Signature for handlers notified when a batch has been graded.</summary>
/// <param name="sender">The batch that was graded.</param>
/// <param name="grade">The grade it received.</param>
public delegate void BatchGradedHandler(object sender, string grade);

/// <summary>A keyed, sorted store for inventory items.</summary>
/// <typeparam name="TKey">Key type; must be comparable so items stay sorted.</typeparam>
/// <typeparam name="TItem">Item type; a reference type so missing items can be <see langword="null"/>.</typeparam>
public class Inventory<TKey, TItem>
    where TKey : notnull, IComparable<TKey>
    where TItem : class
{
    private readonly SortedDictionary<TKey, TItem> _items = new();

    /// <summary>Looks up an item, returning <see langword="null"/> if absent.</summary>
    public TItem? this[TKey key] => _items.TryGetValue(key, out var item) ? item : null;

    /// <summary>All items in key order.</summary>
    public IEnumerable<TItem> Items => _items.Values;

    /// <summary>Adds or replaces an item.</summary>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="item"/> is null.</exception>
    public void Add(TKey key, TItem item) => _items[key] = item ?? throw new ArgumentNullException(nameof(item));
}

/// <summary>A run of planks through the saw, graded once kiln drying finishes.</summary>
[SurveyPlot("PLOT-042", AreaHectares = 0.5)]
public sealed class SawmillBatch : IGradeable
{
    /// <summary>Moisture content (%) above which planks go back to the kiln.</summary>
    public const double KilnThreshold = 19.5;

    // Named groups: year, seq and an optional shift suffix.
    private static readonly Regex CodePattern = new(@"^SB-(?<year>\d{4})-(?<seq>\d{2,3})(?:-(?<shift>day|night))?$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>Raised after <see cref="GradeAsync"/> completes.</summary>
    public event BatchGradedHandler? Graded;

    /// <summary>Creates a batch from its stencilled code.</summary>
    /// <param name="code">Batch code, e.g. <c>SB-2024-07-night</c>.</param>
    /// <exception cref="FormatException">Thrown when the code is malformed.</exception>
    public SawmillBatch(string code)
    {
        var match = CodePattern.Match(code);
        if (!match.Success)
        {
            throw new FormatException($"Unrecognised batch code \"{code}\"");
        }
        Code = code;
        Year = int.Parse(match.Groups["year"].Value);
        Shift = match.Groups["shift"].Success ? match.Groups["shift"].Value : null;
    }

    public string Code { get; }
    public int Year { get; }
    public string? Shift { get; }
    public string Operator { get; init; } = "unassigned";
    public List<Plank> Planks { get; } = [];
    public float AverageMoisture { get; private set; } = float.NaN;

    /// <inheritdoc/>
    public string Grade => Planks.Count(p => !p.IsClear) switch
    {
        0 => "A",
        <= 2 => "B",
        var n when n < Planks.Count => "C",
        _ => "reject",
    };

    /// <inheritdoc/>
    public bool Passes(double maxMoisture) => !float.IsNaN(AverageMoisture) && AverageMoisture <= maxMoisture;

    /// <summary>Samples the kiln sensors, stores the average moisture and raises <see cref="Graded"/>.</summary>
    /// <param name="samples">How many readings to take.</param>
    /// <param name="token">Cancels the sampling loop.</param>
    /// <returns>The readings, oldest first.</returns>
    public async Task<IReadOnlyList<SensorReading>> GradeAsync(int samples, CancellationToken token = default)
    {
        var readings = new List<SensorReading>(samples);
        for (var i = 0; i < samples; i++)
        {
            await Task.Delay(5, token).ConfigureAwait(false);
            readings.Add(new SensorReading(DateTime.UtcNow, 22.5f - i * 1.25f, 65.0f + i));
        }
        AverageMoisture = readings.Average(r => r.MoisturePct);
        Graded?.Invoke(this, Grade);
        return readings;
    }
}

/// <summary>Entry point for the grading report.</summary>
public static class Program
{
    /// <summary>Describes any inventory object using pattern matching.</summary>
    /// <param name="item">A tree, plank, sensor reading or <see langword="null"/>.</param>
    /// <returns>A one-line human-readable description.</returns>
    private static string Describe(object? item) => item switch
    {
        Tree { Species: Species.EnglishOak, DiameterCm: > 80 } veteran => $"veteran oak #{veteran.Tag}",
        Tree { HeightM: >= 30 and < 60 } tall => $"tall {tall.Species} ({tall.HeightM:F1} m)",
        Tree t => $"tree #{t.Tag,5}",
        Plank { IsClear: true } p => $"clear plank {p.Id:D4}",
        Plank p when (p.Defects & Defect.Structural) != 0 => $"structural defect on {p.Id}: {p.Defects}",
        SensorReading(_, var moisture, _) when moisture > SawmillBatch.KilnThreshold => $"too wet: {moisture:0.0}%",
        null => "nothing",
        _ => item.ToString() ?? string.Empty,
    };

    /// <summary>Builds sample data, grades a batch and prints a report.</summary>
    /// <returns>0 when the batch passes, 1 otherwise.</returns>
    public static async Task<int> Main()
    {
        var trees = new Inventory<int, Tree>();
        trees.Add(1001, new Tree(1001, Species.EnglishOak, 92.5, 24.0));
        trees.Add(1002, new Tree(1002, Species.ScotsPine, 41.0, 31.5));
        trees.Add(1003, new Tree(1003, Species.SilverBirch, 18.25, 14.0));
        trees.Add(1004, new Tree(1004, Species.DouglasFir, 1.05e2, 55.0));

        // Query syntax: group the larger trees by species.
        var bySpecies =
            from t in trees.Items
            where t.DiameterCm >= 20
            group t by t.Species into g
            orderby g.Key
            select new { Species = g.Key, Count = g.Count(), Basal = g.Sum(x => x.BasalAreaM2) };

        // Method syntax: the same data reshaped into a tally.
        Tally tally = trees.Items.GroupBy(t => t.Species).ToDictionary(g => g.Key, g => g.Count());

        foreach (var row in bySpecies)
        {
            Console.WriteLine($"{row.Species,-12} x{row.Count} basal {row.Basal:F2} m\u00b2");
        }

        var batch = new SawmillBatch("SB-2024-07-night") { Operator = "Shift B" };
        batch.Planks.AddRange([new Plank { Id = 1, LengthM = 2.4 }, new Plank { Id = 2, LengthM = 3.6, Defects = Defect.Knot | Defect.Split }]);
        batch.Graded += (sender, grade) => Console.WriteLine($"graded {(sender as SawmillBatch)?.Code} as {grade}");

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        var readings = await batch.GradeAsync(samples: 4, cts.Token);

        object?[] things = [trees[1001], trees[1002], trees[9999], batch.Planks[0], batch.Planks[1], readings[0], 42];
        foreach (var thing in things)
        {
            Console.WriteLine("\t" + Describe(thing));
        }

        var reportPath = @"C:\woody\reports\" + batch.Code + ".json";
        var json = $$"""
            {
              "yard": "Woody Lumber Yard",
              "batch": "{{batch.Code}}",
              "species": {{tally.Count}},
              "moisture": {{batch.AverageMoisture:F2}}
            }
            """;
        Console.WriteLine($"would write to {reportPath}:\n{json}");

        if (batch is { Shift: "night" } && !batch.Passes(SawmillBatch.KilnThreshold))
        {
            Console.Error.WriteLine("night shift batch failed the kiln check");
            return 1;
        }
        return 0;
    }
}
