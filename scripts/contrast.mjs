// Prints how each syntax role in src/palette.mjs compares with the Visual Studio 2022 Dark colour it is modelled on.
//
//   node scripts/contrast.mjs
//
// For every role: Woody's colour, its WCAG contrast on the editor background, its OKLab lightness/chroma/hue, and the same for the VS reference on VS's #1e1e1e.
// Then the closest pairs of roles by OKLab distance, which is where two roles risk looking alike. For scale, VS's own method/number pair is 0.067 and class/struct is 0.054.

import { contrast, token, wood } from '../src/palette.mjs';

const VS_BACKGROUND = '#1e1e1e';
const vs = {
	text: '#dcdcdc',
	local: '#9cdcfe',
	function: '#dcdcaa',
	escape: '#ffd68f',
	abstractType: '#b8d7a3',
	namespace: '#c8c8c8',
	number: '#b5cea8',
	type: '#4ec9b0',
	struct: '#86c691',
	control: '#d8a0df',
	operator: '#b4b4b4',
	string: '#d69d85',
	key: '#9cdcfe',
	macro: '#beb7ff',
	preprocessor: '#9b9b9b',
	keyword: '#569cd6',
	comment: '#57a64a',
	docTag: '#608b4e',
	invalid: '#f44747',
};

const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function oklab(color) {
	const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(color.slice(i, i + 2), 16) / 255));
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}
function describe(color) {
	const [L, a, b] = oklab(color);
	const hue = (Math.atan2(b, a) * 180) / Math.PI;
	return `L${L.toFixed(2)} C${Math.hypot(a, b).toFixed(3)} h${String(Math.round((hue + 360) % 360)).padStart(3)}`;
}
const distance = (x, y) => Math.hypot(...oklab(x).map((v, i) => v - oklab(y)[i]));

const rows = Object.entries(token).map(([name, color]) => [
	name.padEnd(13),
	color,
	contrast(color, wood.base).toFixed(2).padStart(6),
	describe(color),
	'  vs',
	vs[name] ?? '       ',
	vs[name] ? contrast(vs[name], VS_BACKGROUND).toFixed(2).padStart(6) : '',
]);
console.log(`Role          Woody    on ${wood.base}  OKLab               VS reference on ${VS_BACKGROUND}`);
for (const row of rows) console.log(row.join('  '));

const names = Object.keys(token);
const pairs = names.flatMap((x, i) => names.slice(i + 1).map((y) => [`${x} / ${y}`, distance(token[x], token[y])]));
pairs.sort((p, q) => p[1] - q[1]);
console.log('\nClosest pairs (OKLab distance):');
for (const [pair, d] of pairs.slice(0, 10)) console.log(`  ${pair.padEnd(28)} ${d.toFixed(3)}`);
