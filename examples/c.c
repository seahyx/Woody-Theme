/*
 * c.c - Woody Lumber Yard sawmill batch report, written in C23.
 * Demonstrates: #include (system and local), object-like and function-like #define macros, #if/#ifdef/#elif/#endif, #pragma, typedef struct, enum, union, pointers and pointer arithmetic, arrays, static/const/extern globals, printf placeholders, escape sequences, switch with fallthrough, goto with a label, sizeof, bit operators and Doxygen comments.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

/* Local-style include, guarded so the example still builds standalone. */
#if __has_include("woody/inventory.h")
#  include "woody/inventory.h"
#endif

#pragma pack(push, 1)

/** Number of planks a single sawmill batch can hold. */
#define MAX_PLANKS 16
/** Moisture content (%) above which a plank must go back to the kiln. */
#define KILN_THRESHOLD 19.5f
/** Name printed at the top of every report. */
#define YARD_NAME "Woody Lumber Yard"
/** Converts a diameter in centimetres to a radius in metres. */
#define CM_TO_RADIUS_M(d) ((d) / 200.0)
/** Returns the smaller of two values; arguments are evaluated twice. */
#define MIN(a, b) ((a) < (b) ? (a) : (b))
/** Turns a macro argument into a string literal without expanding it. */
#define STRINGIFY(x) #x
/** Expands the argument first, then stringifies it (the classic two-level trick). */
#define XSTRINGIFY(x) STRINGIFY(x)
/** Glues a prefix onto a species identifier. */
#define SPECIES_ID(name) SPECIES_##name

#if defined(_WIN32)
#  define PLATFORM "windows"
#elif defined(__APPLE__)
#  define PLATFORM "macos"
#else
#  define PLATFORM "posix"
#endif

#ifdef WOODY_DEBUG
#  define LOG(fmt, ...) fprintf(stderr, "[debug] " fmt "\n", __VA_ARGS__)
#else
#  define LOG(fmt, ...) ((void)0)
#endif

/** Tree species stocked by the yard. */
typedef enum {
    SPECIES_OAK = 1,     /**< English oak, Quercus robur */
    SPECIES_PINE,        /**< Scots pine, Pinus sylvestris */
    SPECIES_BIRCH,       /**< Silver birch, Betula pendula */
    SPECIES_DOUGLAS_FIR  /**< Douglas fir, Pseudotsuga menziesii */
} Species;

/** Plank grade, stored as bit flags so a plank can carry several defects at once. */
enum GradeFlags {
    GRADE_CLEAR    = 0x00,
    GRADE_KNOT     = 1 << 0,
    GRADE_SPLIT    = 1 << 1,
    GRADE_WANE     = 1 << 2,
    GRADE_REJECTED = 0b1000
};

/** A raw sensor reading; the kiln sends either a temperature or a moisture value in the same slot. */
typedef union {
    float celsius;
    float moisture_pct;
    uint32_t raw_bits;
} SensorValue;

/** One plank cut from a log during a sawmill batch. */
typedef struct Plank {
    uint16_t id;
    Species species;
    double length_m;
    double width_mm;
    unsigned int flags;
    SensorValue moisture;
} Plank;

/** A batch of planks processed in one run of the saw. */
typedef struct {
    char code[12];
    size_t count;
    Plank planks[MAX_PLANKS];
} Batch;

#pragma pack(pop)

/* Defined in another translation unit in the real project. */
extern int woody_report_verbosity;
int woody_report_verbosity = 2;

static const char *const SPECIES_NAMES[] = {
    [SPECIES_OAK] = "Quercus robur",
    [SPECIES_PINE] = "Pinus sylvestris",
    [SPECIES_BIRCH] = "Betula pendula",
    [SPECIES_DOUGLAS_FIR] = "Pseudotsuga menziesii",
};

static unsigned long g_planks_seen = 0UL;
static const double PI = 3.14159265358979e0;
static const float KILN_MAX_C = 0x1.2p6f; /* 72.0 degrees C, written as a hex float */

/**
 * @brief Computes the cross-sectional area of a trunk at breast height.
 * @param diameter_cm Trunk diameter in centimetres.
 * @return Basal area in square metres.
 */
static double basal_area(double diameter_cm)
{
    const double r = CM_TO_RADIUS_M(diameter_cm);
    return PI * r * r;
}

/**
 * @brief Counts how many defect bits are set on a plank.
 * @param flags Bitwise OR of GradeFlags values.
 * @return Number of defects recorded.
 */
static int count_defects(unsigned int flags)
{
    int n = 0;
    while (flags) {
        n += flags & 1u;
        flags >>= 1;
    }
    return n;
}

/**
 * @brief Describes a plank's grade, falling through from the worst grade to the best.
 * @param plank Plank to describe; must not be NULL.
 * @return Number of warning lines written to stdout.
 */
static int describe_grade(const Plank *plank)
{
    int warnings = 0;
    switch (count_defects(plank->flags & ~GRADE_REJECTED)) {
    case 3:
        puts("\t! wane on edge");
        warnings++;
        /* fallthrough */
    case 2:
        puts("\t! split at end");
        warnings++;
        /* fallthrough */
    case 1:
        puts("\t! knot present");
        warnings++;
        break;
    case 0:
        puts("\tclear grade ✓");
        break;
    default:
        fprintf(stderr, "unexpected defect count\n");
    }
    return warnings;
}

/**
 * @brief Prints a full report for a batch and returns the number of rejected planks.
 * @param batch Batch to report on.
 * @return Count of planks that must be re-kilned or rejected, or -1 on error.
 */
int print_batch(const Batch *batch)
{
    int rejected = 0;
    if (batch == NULL || batch->count == 0) {
        goto empty;
    }

    printf("%s (%s) - batch %s, %zu planks\n", YARD_NAME, PLATFORM, batch->code, batch->count);
    printf("%-4s %-22s %8s %8s %6s\n", "id", "species", "len(m)", "wid(mm)", "flags");

    /* Walk the array with a pointer instead of an index. */
    for (const Plank *p = batch->planks; p < batch->planks + batch->count; ++p) {
        const bool too_wet = p->moisture.moisture_pct > KILN_THRESHOLD;
        printf("%04u %-22s %8.3f %8.1f 0x%02X\n", (unsigned)p->id, SPECIES_NAMES[p->species], p->length_m, p->width_mm, p->flags);
        printf("\tmoisture %5.2f%% %s, raw bits %#010x\n", p->moisture.moisture_pct, too_wet ? "(too wet)" : "", p->moisture.raw_bits);
        rejected += too_wet || (p->flags & GRADE_REJECTED) != 0;
        describe_grade(p);
        ++g_planks_seen;
    }

    LOG("finished batch %s", batch->code);
    return rejected;

empty:
    fputs("No planks in batch.\r\n", stderr);
    return -1;
}

/**
 * @brief Entry point: builds a sample batch on the heap and prints it.
 * @return EXIT_SUCCESS when the batch has no rejected planks, EXIT_FAILURE otherwise.
 */
int main(void)
{
    Batch *batch = malloc(sizeof *batch);
    if (!batch) {
        perror("malloc");
        return EXIT_FAILURE;
    }
    memset(batch, 0, sizeof(Batch));
    strncpy(batch->code, "SB-2024-07", sizeof batch->code - 1);

    const double lengths[] = { 2.4, 3.6, 4.8, 1.2e0 };
    const size_t n = MIN(sizeof lengths / sizeof lengths[0], (size_t)MAX_PLANKS);
    for (size_t i = 0; i < n; i++) {
        Plank *plank = &batch->planks[i];
        plank->id = (uint16_t)(100 + i);
        plank->species = (Species)(SPECIES_OAK + (int)(i % 4));
        plank->length_m = lengths[i];
        plank->width_mm = 145.0 + 0.5 * (double)i;
        plank->flags = (i & 1) ? (GRADE_KNOT | GRADE_SPLIT) : GRADE_CLEAR;
        plank->moisture.moisture_pct = 12.0f + 3.5f * (float)i;
    }
    batch->count = n;

    printf("basal area of a 42 cm oak: %.4f m^2 ('%c' via %s)\n", basal_area(42.0), 'A', XSTRINGIFY(SPECIES_ID(OAK)));
    const int rejected = print_batch(batch);
    printf("rejected=%d seen=%lu verbosity=%d sizeof(Plank)=%zu kiln max=%g\n", rejected, g_planks_seen, woody_report_verbosity, sizeof(Plank), (double)KILN_MAX_C);

    free(batch);
    batch = NULL;
    return rejected > 0 ? EXIT_FAILURE : EXIT_SUCCESS;
}
