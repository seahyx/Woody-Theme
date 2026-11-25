# frozen_string_literal: true

# Woody Theme syntax showcase: Ruby 3.2.
# Demonstrates: magic comment, require, modules and nested classes, mixins (include), constants and numeric literal forms (separators, hex, binary, exponent, rational), symbols and %i[] literals, hashes with `key:` and `=>` syntax, Data.define, attr_reader/attr_accessor, @ivars and @@class_vars, `class << self`, endless methods, blocks with do...end and {}, yield/block_given?, lambdas, string interpolation and escapes, a squiggly heredoc, regex with named groups, anchors, classes, quantifiers and alternation, case/when and case/in pattern matching, if/unless/until modifiers, begin/rescue/else/ensure/retry, raise, safe navigation (&.), ranges, private, and YARD documentation.

require "json"
require "time"

# Survey, sensor and sawmill helpers for the fictional Woody Lumber Yard.
module Woody
  YARD_NAME = "Woody Lumber Yard"
  MAX_MOISTURE = 19.5
  KILN_LIMIT_C = 8.25e1
  PLOT_AREA_M2 = 400
  M2_PER_HECTARE = 10_000
  SENSOR_MASK = 0xFF_00
  BOARD_FEET_PER_INCH_FOOT = 1 / 12r # rational: exact board-feet per (inch x inch x foot)
  DEFECT_FLAGS = { knot: 0b0001, split: 0b0010, wane: 0b0100, stain: 0b1000 }.freeze

  # Raised when a trunk tag cannot be parsed.
  class TagError < StandardError; end

  # Mixin for anything with a trunk diameter; the host must respond to +dbh_cm+.
  module Measurable
    # @return [Float] cross-sectional trunk area at breast height, in m²
    def basal_area = Math::PI * (dbh_cm / 200.0)**2

    # @param other [Measurable]
    # @return [Integer] -1, 0 or 1, ordering by diameter
    def <=>(other) = dbh_cm <=> other.dbh_cm
  end

  # A single measured tree in a survey plot.
  class Tree
    include Measurable
    include Comparable

    # Species codes from trunk tags, mapped to common and Latin names.
    SPECIES = {
      QR: { common: "English oak", latin: "Quercus robur" },
      PS: { common: "Scots pine", latin: "Pinus sylvestris" },
      BP: { common: "Silver birch", latin: "Betula pendula" },
      PM: { common: "Douglas fir", latin: "Pseudotsuga menziesii" }
    }.freeze

    # Matches tags such as "PLOT-07/QR-0042@24.5m": plot, species code, tree number and an optional height in metres.
    TAG_PATTERN = %r{\APLOT-(?<plot>\d{2})/(?<species>QR|PS|BP|PM)-(?<tree>\d{4})(?:@(?<height>\d+(?:\.\d+)?)m)?\z}

    @@registered = 0

    attr_reader :id, :species, :dbh_cm, :height_m
    attr_accessor :notes

    class << self
      # @return [Integer] how many trees have been created in this process
      def registered = @@registered

      # Build a tree from a trunk tag.
      # @param tag [String] raw tag text, e.g. "PLOT-07/QR-0042@24.5m"
      # @param dbh_cm [Numeric] diameter at breast height measured alongside the tag
      # @return [Tree]
      # @raise [TagError] if the tag is malformed
      def parse(tag, dbh_cm:)
        match = TAG_PATTERN.match(tag.strip) or raise TagError, "unrecognised tag #{tag.inspect}"
        new(id: match[:tree].to_i, species: match[:species].to_sym, dbh_cm: dbh_cm.to_f, height_m: match[:height]&.to_f)
      end
    end

    # @param id [Integer] four-digit number from the trunk tag
    # @param species [Symbol] one of the keys of {SPECIES}
    # @param dbh_cm [Float] diameter at breast height, in centimetres
    # @param height_m [Float, nil] total height in metres, if measured
    # @raise [ArgumentError] if +species+ is unknown
    def initialize(id:, species:, dbh_cm:, height_m: nil)
      raise ArgumentError, "unknown species #{species.inspect}" unless SPECIES.key?(species)

      @id = id
      @species = species
      @dbh_cm = dbh_cm
      @height_m = height_m
      @notes = []
      @@registered += 1
    end

    # @return [String] e.g. "#0042 English oak (Quercus robur)\t86.0 cm"
    def to_s
      info = SPECIES.fetch(species) { { common: "Unknown", latin: "?" } }
      "##{id.to_s.rjust(4, '0')} #{info[:common]} (#{info[:latin]})\t#{format('%.1f', dbh_cm)} cm"
    end
  end

  # An immutable plank record produced by the sawmill.
  Plank = Data.define(:length_mm, :defects) do
    # @return [Integer] bitwise OR of {DEFECT_FLAGS} for this plank's defects
    def defect_bits = defects.sum(0) { |defect| DEFECT_FLAGS.fetch(defect, 0) }
  end

  # A batch of planks cut from one log run.
  class SawmillBatch
    attr_reader :batch_id

    # @param batch_id [String] e.g. "SM26-00317"; stored upper-case
    def initialize(batch_id)
      @batch_id = batch_id.upcase
      @planks = []
    end

    # @param plank [Plank]
    # @return [self] so appends can be chained
    def <<(plank)
      @planks << plank
      self
    end

    # @param plank [Plank]
    # @return [Symbol] +:prime+, +:select+, +:common+ or +:firewood+
    def self.grade(plank)
      case plank.defects.size
      when 0 then plank.length_mm >= 2_400 ? :prime : :select
      when 1, 2
        (plank.defect_bits & DEFECT_FLAGS[:split]).zero? ? :common : :firewood
      else :firewood
      end
    end

    # @return [Hash{Symbol => Integer}] number of planks per grade, ignoring zero-length offcuts
    def grade_counts
      @planks.each_with_object(Hash.new(0)) do |plank, counts|
        next if plank.length_mm.zero?

        counts[self.class.grade(plank)] += 1
      end
    end
  end

  # Register of surveyed trees with simple reporting.
  class Inventory
    attr_reader :trees, :loaded_at

    # @param name [String] display name used in reports
    def initialize(name = YARD_NAME)
      @name = name
      @trees = []
    end

    # Load trees from a JSON export, retrying once in case the file was caught mid-write.
    # @param path [String]
    # @return [Integer] number of rows read
    def load(path)
      attempts = 0
      begin
        attempts += 1
        rows = JSON.parse(File.read(path), symbolize_names: true)
      rescue Errno::ENOENT => e
        warn "missing export: #{e.message}"
        rows = []
      rescue JSON::ParserError
        retry if attempts < 2
        raise
      else
        rows.each { |row| @trees << Tree.new(**row.slice(:id, :dbh_cm, :height_m), species: row[:species].to_sym) }
      ensure
        @loaded_at = Time.now
      end
      rows.size
    end

    # Select trees whose diameter falls within +range+, yielding each one if a block is given.
    # @param range [Range<Numeric>]
    # @yieldparam tree [Tree]
    # @return [Array<Tree>]
    def in_size_class(range = 30..)
      selected = trees.select { |tree| range.cover?(tree.dbh_cm) }
      selected.each { |tree| yield tree } if block_given?
      selected
    end

    # @return [String] a multi-line plain-text report
    def report
      <<~REPORT
        #{@name} \u2014 survey report (#{Time.now.strftime('%Y-%m-%d')})
        Trees measured:\t#{trees.size}
        Largest:\t#{trees.max || 'n/a'}
        Density:\t#{stems_per_hectare.round(1)} stems/ha
      REPORT
    end

    private

    def stems_per_hectare = trees.size.fdiv(PLOT_AREA_M2) * M2_PER_HECTARE
  end

  # Hourly kiln chamber temperatures for one drying run.
  # @param start_c [Float] chamber temperature when the burners are lit
  # @param step [Proc] computes the next temperature from the current one
  # @return [Array<Float>]
  def self.kiln_schedule(start_c = 20.0, step: ->(t) { t + 12.5 })
    temps = [start_c]
    temps << step.(temps.last) until temps.last >= KILN_LIMIT_C
    temps
  end

  # Classify a raw sensor payload with pattern matching.
  # @param payload [Hash]
  # @return [String]
  def self.classify(payload)
    case payload
    in { kind: "moisture", value: Float | Integer => pct } if pct <= MAX_MOISTURE
      "dry (#{pct}%)"
    in { kind: "moisture", value: }
      "wet (#{value}%)"
    in { kind: "temperature", value: ..0 }
      "frost warning"
    in { kind: String => kind } if kind.empty?
      "unlabelled reading"
    else
      "unrecognised payload"
    end
  end
end

if __FILE__ == $PROGRAM_NAME
  inventory = Woody::Inventory.new
  { "PLOT-07/QR-0042@24.5m" => 86, "PLOT-07/PS-0101" => 31.2, "plot-9/??" => 12 }.each do |tag, dbh|
    inventory.trees << Woody::Tree.parse(tag, dbh_cm: dbh)
  rescue Woody::TagError => e
    $stderr.puts "skipping: #{e.message}"
  end

  inventory.in_size_class(30..100) { |tree| puts "  big: #{tree}" }
  batch = Woody::SawmillBatch.new("sm26-00317")
  batch << Woody::Plank.new(length_mm: 2_600, defects: []) << Woody::Plank.new(length_mm: 1_900, defects: %i[knot stain])
  puts inventory.report, JSON.generate("batch" => batch.batch_id, "grades" => batch.grade_counts)
  puts Woody.kiln_schedule.map { |t| format("%5.1f\u00b0C", t) }.join(" -> ")
  puts Woody.classify({ kind: "moisture", value: 17.25 }), Woody.classify({ kind: "temperature", value: -3 })
  shipped = "Shipped SM26-00317 and sm26-00318".scan(/\bSM(\d{2})-(\d{1,5})\b/i).map { |year, seq| "#{seq}/20#{year}" }
  puts "Shipped: #{shipped.join(', ')}" unless shipped.empty?
  puts "Trees registered: #{Woody::Tree.registered}, board-feet in a 2x6x8: #{(2 * 6 * 8 * Woody::BOARD_FEET_PER_INCH_FOOT).to_f}"
end
