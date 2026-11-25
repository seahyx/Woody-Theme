//! # Woody Lumber Yard
//!
//! rust.rs - survey and plank-grading tools for the Woody Lumber Yard, written in Rust 2021.
//! Demonstrates: crate and module docs, use paths, mod, named and tuple structs, an enum with data, a trait with a default method and impls, generics with trait bounds and a where clause, lifetimes, derive attributes, a cfg(test) module, macro_rules!, println!/format!/vec!, match with guards, the ? operator with Result, closures, iterators, impl Display, raw and byte strings, const/static and a labelled loop.

use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::num::ParseIntError;

/// Moisture content (%) above which a plank goes back to the kiln.
pub const KILN_THRESHOLD: f32 = 19.5;

/// Name printed at the top of every report.
pub static YARD_NAME: &'static str = "Woody Lumber Yard";

/// Magic header written at the start of binary survey files.
const SURVEY_MAGIC: &[u8; 4] = b"WOOD";

/// Builds a `Vec<Tree>` from `tag => Species(diameter, height)` shorthand.
macro_rules! trees {
    ($($tag:literal => $species:ident($dbh:expr, $height:expr)),* $(,)?) => {
        vec![$(Tree::new($tag, Species::$species, $dbh, $height)),*]
    };
}

/// Tree species stocked by the yard.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Species {
    EnglishOak,
    ScotsPine,
    SilverBirch,
    DouglasFir,
}

impl Display for Species {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        let latin = match self {
            Species::EnglishOak => "Quercus robur",
            Species::ScotsPine => "Pinus sylvestris",
            Species::SilverBirch => "Betula pendula",
            Species::DouglasFir => "Pseudotsuga menziesii",
        };
        // `pad` (unlike `write_str`) honours width and alignment flags such as `{:<22}`.
        f.pad(latin)
    }
}

/// A length in metres; a tuple struct so it cannot be mixed up with centimetres.
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Default)]
pub struct Metres(pub f64);

/// Identifier of a survey plot, e.g. `PLOT-042`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PlotId(pub u16);

/// A standing tree measured during a survey.
#[derive(Debug, Clone)]
pub struct Tree {
    pub tag: u32,
    pub species: Species,
    pub diameter_cm: f64,
    pub height: Metres,
}

impl Tree {
    /// Creates a tree from raw survey values.
    pub fn new(tag: u32, species: Species, diameter_cm: f64, height_m: f64) -> Self {
        Self { tag, species, diameter_cm, height: Metres(height_m) }
    }
}

impl Display for Tree {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "#{:<5} {:<22} \u{2300} {:>6.2} cm, {:.1} m", self.tag, self.species, self.diameter_cm, self.height.0)
    }
}

/// Anything whose timber volume can be estimated.
pub trait Measurable {
    /// Estimated volume in cubic metres.
    fn volume(&self) -> f64;

    /// Human-readable volume; implementors usually keep this default.
    fn describe(&self) -> String {
        format!("{:.3} m\u{b3}", self.volume())
    }
}

impl Measurable for Tree {
    fn volume(&self) -> f64 {
        let r = self.diameter_cm / 200.0;
        std::f64::consts::PI * r * r * self.height.0 * 0.45
    }
}

/// A sample sent by a kiln sensor.
#[derive(Debug, Clone, PartialEq)]
pub enum Reading {
    /// Moisture content as a percentage of oven-dry weight.
    Moisture { sensor: String, percent: f32 },
    /// Air temperature in degrees Celsius.
    Temperature(String, f32),
    /// The sensor did not answer.
    Offline,
}

/// One plank cut during a sawmill batch; `defects` is a bit set of knots, splits and wane.
#[derive(Debug, Clone, Copy, Default)]
pub struct Plank {
    pub id: u32,
    pub defects: u8,
    pub moisture_pct: f32,
}

pub mod grading {
    //! Commercial grading rules for planks.

    use super::{Plank, KILN_THRESHOLD};

    /// Commercial plank grades, best first.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
    pub enum Grade {
        A,
        B,
        C,
        Reject,
    }

    /// Grades a plank from its defect bits and moisture content.
    pub fn grade(plank: &Plank) -> Grade {
        match plank.defects.count_ones() {
            _ if plank.moisture_pct > KILN_THRESHOLD * 1.5 => Grade::Reject,
            0 if plank.moisture_pct <= KILN_THRESHOLD => Grade::A,
            0..=2 => Grade::B,
            n if n < 5 => Grade::C,
            _ => Grade::Reject,
        }
    }
}

/// A borrowed view of the trees standing in one plot.
pub struct PlotView<'a> {
    pub plot: PlotId,
    pub trees: Vec<&'a Tree>,
}

impl<'a> PlotView<'a> {
    /// Returns the tallest tree; the result borrows from the inventory (`'a`), not from the view itself.
    pub fn tallest(&self) -> Option<&'a Tree> {
        self.trees.iter().copied().max_by(|a, b| a.height.0.total_cmp(&b.height.0))
    }
}

/// Errors produced while parsing survey codes.
#[derive(Debug)]
pub enum SurveyError {
    BadPrefix(String),
    BadNumber(ParseIntError),
}

impl Display for SurveyError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            SurveyError::BadPrefix(code) => write!(f, "expected \"PLOT-\" prefix in {code:?}"),
            SurveyError::BadNumber(e) => write!(f, "bad plot number: {e}"),
        }
    }
}

impl Error for SurveyError {}

/// Parses a plot code such as `PLOT-042`.
///
/// # Errors
///
/// Returns [`SurveyError`] if the prefix is missing or the number does not fit in a `u16`.
pub fn parse_plot(code: &str) -> Result<PlotId, SurveyError> {
    let digits = code.strip_prefix("PLOT-").ok_or_else(|| SurveyError::BadPrefix(code.to_owned()))?;
    let number = digits.parse::<u16>().map_err(SurveyError::BadNumber)?;
    Ok(PlotId(number))
}

/// Sums the volume of every item yielded by `items`.
pub fn total_volume<'a, I, T>(items: I) -> f64
where
    I: IntoIterator<Item = &'a T>,
    T: Measurable + 'a,
{
    items.into_iter().map(T::volume).sum()
}

fn main() -> Result<(), Box<dyn Error>> {
    let inventory = trees![
        1001 => EnglishOak(92.5, 24.0),
        1002 => ScotsPine(41.0, 31.5),
        1003 => SilverBirch(18.25, 14.0),
        1004 => DouglasFir(1.05e2, 55.0),
    ];
    println!("{YARD_NAME} \u{1F332} survey, header {:?}", std::str::from_utf8(SURVEY_MAGIC)?);
    for tree in &inventory {
        println!("\t{tree}");
    }

    let is_conifer = |s: Species| matches!(s, Species::ScotsPine | Species::DouglasFir);
    let view = PlotView { plot: parse_plot("PLOT-042")?, trees: inventory.iter().filter(|t| !is_conifer(t.species)).collect() };
    if let Some(tree) = view.tallest() {
        println!("tallest broadleaf in PLOT-{:03}: #{} ({})", view.plot.0, tree.tag, tree.describe());
    }

    let total_height = inventory.iter().map(|t| t.height.0).fold(0.0, |acc, h| acc + h);
    println!("volume {:.3} m\u{b3}, combined height {:?}", total_volume(&inventory), Metres(total_height));

    let planks: Vec<Plank> = (0..8u32).map(|i| Plank { id: 100 + i, defects: (0b1011_0001u8 >> i) & 0x0F, moisture_pct: 12.0 + i as f32 * 2.5 }).collect();
    let mut first_reject = None;
    'outer: for pass in 1..=2 {
        for plank in &planks {
            if grading::grade(plank) == grading::Grade::Reject {
                first_reject = Some((pass, plank.id));
                break 'outer;
            }
        }
    }

    let readings = vec![Reading::Moisture { sensor: "K-01".into(), percent: 22.75 }, Reading::Temperature("K-02".to_string(), 6.5e1), Reading::Offline];
    for reading in &readings {
        let line = match reading {
            Reading::Moisture { sensor, percent } if *percent > KILN_THRESHOLD => format!("{sensor}: too wet ({percent:.1}%)"),
            Reading::Moisture { sensor, .. } => format!("{sensor}: ok"),
            Reading::Temperature(sensor, c) if (60.0..=90.0).contains(c) => format!("{sensor}: drying at {c}\u{b0}C"),
            Reading::Temperature(sensor, c) => format!("{sensor}: out of range ({c:+.1})"),
            Reading::Offline => String::from("sensor offline"),
        };
        println!("{line}");
    }

    let mut header = SURVEY_MAGIC.to_vec();
    header.push(b'\n');
    let report = format!(r#"{{"yard": "{YARD_NAME}", "first_reject": "{first_reject:?}", "dir": "{}"}}"#, r"C:\woody\reports");
    println!("{report} ({} header bytes, mode {:o})", header.len(), 0o644);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grades_planks_and_parses_plots() {
        let plank = Plank { id: 1, defects: 0, moisture_pct: 12.0 };
        assert_eq!(grading::grade(&plank), grading::Grade::A);
        assert!(matches!(parse_plot("PLOT-042"), Ok(PlotId(42))));
        assert!(parse_plot("P-7").is_err());
    }
}
