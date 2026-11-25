// go.go - Woody Lumber Yard kiln monitor, written in Go 1.22.
// Demonstrates: package main, grouped imports, const blocks with iota, structs with struct tags, an embedded struct, interfaces, value and pointer receivers, a method expression, generics with a type-set constraint, goroutines, channels, select, sync.WaitGroup and sync.Mutex, context timeouts, defer/panic/recover, error wrapping with %w and errors.Is, regexp with named groups, labelled break, fmt verbs and Go doc comments.

// Command kilnmonitor samples the drying kiln and grades the trees from one survey plot.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Species identifies a tree species stocked by the yard.
type Species int

// Known species, numbered from zero by iota.
const (
	EnglishOak Species = iota
	ScotsPine
	SilverBirch
	DouglasFir
)

// Defect is a bit set of faults found on a plank.
type Defect uint8

// Defect flags; each one shifts iota to claim its own bit.
const (
	Knot Defect = 1 << iota
	Split
	Wane
)

// Yard-wide limits and constants.
const (
	KilnThreshold = 19.5    // percent moisture content
	maxBatch      = 1_000   // planks per batch
	sensorMask    = 0xFF_00 // high byte carries the sensor id
	defectBits    = 0b0111  // every Defect flag set
	oakDensity    = 7.5e2   // kg per cubic metre
)

var speciesNames = [...]string{"Quercus robur", "Pinus sylvestris", "Betula pendula", "Pseudotsuga menziesii"}

// ErrTooWet reports a plank whose moisture is above KilnThreshold.
var ErrTooWet = errors.New("plank too wet")

// batchCode matches codes such as SB-2024-07-night; the shift suffix is optional.
var batchCode = regexp.MustCompile(`^SB-(?P<year>\d{4})-(\d{2,3})(?:-(day|night))?$`)

// String implements fmt.Stringer so species print by their Latin name.
func (s Species) String() string {
	if s < 0 || int(s) >= len(speciesNames) {
		return "Species(" + strconv.Itoa(int(s)) + ")"
	}
	return speciesNames[s]
}

// Measurement is a trunk measurement taken at breast height.
type Measurement struct {
	DiameterCm float64 `json:"diameter_cm"`
	HeightM    float64 `json:"height_m,omitempty"`
}

// Tree is a standing tree; the embedded Measurement promotes DiameterCm and HeightM.
type Tree struct {
	Measurement

	Tag     int     `json:"tag"`
	Species Species `json:"species"`
	Plot    string  `json:"plot" validate:"required"`
}

// Plank is one board cut during a sawmill batch.
type Plank struct {
	ID       int     `json:"id"`
	Species  Species `json:"species"`
	Moisture float64 `json:"moisture_pct"`
	Defects  Defect  `json:"defects,omitempty"`
}

// Reading is a single moisture sample from a kiln sensor.
type Reading struct {
	Sensor   string
	Moisture float64
	At       time.Time
}

// Grader is implemented by anything that can be given a commercial grade.
type Grader interface {
	Grade() string
}

// Number is the type set accepted by the generic helpers below.
type Number interface {
	~int | ~int64 | ~float32 | ~float64
}

// Sum adds up a slice of any Number type.
func Sum[T Number](values []T) T {
	var total T
	for _, v := range values {
		total += v
	}
	return total
}

// Map returns a new slice holding f applied to every element of in.
func Map[T, U any](in []T, f func(T) U) []U {
	out := make([]U, 0, len(in))
	for _, v := range in {
		out = append(out, f(v))
	}
	return out
}

// Volume estimates stem volume in cubic metres; a value receiver is enough because it only reads.
func (t Tree) Volume() float64 {
	r := t.DiameterCm / 200
	return math.Pi * r * r * t.HeightM * 0.45
}

// Grade implements Grader using the tree's volume.
func (t Tree) Grade() string {
	switch v := t.Volume(); {
	case v > 2:
		return "veneer"
	case v > 0.5:
		return "sawlog"
	default:
		return "firewood"
	}
}

// Batch is one run of the saw; it is shared between goroutines, so it is guarded by a mutex.
type Batch struct {
	Code   string
	Planks []Plank
	mu     sync.Mutex
	wet    int
}

// Record adds a plank to the batch, or returns a wrapped ErrTooWet; the pointer receiver lets it mutate b.
func (b *Batch) Record(p Plank) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if p.Moisture > KilnThreshold {
		b.wet++
		return fmt.Errorf("batch %s, plank %d: %w", b.Code, p.ID, ErrTooWet)
	}
	b.Planks = append(b.Planks, p)
	return nil
}

// sampleKiln starts one goroutine per sensor and fans their readings into a single channel, which is closed when every sensor is done.
func sampleKiln(ctx context.Context, sensors []string, samples int) <-chan Reading {
	out := make(chan Reading)
	var wg sync.WaitGroup
	for i, id := range sensors {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			for n := 0; n < samples; n++ {
				r := Reading{Sensor: id, Moisture: 23.5 - float64(n)*1.75 - float64(i), At: time.Now()}
				select {
				case out <- r:
				case <-ctx.Done():
					return
				}
			}
		}(i, id)
	}
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

// batchYear extracts the year from a batch code. A malformed code panics, and the deferred recover turns that panic into an error through the named result.
func batchYear(code string) (year int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	m := batchCode.FindStringSubmatch(code)
	if m == nil {
		panic(fmt.Sprintf("bad batch code %q", code))
	}
	return strconv.Atoi(m[batchCode.SubexpIndex("year")])
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	trees := []Tree{
		{Measurement: Measurement{DiameterCm: 92.5, HeightM: 24}, Tag: 1001, Species: EnglishOak, Plot: "PLOT-042"},
		{Measurement{41.0, 31.5}, 1002, ScotsPine, "PLOT-042"},
		{Measurement{18.25, 14}, 1003, SilverBirch, "PLOT-043"},
	}
	sort.Slice(trees, func(i, j int) bool { return trees[i].Volume() > trees[j].Volume() })

	// Tree.Volume is a method expression of type func(Tree) float64.
	volumes := Map(trees, Tree.Volume)
	fmt.Printf("total volume %.3f m³, tag checksum %#x\n", Sum(volumes), Sum(Map(trees, func(t Tree) int { return t.Tag })))
	for _, g := range Map(trees, func(t Tree) Grader { return t }) {
		fmt.Printf("\t%-8T %-10s %+v\n", g, g.Grade(), g)
	}

	encoded, err := json.Marshal(trees[0])
	if err != nil {
		fmt.Fprintln(os.Stderr, "encode:", err)
		os.Exit(1)
	}
	fmt.Println(string(encoded))

	batch := &Batch{Code: "SB-2024-07-night"}
	var problems strings.Builder
	readings := sampleKiln(ctx, []string{"K-01", "K-02"}, 4)
	id := 0

loop:
	for {
		select {
		case r, ok := <-readings:
			if !ok {
				break loop
			}
			id++
			if err := batch.Record(Plank{ID: id, Species: DouglasFir, Moisture: r.Moisture, Defects: Defect(id) & defectBits &^ Wane}); errors.Is(err, ErrTooWet) {
				fmt.Fprintf(&problems, "%s @ %s: %v\n", r.Sensor, r.At.Format(time.TimeOnly), err)
			}
		case <-ctx.Done():
			fmt.Fprintln(os.Stderr, "kiln timed out:", ctx.Err())
			break loop
		}
	}

	year, _ := batchYear(batch.Code)
	_, badErr := batchYear("SB-7")
	fmt.Printf("year %d, kept %d planks, %d too wet\n%s%v\n", year, len(batch.Planks), batch.wet, problems.String(), badErr)
}
