// Syntax highlighting: TextMate token rules and semantic token rules.
//
// When two rules match a token, the one with the more specific selector wins, so the order of rules below only matters for identical selectors.
// The build warns about those, so every selector appears at most once per property.

import { accent, neutral, syntax } from './palette.mjs';

const { blue, aqua, mint, gold, yellow, green, lime, magenta } = syntax;
const { rose, orange, red } = accent;
const { sand, silver, grey, greyDim, greyLight } = neutral;

const rule = (name, scope, settings) => ({ name, scope, settings });

export const tokenColors = [
	// --- Base -------------------------------------------------------------
	rule('Emphasis', 'emphasis', { fontStyle: 'italic' }),
	rule('Strong', 'strong', { fontStyle: 'bold' }),
	rule('Header', 'header', { foreground: rose }),
	rule('Comments', 'comment', { foreground: grey }),
	rule('Preprocessor and XML local names', ['entity.name.tag.localname', 'keyword.preprocessor', 'meta.preprocessor'], {
		foreground: greyDim,
	}),
	rule('Preprocessor unquoted strings', 'string.unquoted.preprocessor', { foreground: greyLight, fontStyle: 'bold' }),
	rule('Preprocessor strings', 'meta.preprocessor.string', { foreground: green }),
	rule('Preprocessor numbers', 'meta.preprocessor.numeric', { foreground: yellow }),
	rule('Strings', ['string', 'string.regexp', 'string.tag', 'string.value'], { foreground: green }),
	rule('Numbers', 'constant.numeric', { foreground: yellow }),
	rule('Language constants', ['constant.language', 'constant.regexp'], { foreground: magenta }),
	rule('Invalid', 'invalid', { foreground: red }),

	// --- Keywords and operators ------------------------------------------
	rule(
		'Keywords and storage',
		[
			'keyword',
			'storage',
			'storage.modifier',
			'keyword.operator.expression',
			'keyword.operator.cast',
			'keyword.operator.sizeof',
			'keyword.operator.logical.python',
		],
		{ foreground: blue }
	),
	rule('Control keywords', 'keyword.control', { foreground: blue, fontStyle: '' }),
	rule('Storage types', 'storage.type', { foreground: aqua }),
	rule('Annotations', 'storage.type.annotation', { fontStyle: 'bold' }),
	rule('Operators', 'keyword.operator', { foreground: silver }),
	rule('Arithmetic operators', 'keyword.operator.arithmetic', { foreground: mint }),
	rule('new, units and using', ['keyword.operator.new', 'keyword.other.unit', 'keyword.other.using'], {
		foreground: rose,
	}),

	// --- Variables -------------------------------------------------------
	rule('Variables', 'variable', { foreground: silver }),
	rule('this and self', 'variable.language', { foreground: blue }),
	rule('Constants', 'variable.other.constant', { fontStyle: 'bold' }),
	rule('Variable declarations and built-in variables', ['meta.definition.variable.name', 'support.variable'], {
		foreground: sand,
	}),

	// --- Functions -------------------------------------------------------
	rule(
		'Function declarations and calls',
		['entity.name.function', 'support.function', 'support.constant.handlebars', 'meta.function-call.generic'],
		{ foreground: gold }
	),

	// --- Types and classes -----------------------------------------------
	rule(
		'Types and references',
		[
			'meta.return-type',
			'support.type',
			'entity.name.class',
			'variable.other.object.property',
			'storage.type.generic.cs',
			'storage.type.modifier.cs',
			'storage.type.variable.cs',
			'storage.type.annotation.java',
			'storage.type.generic.java',
			'storage.type.java',
			'storage.type.object.array.java',
			'storage.type.primitive.array.java',
			'storage.type.primitive.java',
			'storage.type.token.java',
			'storage.type.groovy',
			'storage.type.annotation.groovy',
			'storage.type.parameters.groovy',
			'storage.type.generic.groovy',
			'storage.type.object.array.groovy',
			'storage.type.primitive.array.groovy',
			'storage.type.primitive.groovy',
		],
		{ foreground: blue }
	),
	rule(
		'Type names and property names',
		['entity.name.type', 'support.type.property-name', 'support.type.vendored.property-name'],
		{ foreground: orange }
	),
	rule(
		'Type casts, new expressions and built-in constants',
		['meta.type.cast.expr', 'meta.type.new.expr', 'support.constant.math', 'support.constant.dom', 'support.constant.json'],
		{ foreground: aqua }
	),
	rule('Built-in and inherited classes', ['support.class', 'entity.other.inherited-class'], { foreground: silver }),
	rule(
		'Bold annotations and colour values',
		['constant.rgb-value', 'storage.type.annotation.java', 'storage.type.annotation.groovy', 'storage.type.annotation.dart'],
		{ fontStyle: 'bold' }
	),

	// --- Attributes and keys ---------------------------------------------
	rule('Attribute names', 'entity.other.attribute-name', { foreground: orange }),
	rule(
		'Object and dictionary keys',
		['meta.object-literal.key', 'meta.object-literal.key entity.name.function', 'meta.structure.dictionary.key.python'],
		{ foreground: orange }
	),

	// --- HTML / XML ------------------------------------------------------
	rule('Tags', 'entity.name.tag', { foreground: rose, fontStyle: 'bold' }),
	rule('Tag brackets', 'punctuation.definition.tag', { foreground: greyDim }),

	// --- CSS / SCSS / Less -----------------------------------------------
	rule(
		'CSS selectors',
		[
			'entity.name.tag.css',
			'meta.selector',
			'entity.other.attribute-name.class.css',
			'entity.other.attribute-name.class.mixin.css',
			'entity.other.attribute-name.id.css',
			'entity.other.attribute-name.parent-selector.css',
			'entity.other.attribute-name.pseudo-class.css',
			'entity.other.attribute-name.pseudo-element.css',
			'source.css.less entity.other.attribute-name.id',
			'entity.other.attribute-name.attribute.scss',
			'entity.other.attribute-name.scss',
		],
		{ foreground: rose }
	),
	rule('CSS variables', ['variable.css', 'variable.scss', 'variable.other.less'], { foreground: orange }),
	rule(
		'CSS property values',
		[
			'support.constant.property-value',
			'support.constant.font-name',
			'support.constant.media-type',
			'support.constant.media',
			'constant.other.color.rgb-value',
			'constant.other.rgb-value',
			'support.constant.color',
		],
		{ foreground: sand }
	),
	rule(
		'Plain-weight numbers and units',
		['invalid', 'constant.numeric.css', 'keyword.other.unit.px.css', 'constant.numeric.decimal.js', 'constant.numeric.json'],
		{ fontStyle: '' }
	),

	// --- Markup / Markdown -----------------------------------------------
	rule('Underline', 'markup.underline', { fontStyle: 'underline' }),
	rule('Bold', 'markup.bold', { foreground: blue, fontStyle: 'bold' }),
	rule('Italic', 'markup.italic', { fontStyle: 'italic' }),
	rule('Headings', 'markup.heading', { foreground: rose, fontStyle: 'bold' }),
	rule('Inserted', 'markup.inserted', { foreground: green }),
	rule('Deleted', 'markup.deleted', { foreground: rose }),
	rule('Changed and diff headers', ['markup.changed', 'meta.diff.header'], { foreground: blue }),
	rule('Inline code', 'markup.inline.raw', { foreground: orange }),
	rule('Link URLs', 'markup.underline.link.markdown', { foreground: blue }),
	rule('Inline links', 'meta.link.inline.markdown', { foreground: greyDim }),
	rule('Quote markers', 'beginning.punctuation.definition.quote.markdown', { foreground: grey }),
	rule(
		'List markers and separators',
		['meta.separator.markdown', 'punctuation.definition.list.begin.markdown', 'beginning.punctuation.definition.list.markdown'],
		{ foreground: yellow }
	),

	// --- JavaScript / TypeScript -----------------------------------------
	rule(
		'Template expression ${}',
		[
			'punctuation.definition.template-expression.begin.js',
			'punctuation.definition.template-expression.begin.ts',
			'punctuation.definition.template-expression.end.ts',
			'punctuation.definition.template-expression.end.js',
		],
		{ foreground: blue }
	),
	rule(
		'Modules and inherited classes',
		[
			'entity.name.type.module.js',
			'entity.name.type.module.js.jsx',
			'entity.other.inherited-class.js',
			'entity.other.inherited-class.js.jsx',
		],
		{ fontStyle: 'italic' }
	),

	// --- Other languages -------------------------------------------------
	rule('PHP tags', ['punctuation.section.embedded.begin.php', 'punctuation.section.embedded.end.php'], {
		foreground: blue,
	}),
	rule(
		'Java import and package identifiers',
		['storage.modifier.import.java', 'variable.language.wildcard.java', 'storage.modifier.package.java'],
		{ foreground: silver }
	),
	rule('C format placeholders', 'constant.other.placeholder.c', { foreground: lime }),
	rule(
		'LaTeX punctuation',
		[
			'punctuation.math.begin.bracket.curly',
			'punctuation.math.end.bracket.curly',
			'punctuation.definition.string.begin.tex',
			'punctuation.definition.string.end.tex',
			'constant.other.general.math.tex',
		],
		{ foreground: greyDim }
	),
	rule('LaTeX commands', 'support.class.latex', { foreground: rose }),
	rule('Git rebase commands', 'support.function.git-rebase', { foreground: blue }),
	rule('Git rebase hashes', 'constant.sha.git-rebase', { foreground: yellow }),

	// --- Log and output tokens -------------------------------------------
	rule('Info', 'token.info-token', { foreground: blue }),
	rule('Warning', 'token.warn-token', { foreground: orange }),
	rule('Error', 'token.error-token', { foreground: red }),
	rule('Debug', 'token.debug-token', { foreground: magenta }),
];

// Semantic tokens fall back to the TextMate rules above via VS Code's built-in mapping (e.g. `function` → entity.name.function), so only gaps are filled here.
export const semanticTokenColors = {
	namespace: aqua,
	enumMember: magenta,
	'variable.readonly': { bold: false }, // otherwise every `const` usage turns bold
	'*.deprecated': { strikethrough: true },
};
