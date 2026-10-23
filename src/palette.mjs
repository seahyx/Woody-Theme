// Woody colour palette.
//
// Two layers: raw colours named for what they are, then role tokens named for
// what they do. src/colors.mjs and src/tokens.mjs only reference these, so a
// change here flows through the whole theme on the next `npm run build`.

const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
const toRgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

/** Applies an opacity (0–1) to a #rrggbb colour, returning #rrggbbaa. */
export function alpha(color, opacity) {
	return color.slice(0, 7) + toHex(opacity * 255);
}

/** Blends `from` towards `to` by `amount` (0–1). Both must be #rrggbb. */
export function mix(from, to, amount) {
	const a = toRgb(from);
	const b = toRgb(to);
	return '#' + a.map((v, i) => toHex(v + (b[i] - v) * amount)).join('');
}

// ---------------------------------------------------------------------------
// Raw colours
// ---------------------------------------------------------------------------

/** Backgrounds, darkest to lightest. */
export const wood = {
	bark: '#1b0000', // activity bar, status bar, borders
	base: '#1f1614', // editor, panel, inputs, active tab
	surface: '#301e1b', // side bar, inactive tabs, widgets, menus, title bar
	ember: '#310000', // status bar while debugging
	faded: '#6a4f4b', // inactive title bar, secondary buttons
};

export const neutral = {
	white: '#ffffff',
	black: '#000000',
	sand: '#bcb28d', // cursor, descriptions, variables
	silver: '#d8d8d8', // identifiers and operators
	greyLight: '#a1a1a1',
	grey: '#919191', // comments
	greyDim: '#808080', // tag brackets, preprocessor, quiet punctuation
	lineNumber: '#666666',
	moss: '#707c74', // git-ignored files
	guide: '#2f3033', // indent guides
};

/** UI accents: amber for focus and emphasis, teal for selection. */
export const accent = {
	amber: '#ffa000',
	teal: '#007966',
	tealLight: '#48a999',
	slate: '#2c5a65', // find and word highlights
	rose: '#dd89b1',
	orange: '#e6844f',
	red: '#f44747',
};

/** Syntax highlighting hues (rose and orange from `accent` are also used). */
export const syntax = {
	blue: '#58b2dc', // keywords, storage, types
	aqua: '#4ec9b0', // storage types, namespaces
	mint: '#58dcca', // arithmetic operators
	gold: '#dc9e58', // functions
	yellow: '#dda52d', // numbers
	green: '#7fbd5b', // strings
	lime: '#7ee37e', // C format placeholders
	magenta: '#dc589a', // language constants
};

/** Terminal ANSI colours. Bright variants are derived by lightening. */
const ansiBase = {
	black: '#000000',
	red: '#eb008a',
	green: '#37b349',
	yellow: '#f8ca12',
	blue: '#0e5a94',
	magenta: '#b31e8d',
	cyan: '#00aabb',
	white: '#d0d0d0',
};
const brighten = (color) => mix(color, neutral.white, 0.3);

export const ansi = {
	...ansiBase,
	brightBlack: '#505050',
	brightRed: brighten(ansiBase.red),
	brightGreen: brighten(ansiBase.green),
	brightYellow: brighten(ansiBase.yellow),
	brightBlue: brighten(ansiBase.blue),
	brightMagenta: brighten(ansiBase.magenta),
	brightCyan: brighten(ansiBase.cyan),
	brightWhite: '#ffffff',
};

// ---------------------------------------------------------------------------
// Role tokens
// ---------------------------------------------------------------------------

export const role = {
	transparent: '#00000000',

	fg: alpha(neutral.white, 0.867), // primary text
	fgSoft: alpha(neutral.white, 0.8), // breadcrumbs
	fgMuted: alpha(neutral.white, 0.533), // inactive tabs
	fgFaint: alpha(neutral.white, 0.4), // inactive icons and titles
	border: alpha(neutral.white, 0.4), // input and dropdown outlines

	selection: alpha(accent.teal, 0.38),
	selectionInactive: alpha(accent.tealLight, 0.38),
	selectionUnfocused: alpha(accent.teal, 0.19),
	hover: alpha(accent.teal, 0.1),
	highlight: alpha(accent.slate, 0.4), // other occurrences of a match or word

	error: accent.rose,
	warning: accent.orange,
	info: syntax.blue,

	added: syntax.green,
	modified: syntax.gold,
	deleted: accent.rose,
	conflict: accent.orange,
};
