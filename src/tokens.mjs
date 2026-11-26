// Syntax highlighting: TextMate token rules and semantic token rules.
//
// Every colour comes from the `token` roles in src/palette.mjs, which follow Visual Studio 2022 Dark. This file only decides which scopes play which role.
// Bold follows VS Code's built-in Solarized Dark instead (see "Bold" below).
// Colour and font style resolve separately: a rule that sets only one of them leaves the other to whichever rule matches next.
// When two rules match a token, the one with the more specific selector wins, so the order of rules below only matters for identical selectors.
// The build warns about those, so every selector appears at most once per property.

import { token } from './palette.mjs';

const rule = (name, scope, settings) => ({ name, scope, settings });
const fg = (foreground) => ({ foreground });

export const tokenColors = [
	// --- Base -------------------------------------------------------------
	rule('Emphasis', 'emphasis', { fontStyle: 'italic' }),
	rule('Strong', 'strong', { fontStyle: 'bold' }),
	// Embedded code and interpolated expressions go back to plain text, so the surrounding string or markup colour does not leak into them.
	rule(
		'Embedded code',
		[
			'meta.embedded',
			'source.groovy.embedded',
			'string meta.image.inline.markdown',
			'variable.legacy.builtin.python',
			'meta.template.expression',
			'meta.interpolation',
		],
		fg(token.text)
	),
	rule('Comments', 'comment', fg(token.comment)),
	rule('Invalid', 'invalid', fg(token.invalid)),

	// --- Bold -------------------------------------------------------------
	// Solarized Dark's rules. Everything a grammar scopes as storage is bold: declaration words (class, function, def, let, const), modifiers (public, static, async) and built-in types (int, void).
	// Control flow, operators and language constants stay regular. So do the names a declaration introduces, which some grammars nest inside the storage scope.
	// Markdown headings and bold text are bold too (see Markup), except setext headings and inline code.
	rule('Storage', 'storage', { fontStyle: 'bold' }),
	rule(
		'Declared names',
		['entity.name.class', 'entity.name.type', 'entity.name.namespace', 'entity.name.scope-resolution'],
		{ fontStyle: '' }
	),

	// --- Keywords ---------------------------------------------------------
	// Declaration keywords, modifiers, built-in primitive types and word-like operators are all "language words" in VS, so they share the keyword colour.
	rule(
		'Keywords and storage',
		[
			'keyword',
			'storage',
			'storage.type',
			'storage.modifier',
			'keyword.operator.noexcept',
			'keyword.operator.new',
			'keyword.operator.delete',
			'keyword.operator.expression',
			'keyword.operator.cast',
			'keyword.operator.sizeof',
			'keyword.operator.alignof',
			'keyword.operator.typeid',
			'keyword.operator.alignas',
			'keyword.operator.instanceof',
			'keyword.operator.wordlike',
			'keyword.operator.logical.python',
			'keyword.other.using',
			'keyword.other.directive.using',
			'keyword.other.operator',
			'keyword.other.important.css',
			'support.type.primitive',
			'support.type.builtin',
		],
		fg(token.keyword)
	),
	rule(
		'Language constants, this and self',
		[
			'constant.language',
			'constant.character',
			'constant.other.option',
			'variable.language',
			'variable.parameter.function.language.special',
		],
		fg(token.keyword)
	),
	rule(
		'Interpolation and embedding punctuation',
		[
			'punctuation.definition.template-expression.begin',
			'punctuation.definition.template-expression.end',
			'punctuation.section.embedded',
			'punctuation.definition.interpolation',
		],
		fg(token.keyword)
	),
	rule('Control flow', 'keyword.control', fg(token.control)),
	rule('Operators', ['keyword.operator', 'storage.type.function.arrow'], fg(token.operator)),

	// --- Preprocessor and macros -----------------------------------------
	rule(
		'Preprocessor directives',
		[
			'keyword.control.directive',
			'keyword.preprocessor',
			'punctuation.definition.directive',
			'meta.preprocessor punctuation.separator.hash',
			'string.unquoted.preprocessor',
			'entity.other.attribute-name.pragma.preprocessor',
			'meta.tag.preprocessor.xml',
		],
		fg(token.preprocessor)
	),
	rule('Macros', ['entity.name.function.preprocessor', 'entity.name.function.macro'], fg(token.macro)),

	// --- Names: locals, members, functions, namespaces ---------------------
	// Locals and parameters are tinted; members (fields, properties, events) stay plain text.
	rule(
		'Locals and parameters',
		[
			'variable',
			'variable.parameter',
			'meta.definition.variable.name',
			'support.variable',
			'entity.name.variable',
			'variable.other.constant',
			'support.function.git-rebase',
		],
		fg(token.local)
	),
	rule(
		'Members',
		[
			'variable.other.property',
			'variable.other.object.property',
			'variable.other.member',
			'variable.other.constant.property',
			'support.variable.property',
			'entity.name.variable.field',
			'entity.name.variable.property',
			'entity.name.variable.event',
			'variable.other.readwrite.instance',
			'variable.other.readwrite.class',
		],
		fg(token.text)
	),
	rule(
		'Functions and methods',
		[
			'entity.name.function',
			'support.function',
			'support.constant.handlebars',
			'meta.function-call.generic',
			'source.powershell variable.other.member',
			'entity.name.operator',
			'entity.name.command',
			'punctuation.definition.decorator',
		],
		fg(token.function)
	),
	rule(
		'Namespaces, modules and labels',
		[
			'entity.name.namespace',
			'entity.name.scope-resolution',
			'entity.name.type.namespace',
			'entity.name.type.module',
			'entity.name.type.package',
			'entity.name.module',
			'support.other.namespace',
			'entity.name.tag.namespace.xml',
			'storage.modifier.import.java',
			'storage.modifier.package.java',
			'variable.language.wildcard.java',
			'entity.name.label',
		],
		fg(token.namespace)
	),

	// --- Types ------------------------------------------------------------
	// Named types are aqua; built-in primitives stay keywords (above), as `int` is in VS. Value types and abstract types are steps of the same family.
	rule(
		'Types',
		[
			'support.class',
			'support.type',
			'entity.name.type',
			'entity.name.class',
			'entity.other.inherited-class',
			'entity.other.attribute',
			'meta.type.cast.expr',
			'meta.type.new.expr',
			'support.constant.math',
			'support.constant.dom',
			'support.constant.json',
			'storage.type.annotation',
			'punctuation.definition.annotation',
			'punctuation.separator.namespace.ruby',
			'storage.type.cs',
			'storage.type.generic.cs',
			'storage.type.modifier.cs',
			'storage.type.variable.cs',
			'storage.type.java',
			'storage.type.generic.java',
			'storage.type.object.array.java',
			'storage.type.token.java',
			'storage.type.groovy',
			'storage.type.parameters.groovy',
			'storage.type.generic.groovy',
			'storage.type.object.array.groovy',
		],
		fg(token.type)
	),
	rule('Structs', 'entity.name.type.struct', fg(token.struct)),
	rule(
		'Interfaces, enums and type parameters',
		[
			'entity.name.type.interface',
			'entity.name.type.protocol',
			'entity.name.type.trait',
			'entity.name.type.enum',
			'entity.name.type.type-parameter',
			'entity.name.type.parameter',
			'entity.name.type.lifetime',
			'punctuation.definition.lifetime',
		],
		fg(token.abstractType)
	),

	// --- Keys and attributes -----------------------------------------------
	rule(
		'Keys and attribute names',
		[
			'entity.other.attribute-name',
			'support.type.property-name',
			'support.type.vendored.property-name',
			'punctuation.support.type.property-name',
			'meta.object-literal.key',
			'meta.structure.dictionary.key.python',
			'support.type.map.key',
			'entity.name.tag.yaml',
			'keyword.other.definition.ini',
			'variable.key',
		],
		fg(token.key)
	),

	// --- Literals ---------------------------------------------------------
	rule(
		'Strings',
		[
			'string',
			'string.tag',
			'string.value',
			'meta.preprocessor.string',
			'meta.embedded.assembly',
			// CSS property values read as text, as in VS.
			'support.constant.property-value',
			'support.constant.font-name',
			'support.constant.media-type',
			'support.constant.media',
			'constant.other.color.rgb-value',
			'constant.other.rgb-value',
			'support.constant.color',
		],
		fg(token.string)
	),
	rule(
		'Escapes and placeholders',
		[
			'constant.character.escape',
			'constant.other.placeholder',
			'constant.character.entity',
			'constant.character.format.placeholder',
			'storage.type.format',
		],
		fg(token.escape)
	),
	rule(
		'Numbers, units and enum members',
		[
			'constant.numeric',
			'keyword.other.unit',
			'keyword.operator.plus.exponent',
			'keyword.operator.minus.exponent',
			'meta.preprocessor.numeric',
			'variable.other.enummember',
			'entity.name.variable.enum-member',
			'constant.other.enum',
			'constant.other.symbol',
			'constant.sha.git-rebase',
		],
		fg(token.number)
	),

	// --- Regular expressions ---------------------------------------------
	// VS gives the regex micro-language its own saturated accents: classes, anchors and quantifiers, and groups each read at a glance.
	rule('Regex', 'string.regexp', fg(token.string)),
	rule(
		'Regex character classes',
		[
			'constant.character.character-class.regexp',
			'constant.other.character-class.regexp',
			'constant.other.character-class.set.regexp',
			'constant.character.set.regexp',
			'constant.other.set.regexp',
			'punctuation.definition.character-class.regexp',
			'punctuation.character.set.begin.regexp',
			'punctuation.character.set.end.regexp',
			'keyword.operator.negation.regexp',
			'support.other.match.any.regexp',
		],
		fg(token.keyword)
	),
	rule(
		'Regex anchors and quantifiers',
		[
			'keyword.control.anchor.regexp',
			'support.other.match.begin.regexp',
			'support.other.match.end.regexp',
			'keyword.operator.quantifier.regexp',
			'constant.regexp',
		],
		fg(token.macro)
	),
	rule(
		'Regex groups and alternation',
		[
			'punctuation.definition.group.regexp',
			'punctuation.definition.group.assertion.regexp',
			'punctuation.definition.group.no-capture.regexp',
			'support.other.parenthesis.regexp',
			'keyword.operator.or.regexp',
			'keyword.operator.disjunction.regexp',
		],
		fg(token.struct)
	),

	// --- Doc comments -----------------------------------------------------
	// Tags recede below the comment text; the names they document are lifted a little, like attribute values in VS's XML doc comments.
	rule(
		'Doc comment tags',
		[
			'storage.type.class.jsdoc',
			'storage.type.class.doxygen',
			'keyword.other.documentation',
			'keyword.other.phpdoc',
			'keyword.operator.documentation',
			'comment.block.documentation entity.name.tag',
			'comment.block.documentation punctuation.definition.tag',
		],
		fg(token.docTag)
	),
	rule(
		'Doc comment names',
		[
			'variable.other.jsdoc',
			'entity.name.type.instance.jsdoc',
			'comment.block.documentation entity.other.attribute-name',
			'comment.block.documentation string',
		],
		fg(token.namespace)
	),

	// --- HTML / XML -------------------------------------------------------
	// Tag names are language words, as in VS. Attribute names are keys (above), and entities are escapes.
	rule('Tags', 'entity.name.tag', fg(token.keyword)),
	rule('Tag brackets', 'punctuation.definition.tag', fg(token.docTag)),
	rule('PHP tags', ['punctuation.section.embedded.begin.php', 'punctuation.section.embedded.end.php'], fg(token.keyword)),

	// --- CSS / SCSS / Less -----------------------------------------------
	// Selectors get the function hue, mirroring VS's selector tan sitting beside its method yellow.
	rule(
		'CSS selectors',
		[
			'meta.selector',
			'entity.name.tag.css',
			'entity.name.tag.less',
			'entity.name.tag.nesting.css',
			'entity.name.tag.reference.scss',
			'entity.other.attribute-name.class.css',
			'source.css entity.other.attribute-name.class',
			'entity.other.attribute-name.class.mixin.css',
			'entity.other.attribute-name.id.css',
			'entity.other.attribute-name.parent-selector.css',
			'entity.other.attribute-name.parent-selector-suffix.css',
			'entity.other.attribute-name.parent.less',
			'source.css entity.other.attribute-name.pseudo-class',
			'entity.other.attribute-name.pseudo-class.css',
			'entity.other.attribute-name.pseudo-element.css',
			'source.css.less entity.other.attribute-name.id',
			'entity.other.attribute-name.scss',
			'entity.other.attribute-name.placeholder',
		],
		fg(token.function)
	),
	rule('CSS variables', ['variable.css', 'variable.scss', 'variable.other.less', 'source.css variable'], fg(token.local)),

	// --- Markup / Markdown -----------------------------------------------
	rule('Headings', ['markup.heading', 'header'], { foreground: token.keyword, fontStyle: 'bold' }),
	rule('Setext headings', 'markup.heading.setext', { fontStyle: '' }), // underlined with === or ---, as in Solarized Dark
	rule('Bold', 'markup.bold', { foreground: token.keyword, fontStyle: 'bold' }),
	rule('Italic', 'markup.italic', { foreground: token.control, fontStyle: 'italic' }),
	rule('Strikethrough', 'markup.strikethrough', { fontStyle: 'strikethrough' }),
	rule('Underline', 'markup.underline', { fontStyle: 'underline' }),
	rule('Inline code', 'markup.inline.raw', { foreground: token.string, fontStyle: '' }), // regular even inside a bold span or heading
	rule('Quote markers', 'punctuation.definition.quote.begin.markdown', fg(token.comment)),
	rule('List markers', 'punctuation.definition.list.begin.markdown', fg(token.keyword)),
	rule('Link URLs', 'markup.underline.link', fg(token.keyword)),
	rule('Link punctuation and separators', ['meta.link.inline.markdown', 'meta.separator.markdown'], fg(token.docTag)),
	rule('INI sections', 'entity.name.section.group-title.ini', fg(token.keyword)),

	// --- Diff -------------------------------------------------------------
	rule('Inserted', 'markup.inserted', fg(token.string)),
	rule('Deleted', 'markup.deleted', fg(token.control)),
	rule('Changed and diff headers', ['markup.changed', 'meta.diff.header'], fg(token.keyword)),

	// --- Other languages -------------------------------------------------
	rule(
		'LaTeX punctuation',
		[
			'punctuation.math.begin.bracket.curly',
			'punctuation.math.end.bracket.curly',
			'punctuation.definition.string.begin.tex',
			'punctuation.definition.string.end.tex',
			'constant.other.general.math.tex',
		],
		fg(token.docTag)
	),

	// --- Log and output tokens -------------------------------------------
	// VS Code's log grammar borrows markup and string.regexp scopes for its levels, so the levels are pinned here; otherwise errors would turn string green.
	rule('Info', ['token.info-token', 'log.info'], fg(token.keyword)),
	rule('Warning', ['token.warn-token', 'log.warning'], fg(token.key)),
	rule('Error', ['token.error-token', 'log.error', 'log.exceptiontype'], fg(token.invalid)),
	rule('Debug', ['token.debug-token', 'log.debug'], fg(token.macro)),
	rule('Verbose', 'log.verbose', fg(token.comment)),
];

// Semantic tokens fall back to the TextMate rules above via VS Code's built-in mapping (e.g. `function` → entity.name.function).
// They are listed here anyway where the role differs from that fallback, or where a language server adds its own token types.
export const semanticTokenColors = {
	// Standard token types.
	namespace: token.namespace,
	label: token.namespace,
	'variable.global': token.namespace,
	class: token.type,
	type: token.type,
	struct: token.struct,
	interface: token.abstractType,
	enum: token.abstractType,
	typeParameter: token.abstractType,
	enumMember: token.number,
	function: token.function,
	method: token.function,
	decorator: token.function,
	macro: token.macro,
	variable: token.local,
	'variable.readonly': token.local,
	parameter: token.local,
	property: token.text,
	'property.readonly': token.text,
	event: token.text,
	operator: token.operator,
	'*.deprecated': { strikethrough: true },

	// C/C++ (cpptools).
	newOperator: token.keyword,
	operatorOverload: token.function,
	operatorOverloadMember: token.function,
	customLiteral: token.function,
	numberLiteral: token.number,
	stringLiteral: token.string,

	// C# (Roslyn). These are the classifications VS 2022 itself colours, so they map one to one.
	controlKeyword: token.control,
	operatorOverloaded: token.function,
	extensionMethod: token.function,
	recordClass: token.type,
	recordStruct: token.struct,
	delegate: token.type,
	field: token.text,
	constant: token.text,
	preprocessorText: token.text,
	excludedCode: token.comment,
	stringVerbatim: token.string,
	stringEscapeCharacter: token.escape,
	regexText: token.string,
	regexSelfEscapedCharacter: token.string,
	regexOtherEscape: token.escape,
	regexCharacterClass: token.keyword,
	regexAnchor: token.macro,
	regexQuantifier: token.macro,
	regexGrouping: token.struct,
	regexAlternation: token.struct,
	regexComment: token.comment,
	xmlDocCommentText: token.comment,
	xmlDocCommentDelimiter: token.docTag,
	xmlDocCommentName: token.docTag,
	xmlDocCommentAttributeName: token.docTag,
	xmlDocCommentAttributeQuotes: token.docTag,
	xmlDocCommentAttributeValue: token.namespace,
	xmlDocCommentEntityReference: token.docTag,
	xmlDocCommentProcessingInstruction: token.docTag,
	xmlDocCommentComment: token.docTag,
	xmlDocCommentCDataSection: token.comment,

	// Python (Pylance).
	selfParameter: token.keyword,
	clsParameter: token.keyword,
	builtinConstant: token.keyword,
	magicFunction: token.function,

	// Rust (rust-analyzer).
	selfKeyword: token.keyword,
	builtinType: token.keyword,
	lifetime: token.abstractType,
	typeAlias: token.type,
	formatSpecifier: token.escape,
	escapeSequence: token.escape,
};
