-- Woody Theme syntax showcase: Lua 5.4.
-- Demonstrates: local and <const> variables, numeric literal forms (integer, float, exponent, hex, hex float), strings with escapes and long brackets, tables with array and hash parts, metatables with __index/__tostring/__lt/__call, class-style OOP with `:` methods and inheritance, closures and upvalues, varargs with select(), string patterns (anchors, classes, captures, quantifiers), string.format, numeric and generic `for`, `while`, `repeat ... until`, `goto continue` with a `::continue::` label, integer division and bitwise operators, pcall/error, multiple returns, and LuaLS `---@` annotations.

---@alias SpeciesCode "QR"|"PS"|"BP"|"PM"

local YARD_NAME <const> = "Woody Lumber Yard"
local MAX_MOISTURE <const> = 19.5
local KILN_LIMIT_C <const> = 8.25e1
local PLOT_AREA_M2 <const> = 400 -- each survey plot is 20 m x 20 m
local M2_PER_HECTARE <const> = 10000
local SENSOR_MASK <const> = 0xFF00
local CALIBRATION_STEP <const> = 0x1p-4 -- hex float: exactly 1/16 of a percent

---@class SpeciesInfo
---@field common string
---@field latin string

---Species codes from trunk tags, mapped to common and Latin names.
---@type table<SpeciesCode, SpeciesInfo>
local SPECIES = {
  QR = { common = "English oak", latin = "Quercus robur" },
  PS = { common = "Scots pine", latin = "Pinus sylvestris" },
  BP = { common = "Silver birch", latin = "Betula pendula" },
  ["PM"] = { common = "Douglas fir", latin = "Pseudotsuga menziesii" },
}

---Bit flags for plank defects; combine them with `|`.
local Defect <const> = { NONE = 0, KNOT = 1 << 0, SPLIT = 1 << 1, WANE = 1 << 2, STAIN = 1 << 3 }

-- Lua patterns, not regex: %d is a digit, %u an upper-case letter, %- and %. are literal, and () captures. Matches "PLOT-07/QR-0042@24.5m".
local TAG_PATTERN <const> = "^PLOT%-(%d%d)/(%u%u)%-(%d%d%d%d)@?([%d%.]*)m?$"

local REPORT_TEMPLATE <const> = [[
%s - survey report
Trees measured: %d
Density: %.1f stems/ha
]]

---A single measured tree in a survey plot.
---@class Tree
---@field id integer Four-digit number from the trunk tag.
---@field plot integer Survey plot number.
---@field species SpeciesCode
---@field dbh_cm number Diameter at breast height, in centimetres.
---@field height_m number? Total height in metres, if measured.
local Tree = {}
Tree.__index = Tree

---Create a new tree record.
---@param id integer
---@param plot integer
---@param species SpeciesCode
---@param dbh_cm number
---@param height_m? number
---@return Tree
function Tree.new(id, plot, species, dbh_cm, height_m)
  return setmetatable({ id = id, plot = plot, species = species, dbh_cm = dbh_cm, height_m = height_m }, Tree)
end

---Parse a trunk tag such as "PLOT-07/QR-0042@24.5m".
---@param tag string Raw tag text read in the field.
---@param dbh_cm number Diameter measured alongside the tag.
---@return Tree? tree The parsed tree, or nil on failure.
---@return string? err Why parsing failed.
function Tree.parse(tag, dbh_cm)
  local plot, code, id, height = tag:match(TAG_PATTERN)
  if not plot then
    return nil, ("unrecognised tag %q"):format(tag)
  elseif SPECIES[code] == nil then
    return nil, "unknown species code " .. code
  end
  return Tree.new(tonumber(id), tonumber(plot), code, dbh_cm, tonumber(height))
end

---Cross-sectional trunk area at breast height.
---@return number area Square metres.
function Tree:basal_area()
  return math.pi * (self.dbh_cm / 200) ^ 2
end

Tree.__lt = function(a, b) return a.dbh_cm < b.dbh_cm end

Tree.__tostring = function(t)
  local info = SPECIES[t.species] or { common = "Unknown", latin = "?" }
  return string.format("#%04d %s (%s)\t%.1f cm", t.id, info.common, info.latin, t.dbh_cm)
end

---A tree old or large enough to be protected from felling.
---@class VeteranTree : Tree
---@field reason string
local VeteranTree = setmetatable({}, { __index = Tree })
VeteranTree.__index = VeteranTree
-- Metamethods are looked up with rawget, so they are not inherited through __index and must be copied.
VeteranTree.__lt, VeteranTree.__tostring = Tree.__lt, Tree.__tostring

---Promote an existing tree to a veteran by swapping its metatable.
---@param tree Tree
---@param reason string
---@return VeteranTree
function VeteranTree.from(tree, reason)
  local self = setmetatable(tree, VeteranTree)
  self.reason = reason
  return self
end

---@return boolean
function VeteranTree:can_fell() return false end

---Moisture probe; calling the class table constructs an instance.
---@class Probe
---@field id string
---@field baseline number
---@overload fun(id: string, baseline?: number): Probe
local Probe = setmetatable({}, {
  __call = function(cls, id, baseline)
    if type(id) ~= "string" then error("probe id must be a string, got " .. type(id), 2) end
    return setmetatable({ id = id, baseline = baseline or 12.0 }, cls)
  end,
})
Probe.__index = Probe

---Simulated reading of moisture content, in percent.
---@return number
function Probe:read()
  local raw = 0
  for i = 1, #self.id do
    raw = raw + self.id:byte(i)
  end
  raw = (raw << 8) & SENSOR_MASK -- keep only the high byte, as the firmware does
  return self.baseline + ((raw >> 8) % 90) * CALIBRATION_STEP
end

---Create a closure that hands out sequential sawmill batch IDs.
---@param year integer Two-digit year.
---@return fun(): string next_id
local function batch_id_generator(year)
  local seq = 0 -- upvalue shared by every call of the returned function
  return function()
    seq = seq + 1
    return ("SM%02d-%05d"):format(year, seq)
  end
end

---Mean of any number of readings, ignoring nils.
---@param ... number?
---@return number? mean
---@return integer count
local function mean(...)
  local total, count = 0, 0
  for i = 1, select("#", ...) do
    local value = select(i, ...)
    if value ~= nil then
      total, count = total + value, count + 1
    end
  end
  return count > 0 and total / count or nil, count
end

---Count planks per grade, skipping offcuts shorter than 600 mm.
---@param planks { length_mm: integer, defects: integer }[]
---@return table<string, integer>
local function grade_counts(planks)
  local counts = setmetatable({}, { __index = function() return 0 end })
  for _, plank in ipairs(planks) do
    if plank.length_mm < 600 then goto continue end
    local grade
    if plank.defects == Defect.NONE and plank.length_mm >= 2400 then
      grade = "prime"
    elseif (plank.defects & (Defect.SPLIT | Defect.WANE)) == 0 then
      grade = "select"
    elseif (plank.defects & Defect.SPLIT) ~= 0 then
      grade = "firewood"
    else
      grade = "common"
    end
    counts[grade] = counts[grade] + 1
    ::continue::
  end
  return counts
end

---Simulate a kiln drying run, returning hourly chamber temperatures.
---@param start_c? number Chamber temperature when the burners are lit.
---@param step_c? number Rise per hour.
---@return number[]
local function kiln_schedule(start_c, step_c)
  local temps, t = {}, start_c or 20.0
  step_c = step_c or 12.5
  while t < KILN_LIMIT_C do
    temps[#temps + 1] = t
    t = t + step_c
  end
  return temps
end

---Read a probe, retrying until it answers or the attempts run out.
---@param read fun(): number May raise an error on a timeout.
---@param max_attempts? integer
---@return number? reading
---@return string? err
local function read_with_retry(read, max_attempts)
  local attempts, ok, result = 0, false, nil
  repeat
    attempts = attempts + 1
    ok, result = pcall(read)
  until ok or attempts >= (max_attempts or 3)
  if not ok then return nil, "probe unreachable: " .. tostring(result) end
  return result
end

local function main()
  local trees = {}
  local field_sheet = { { "PLOT-07/QR-0042@24.5m", 86.0 }, { "PLOT-07/PS-0101", 31.2 }, { "plot-9/??", 12 }, { "PLOT-12/PM-0007@41.25m", 64.8 } }
  for i, row in ipairs(field_sheet) do
    local tree, err = Tree.parse(table.unpack(row))
    if tree then
      trees[#trees + 1] = tree.dbh_cm >= 80 and VeteranTree.from(tree, "diameter over 80 cm") or tree
    else
      io.stderr:write(("row %d skipped: %s\n"):format(i, err))
    end
  end
  table.sort(trees, function(a, b) return b < a end) -- largest first, via the __lt metamethod

  print(REPORT_TEMPLATE:format(YARD_NAME, #trees, #trees / PLOT_AREA_M2 * M2_PER_HECTARE))
  for rank, tree in ipairs(trees) do
    print(rank, tostring(tree), tree.can_fell and "protected" or "", ("%.3f m\u{B2}"):format(tree:basal_area()))
  end

  local probes = { Probe("stack-A"), Probe("stack-B", 14.5) }
  local readings = {}
  for _, probe in ipairs(probes) do
    readings[#readings + 1] = read_with_retry(function() return probe:read() end)
  end
  local avg, n = mean(table.unpack(readings))
  print(("Mean moisture over %d probes: %.2f%% (%s)"):format(n, avg or 0, (avg or math.huge) <= MAX_MOISTURE and "dry" or "wet"))

  for grade, count in pairs(grade_counts({ { length_mm = 2600, defects = Defect.NONE }, { length_mm = 1900, defects = Defect.KNOT | Defect.STAIN }, { length_mm = 450, defects = 0 } })) do
    print("grade", grade, count)
  end
  local next_batch = batch_id_generator(26)
  print(next_batch(), next_batch(), table.concat(kiln_schedule(), " -> "), 7 // 2, ~0 >> 60)
  for year, seq in ("Shipped SM26-00317 and SM26-00318 to the joinery"):gmatch("SM(%d%d)%-(%d+)") do
    print("shipped", seq, "in 20" .. year)
  end
end

main()

return { Tree = Tree, VeteranTree = VeteranTree, Probe = Probe, grade_counts = grade_counts }
