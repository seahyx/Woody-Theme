-- sql.sql: schema and reporting queries for the fictional Woody Lumber Yard inventory, used to preview the Woody theme's SQL highlighting.
-- Demonstrates: CREATE TABLE with PK/FK/CHECK/DEFAULT/UNIQUE, CREATE INDEX, CREATE VIEW, multi-row INSERT, UPDATE, DELETE, CTEs (incl. recursive), INNER/LEFT/CROSS joins, GROUP BY ... HAVING, window functions, CASE, COALESCE, transactions, string/date/interval literals and both comment styles. PostgreSQL dialect.

/*
 * Schema
 * ------
 * species -> trees (measured in survey plots) and species -> sawmill_batches -> planks.
 */

CREATE TABLE species (
    species_id   SERIAL PRIMARY KEY,
    common_name  VARCHAR(60)  NOT NULL UNIQUE,
    latin_name   VARCHAR(120) NOT NULL,
    is_hardwood  BOOLEAN      NOT NULL DEFAULT FALSE,
    density_kgm3 NUMERIC(6, 1) CHECK (density_kgm3 BETWEEN 300 AND 1200)
);

CREATE TABLE survey_plots (
    plot_code   CHAR(4) PRIMARY KEY,
    parent_code CHAR(4) REFERENCES survey_plots (plot_code),
    area_ha     NUMERIC(5, 3) NOT NULL DEFAULT 0.050,
    surveyed_on DATE          NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE trees (
    tree_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plot_code  CHAR(4)  NOT NULL REFERENCES survey_plots (plot_code) ON DELETE CASCADE,
    species_id INTEGER  NOT NULL REFERENCES species (species_id),
    tag        TEXT     NOT NULL,
    dbh_cm     NUMERIC(5, 1) NOT NULL CHECK (dbh_cm > 0),
    height_m   NUMERIC(4, 1),
    CONSTRAINT uq_tree_tag UNIQUE (plot_code, tag)
);

CREATE TABLE sawmill_batches (
    batch_id    VARCHAR(12) PRIMARY KEY CHECK (batch_id ~ '^SM-[0-9]{4}-[A-Z]{2}$'),
    species_id  INTEGER     NOT NULL REFERENCES species (species_id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moisture    REAL        CHECK (moisture >= 0.0 AND moisture <= 100.0)
);

CREATE TABLE planks (
    plank_id  BIGSERIAL PRIMARY KEY,
    batch_id  VARCHAR(12)  NOT NULL REFERENCES sawmill_batches (batch_id),
    length_m  NUMERIC(4, 2) NOT NULL,
    knots     SMALLINT     NOT NULL DEFAULT 0,
    grade     CHAR(1)      CHECK (grade IN ('A', 'B', 'C', 'R'))
);

CREATE INDEX idx_trees_species ON trees (species_id, dbh_cm DESC);
CREATE UNIQUE INDEX idx_species_latin ON species (lower(latin_name));
CREATE INDEX idx_planks_ungraded ON planks (batch_id) WHERE grade IS NULL;

COMMENT ON TABLE trees IS 'Every tagged stem; the tag is stamped on an aluminium disc, e.g. ''N1-0142''.';
COMMENT ON COLUMN trees.dbh_cm IS E'Diameter at breast height (1.3 m)\nmeasured on the uphill side.';

-- Seed data ------------------------------------------------------------------

INSERT INTO species (common_name, latin_name, is_hardwood, density_kgm3)
VALUES
    ('English oak',  'Quercus robur',         TRUE,  720.0),
    ('Scots pine',   'Pinus sylvestris',      FALSE, 510.0),
    ('Silver birch', 'Betula pendula',        TRUE,  640.0),
    ('Douglas fir',  'Pseudotsuga menziesii', FALSE, 530.0);

INSERT INTO survey_plots (plot_code, parent_code, area_ha, surveyed_on)
VALUES
    ('N000', NULL,   12.500, DATE '2026-11-02'),
    ('N100', 'N000', 0.050,  DATE '2026-11-03'),
    ('N110', 'N100', 0.050,  '2026-11-04'),
    ('N120', 'N100', 0.050,  '2026-11-04');

INSERT INTO sawmill_batches (batch_id, species_id, received_at, moisture)
VALUES
    ('SM-2026-OK', 1, TIMESTAMPTZ '2026-11-20 07:45:00+00', 11.4),
    ('SM-2026-PN', 2, '2026-11-21 13:10:00+00', 1.49e1),
    ('SM-2026-DF', 4, now() - INTERVAL '3 days', NULL);

-- Maintenance ------------------------------------------------------------------

BEGIN TRANSACTION;

-- Grade planks: wet batches are rejected outright, otherwise knots decide.
UPDATE planks AS p
SET grade = CASE
        WHEN b.moisture > 20 THEN 'R'
        WHEN p.knots = 0 THEN 'A'
        WHEN p.knots BETWEEN 1 AND 3 THEN 'B'
        ELSE 'C'
    END
FROM sawmill_batches AS b
WHERE b.batch_id = p.batch_id
  AND p.grade IS NULL;

-- Offcuts shorter than half a metre go to the chipper, not the stock list.
DELETE FROM planks
WHERE length_m < 0.50
  AND batch_id LIKE 'SM-2026-%';

COMMIT;

BEGIN;
UPDATE sawmill_batches SET moisture = -1 WHERE batch_id = 'SM-2026-DF';
-- The CHECK constraint rejects a negative reading, so undo the attempt.
ROLLBACK;

-- Views and reports --------------------------------------------------------------

CREATE OR REPLACE VIEW v_stock_by_species AS
SELECT
    s.common_name,
    s.latin_name,
    COUNT(pl.plank_id)                            AS plank_count,
    ROUND(SUM(pl.length_m * 0.025), 3)            AS volume_m3,
    COALESCE(MAX(b.received_at)::date::text, 'never') AS last_delivery
FROM species AS s
LEFT JOIN sawmill_batches AS b ON b.species_id = s.species_id
LEFT JOIN planks AS pl ON pl.batch_id = b.batch_id AND pl.grade <> 'R'
GROUP BY s.common_name, s.latin_name;

-- Recursive CTE: walk the plot hierarchy from the ridge down to individual plots.
WITH RECURSIVE plot_tree (plot_code, parent_code, depth, path) AS (
    SELECT plot_code, parent_code, 0, plot_code::text
    FROM survey_plots
    WHERE parent_code IS NULL

    UNION ALL

    SELECT c.plot_code, c.parent_code, pt.depth + 1, pt.path || ' > ' || c.plot_code
    FROM survey_plots AS c
    INNER JOIN plot_tree AS pt ON c.parent_code = pt.plot_code
)
SELECT repeat('  ', depth) || plot_code AS plot, path
FROM plot_tree
ORDER BY path;

-- Basal area per hectare by plot and species; only dense stands are reported.
WITH basal AS (
    SELECT
        t.plot_code,
        t.species_id,
        CAST(pi() / 4 * power(t.dbh_cm / 100.0, 2) AS NUMERIC(10, 6)) AS basal_m2
    FROM trees AS t
)
SELECT
    sp.plot_code,
    s.common_name,
    COUNT(*)                                AS stems,
    ROUND(SUM(b.basal_m2) / sp.area_ha, 2) AS basal_m2_per_ha
FROM basal AS b
INNER JOIN survey_plots AS sp USING (plot_code)
INNER JOIN species AS s ON s.species_id = b.species_id
GROUP BY sp.plot_code, sp.area_ha, s.common_name
HAVING SUM(b.basal_m2) / sp.area_ha > 30
ORDER BY basal_m2_per_ha DESC;

-- Window functions: rank trees within each plot and compare with the previous tag.
SELECT
    t.plot_code,
    t.tag,
    t.dbh_cm,
    ROW_NUMBER() OVER (PARTITION BY t.plot_code ORDER BY t.dbh_cm DESC) AS size_rank,
    t.dbh_cm - LAG(t.dbh_cm, 1, t.dbh_cm) OVER w                         AS dbh_change,
    SUM(t.dbh_cm) OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_dbh,
    CASE
        WHEN t.height_m IS NULL THEN 'unmeasured'
        WHEN t.height_m >= 30 THEN 'canopy'
        ELSE 'understorey'
    END AS layer
FROM trees AS t
WINDOW w AS (PARTITION BY t.plot_code ORDER BY t.tag)
ORDER BY t.plot_code, size_rank
LIMIT 50 OFFSET 0;

-- Cross join: every species against every plot, to spot species missing from a plot.
SELECT sp.plot_code, s.common_name
FROM survey_plots AS sp
CROSS JOIN species AS s
WHERE NOT EXISTS (
    SELECT 1
    FROM trees AS t
    WHERE t.plot_code = sp.plot_code
      AND t.species_id = s.species_id
)
  AND sp.surveyed_on >= CURRENT_DATE - INTERVAL '30 days';
