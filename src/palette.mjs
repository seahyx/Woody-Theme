// Woody colour palette.
//
// Three layers: raw colours named for what they are, then role tokens named for what they do — `role` for the workbench, `token` for syntax highlighting.
// src/colors.mjs and src/tokens.mjs only reference these, so a change here flows through the whole theme on the next `npm run build`.

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

const linear = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (color) => {
	const [r, g, b] = toRgb(color).map(linear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio of `fg` on `bg` (#rrggbb). A #rrggbbaa `fg` is blended over `bg` first. */
export function contrast(fg, bg) {
	const opacity = fg.length === 9 ? parseInt(fg.slice(7), 16) / 255 : 1;
	const a = luminance(mix(bg, fg.slice(0, 7), opacity));
	const b = luminance(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
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
	sand: '#bcb28d', // cursor, descriptions, hovered list items
	silver: '#d8d8d8',
	greyLight: '#a1a1a1',
	grey: '#919191', // comments
	greyDim: '#808080',
	lineNumber: '#666666',
	moss: '#707c74', // git-ignored files
	guide: '#2f3033', // indent guides
};

/** UI accents: amber for focus and emphasis, teal for selection, and the status colours. */
export const accent = {
	amber: '#ffa000',
	teal: '#007966',
	tealLight: '#48a999',
	slate: '#2c5a65', // find and word highlights
	rose: '#dd89b1', // errors, deleted files
	orange: '#e6844f', // warnings, conflicts
	red: '#f44747',
	blue: '#58b2dc', // info, incoming merges, submodules
	gold: '#dc9e58', // modified files
	green: '#7fbd5b', // added files
};

/**
 * Syntax highlighting hues. Each keeps Woody's hue but has its lightness set to the tier Visual Studio 2022 Dark gives the matching role (see `token` below).
 * VS's neutrals (text, operators, comments) are pure grey because its background is grey. Woody's are tinted towards the wood at the same lightness, so plain code reads warm.
 * Locals are the exception: they are the untinted white of the workbench text, so the names you work with most match the rest of the VS Code UI.
 * Lightness and chroma are what separate the roles that share a warm hue: amber functions, yellow numbers and orange keys.
 */
export const syntax = {
	cream: '#e9e0d4', // plain text
	white: '#e1e0e0', // locals: role.fg (white at 87%) composited on wood.base, the same white as the workbench text
	dimCream: '#cec2b5',
	ash: '#beaea1',
	greyWarm: '#9c9085',
	greyDeep: '#8d827a',
	mauve: '#b593a2',
	blue: '#46a1ca',
	rose: '#e798be',
	magenta: '#f471aa',
	gold: '#ffb272',
	aqua: '#4ec9b0',
	mint: '#58dcca',
	seafoam: '#a9e3cf',
	green: '#7fbd5b',
	lime: '#91ea90',
	yellow: '#dcb149',
	orange: '#f19768',
	red: '#f44747',
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
// Workbench roles
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
	info: accent.blue,

	added: accent.green,
	modified: accent.gold,
	deleted: accent.rose,
	conflict: accent.orange,
};

// ---------------------------------------------------------------------------
// Syntax roles
// ---------------------------------------------------------------------------
//
// Modelled on Visual Studio 2022 Dark: Roslyn's VisualStudio2019.xml colour scheme (the "Enhanced" classifications VS 2022 ships) and cpptools' "Visual Studio 2019 Dark" theme.
// VS sets brightness by how much a token needs to be read. Names you chose and plain text are brightest (11–12:1). Keywords are the dimmest code colour (5.7:1): they are frequent and predictable, so you recognise their shape instead of reading them. Comments and markup recede furthest (4–5.5:1).
// Hue says what kind of thing a token is (blue language words, teal types, yellow verbs, warm literals), and colour also says where a name lives: locals and parameters are a neutral white, members stay warm cream, namespaces go dim.
// Each entry gives the VS colour and its contrast on VS's #1e1e1e. `npm run contrast` prints Woody's own ratios on #1f1614 and the closest pairs.

export const token = {
	/** Plain text and members: fields, properties, events, constants. VS #dcdcdc (12.2:1). Most identifiers in an expression are member accesses, so leaving them uncoloured cuts the noise and makes every coloured token mean something. Woody's plain text is a warm cream rather than grey. */
	text: syntax.cream,
	/** Locals and parameters. VS #9cdcfe (11.2:1). Names scoped to the code in front of you, as bright as text so data flow reads easily. VS tints them blue; Woody keeps them the neutral white of the workbench text, so variables match the rest of the UI and stay a cooler step from the warm cream members. */
	local: syntax.white,
	/** Functions, methods, overloaded operators. VS #dcdcaa (11.8:1). The verbs, kept bright so call sites are easy to scan for. */
	function: syntax.gold,
	/** Escapes and format placeholders inside strings. VS #ffd68f (12.1:1). Brighter than the surrounding string, because these characters change what the string means. */
	escape: syntax.lime,
	/** Interfaces, enums, type parameters. VS #b8d7a3 (10.6:1). Abstract types: a lighter, paler step of the type colour. VS uses pale green, which Woody's green strings already own, so Woody uses pale aqua. */
	abstractType: syntax.seafoam,
	/** Namespaces, packages, modules, labels, globals. VS #c8c8c8 (10.0:1). Qualifiers you read past: a step dimmer than text. */
	namespace: syntax.dimCream,
	/** Numbers, units, enum members, symbols. VS #b5cea8 (9.8:1). Literal values, softened so a numeric table does not shout. Enum members count as named numbers, as VS does for C++ enumerators. */
	number: syntax.yellow,
	/** Classes, records, delegates, annotations, library types. VS #4ec9b0 (8.2:1). The nouns of the type system. */
	type: syntax.aqua,
	/** Structs and other value types. VS #86c691 (8.3:1). VS shifts the type hue towards green; Woody's green is taken by strings, so structs step up in lightness instead. */
	struct: syntax.mint,
	/** Control flow: if, for, return, throw, await, import. VS #d8a0df (8.0:1). Split from the other keywords and brighter than them, so branches and exits stand out when scanning. */
	control: syntax.rose,
	/** Operators. VS #b4b4b4 (8.0:1). Neutral and just under text, so the operands lead. */
	operator: syntax.ash,
	/** Strings. VS #d69d85 (7.2:1). Mid-tier: text that is data, set apart by hue rather than brightness. */
	string: syntax.green,
	/** Keys and attribute names: JSON, YAML, INI, CSS properties, HTML attributes, object keys. VS gives these the local colour, #9cdcfe (11.2:1). Woody keeps its orange, one tier lower so it stays distinct from functions. */
	key: syntax.orange,
	/** Macros, and regex anchors and quantifiers. VS #beb7ff (9.1:1) and #f979ae. Macros look like calls but are text substitution, so they get their own colour. One tier lower than VS to stay clear of control flow. */
	macro: syntax.magenta,
	/** Preprocessor directives. VS #9b9b9b (6.0:1). Compile-time and out of band, so neutral and recessive. Neutral grey is Woody's comment colour, so directives are tinted towards the macro colour instead. */
	preprocessor: syntax.mauve,
	/** Keywords, storage, primitive types, true/false/null, this/self, markup tags. VS #569cd6 (5.65:1). The most frequent and predictable words, so the dimmest code colour: identifiers lead and keywords frame. */
	keyword: syntax.blue,
	/** Comments. VS #57a64a (5.5:1). Readable, but behind the code. */
	comment: syntax.greyWarm,
	/** Doc-comment tags, tag brackets, delimiters. VS #608b4e and #808080 (4.2:1). Structure inside prose recedes furthest. Woody keeps it at 4.5:1 or above. */
	docTag: syntax.greyDeep,
	/** Invalid code. VS #f44747. */
	invalid: syntax.red,
};
