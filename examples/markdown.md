<!--
markdown.md: field notes for the Woody Lumber Yard, used to preview the Woody theme's Markdown highlighting.
Demonstrates: ATX and setext headings, emphasis, strikethrough, inline code, inline/reference/auto links, images, nested blockquotes, ordered/unordered/nested/task lists, an aligned table, fenced code in several languages, an indented code block, horizontal rules, footnotes, inline HTML, escapes, a hard line break and HTML comments.
-->

# Woody Lumber Yard Field Notes

Autumn Survey 2026
==================

## Overview

This week's survey covered *four* plots on the north ridge and **two** in the river meadow. The ***headline finding*** is that the Scots pine stand in plot N-3 has outgrown its thinning schedule, so the ~~spring~~ winter harvest is brought forward. Measurements were logged with the `woody-survey` CLI and exported to `plots/2026-w47.json`.

For background, see the [grading handbook](https://docs.example.org/grading "Grading handbook, 2026 edition"), the [moisture guide][moisture], or the [species index][]. Raw exports live at <https://data.example.com/woody/exports> and questions go to <survey@example.com>.

Field lead: Plot Team A
Recorder: Plot Team B

### Species at a glance

![Cross-section of an English oak trunk](https://img.example.com/woody/oak-rings.png "Quercus robur, 212 rings")

| Species       | Latin name              | Mean DBH (cm) | Height (m) | Hardwood |
| :------------ | :---------------------- | ------------: | ---------: | :------: |
| English oak   | *Quercus robur*         |          71.4 |       24.0 |   yes    |
| Scots pine    | *Pinus sylvestris*      |          38.9 |       27.5 |    no    |
| Silver birch  | *Betula pendula*        |          22.1 |       18.2 |   yes    |
| Douglas fir   | *Pseudotsuga menziesii* |          54.0 |       41.3 |    no    |

#### Notes from the ridge

> Plot N-3 is badly overcrowded; crowns are touching on all sides.
>
> > **Recorder's reply:** agreed, and the understorey is almost bare.
> >
> > - 14 pines marked for removal
> > - 3 birches left as seed trees
>
> Revisit after the first frost.

##### Procedure

1. Mark the plot centre with a stake.
2. Measure every stem inside a 12.6 m radius:
   - diameter at breast height (1.3 m)
   - total height with the clinometer
     1. sight the tip
     2. sight the base
3. Log moisture readings for any felled logs.

###### Footnotes and housekeeping

Diameter at breast height is the industry standard[^dbh], and moisture targets follow the kiln schedule[^kiln].

[^dbh]: Measured 1.3 m above ground on the uphill side of the trunk.
[^kiln]: Hardwoods are dried to 10 to 12 %, softwoods to 15 %.

---

## Checklist

- [x] Calibrate the moisture meter
- [x] Photograph plot markers
- [ ] Upload the GPS track
- [ ] Order replacement tags

* Unordered lists can use asterisks
+ or plus signs
- or hyphens

## Code samples

Parse a plot export in Python:

```python
from dataclasses import dataclass

@dataclass
class Tree:
    species: str
    dbh_cm: float

def basal_area(trees: list[Tree]) -> float:
    """Total basal area in square metres."""
    return sum(3.14159 * (t.dbh_cm / 200) ** 2 for t in trees)
```

The same in JavaScript:

```js
const basalArea = (trees) =>
  trees.reduce((sum, { dbhCm }) => sum + Math.PI * (dbhCm / 200) ** 2, 0);

console.log(`Basal area: ${basalArea(trees).toFixed(2)} m²`);
```

A single record from the export:

```json
{
  "plot": "N-3",
  "species": "Pinus sylvestris",
  "dbh_cm": 38.9,
  "flagged": true,
  "notes": null
}
```

Sync exports from the field laptop:

```bash
#!/usr/bin/env bash
rsync -avz --delete ./plots/ "survey@data.example.com:/srv/woody/${SEASON:-autumn}/"
```

What changed in the thinning plan:

```diff
- harvest_window: 2027-04
+ harvest_window: 2026-12
  plots:
-   - N-2
+   - N-3
```

An indented code block (four spaces):

    $ woody-survey export --plot N-3 --format csv
    exported 112 rows to plots/N-3.csv

***

## Inline HTML and escapes

Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> to export the current plot.

<details>
<summary>Raw sensor dump (click to expand)</summary>

Kiln 2 averaged 61 °C at 14 % relative humidity overnight.

</details>

Literal characters: \*not italic\*, \_not italic\_, \`not code\`, \# not a heading, 1\. not a list, and a backslash \\.

Last line of the notes, followed by a hard break  
and a continuation on the next line.

<!-- TODO: add plot photos once the upload finishes. -->

[moisture]: https://docs.example.org/moisture "Moisture guide"
[species index]: https://docs.example.org/species
