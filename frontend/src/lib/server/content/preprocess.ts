/**
 * Turn the Zensical dialect of docs/ into standard Markdown directives.
 *
 * The pages stay written for Zensical: nothing in the piighost repository has
 * to change for this site to render them. Each Zensical construct becomes a
 * remark-directive container that the tree builder knows:
 *
 *   !!! note "Title"          :::note[Title]        an admonition
 *       body                  body
 *                             :::
 *   ??? note "Title"          :::note[Title]{collapsible="closed"}, `???+` open
 *   === "uv"                  ::::tabs              synced tabs
 *       body                  :::tab[uv] … :::
 *                             ::::
 *   <div class="grid cards" markdown>  :::cards with :::card[Title] children
 *   `x`{ .pii }               :pii{v="x"}           an entity chip
 *   *text*                    :::caption            a figure caption
 *   { .figure-caption }
 *   *[ABBR]: definition       collected, removed    an abbreviation
 *   Term                      ::::dl with :::dt and  a definition list
 *   :   definition            :::dd children
 *   --8<-- "snippets/x.py:run"  the lines of that file or section, first of all
 *
 * Code fences are copied untouched: a line inside a fence is never read as one
 * of the constructs above.
 */

export interface Preprocessed {
	markdown: string;
	abbreviations: Map<string, string>;
}

const ADMONITION = /^(!!!|\?\?\?\+?)\s+(\w+)(?:\s+"([^"]*)")?\s*$/;
const TAB = /^===\s+"([^"]*)"\s*$/;
const FENCE = /^\s*(```+|~~~+)/;
const ABBREVIATION = /^\*\[([^\]]+)\]:\s*(.+)$/;
/** The first line of a definition, under its term: `:   text`. */
const DEFINITION = /^:\s{1,3}(?=\S)/;
const CARDS_OPEN = /^<div class="grid cards" markdown(?:="1")?>\s*$/;
const ATTR_INLINE = /`([^`]+)`\{\s*\.(pii|placeholder)\s*\}/g;
/** A bare placeholder in prose: CommonMark would read `<PERSON:1>` as a link. */
const BARE_PLACEHOLDER = /<<([A-Z][A-Z0-9_]*(?::[A-Za-z0-9_-]+)?)>>/g;

/** Strip one level of four-space indentation, keeping blank lines blank. */
function dedent(lines: string[]): string[] {
	return lines.map((line) =>
		line.startsWith('    ') ? line.slice(4) : line.trimStart() === '' ? '' : line
	);
}

/** The indented block that follows an opener: lines indented by four, or blank. */
function takeIndented(lines: string[], start: number): { body: string[]; end: number } {
	let end = start;
	while (end < lines.length && (lines[end].startsWith('    ') || lines[end].trim() === '')) end++;
	// Trailing blank lines belong to what follows, not to the block.
	while (end > start && lines[end - 1].trim() === '') end--;
	return { body: dedent(lines.slice(start, end)), end };
}

/** The deepest directive fence a block uses, so its parent can use one more colon. */
function colonsIn(lines: string[]): number {
	let most = 0;
	for (const line of lines) {
		const match = /^(:{3,})/.exec(line);
		if (match) most = Math.max(most, match[1].length);
	}
	return most;
}

const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const escapeLabel = (value: string) => value.replace(/([[\]])/g, '\\$1');

/** Inline constructs, outside code spans and only on lines outside fences. */
function inline(line: string): string {
	// A bare placeholder outside code spans first: once `x`{ .placeholder } has
	// become a directive, its `<<…>>` sits outside backticks and would be read
	// a second time.
	const bare = line
		.split(/(`+[^`]*`+)/)
		.map((part, index) =>
			index % 2 === 1
				? part
				: part.replace(BARE_PLACEHOLDER, (token) => `:ph{v="${escapeAttr(token)}"}`)
		)
		.join('');
	return bare.replace(ATTR_INLINE, (_all, value: string, kind: string) => {
		const name = kind === 'pii' ? 'pii' : 'ph';
		return `:${name}{v="${escapeAttr(value)}"}`;
	});
}

/** One card of a Zensical grid: `-   :icon: __Title__`, a `---` rule, then the body. */
function convertCards(lines: string[]): string[] {
	const out: string[] = [];
	let index = 0;
	const cards: string[][] = [];
	while (index < lines.length) {
		const item = /^-\s{1,3}(.*)$/.exec(lines[index]);
		if (!item) {
			index++;
			continue;
		}
		const head = item[1].replace(/:[a-z0-9-]+:\s*/g, '').trim();
		const title = /__(.+?)__|\*\*(.+?)\*\*/.exec(head);
		const { body, end } = takeIndented(lines, index + 1);
		const text = body.filter((line) => line.trim() !== '---');
		const converted = convert(text);
		cards.push([
			`:::card[${escapeLabel(title ? (title[1] ?? title[2]) : head)}]`,
			...converted,
			':::'
		]);
		index = end;
	}
	const inner = cards.flat();
	const fence = ':'.repeat(Math.max(4, colonsIn(inner) + 1));
	out.push(`${fence}cards`, ...inner, fence);
	return out;
}

/** A term opens a definition list entry: an unindented line with a definition under it. */
function isTerm(lines: string[], index: number): boolean {
	const line = lines[index];
	return (
		line !== undefined &&
		line.trim() !== '' &&
		!/^\s/.test(line) &&
		index + 1 < lines.length &&
		DEFINITION.test(lines[index + 1])
	);
}

/** The index of the next non-blank line from `index`. */
function skipBlank(lines: string[], index: number): number {
	while (index < lines.length && lines[index].trim() === '') index++;
	return index;
}

/**
 * A definition list, Python-Markdown's def_list: entries of one term line and
 * one or more `:   ` definitions, whose following lines are indented by four.
 */
function convertDefinitions(lines: string[], start: number): { out: string[]; end: number } {
	const entries: string[][] = [];
	let index = start;
	while (isTerm(lines, index)) {
		entries.push([':::dt', inline(lines[index]), ':::']);
		index++;
		while (index < lines.length && DEFINITION.test(lines[index])) {
			const { body, end } = takeIndented(lines, index + 1);
			const inner = convert([lines[index].replace(DEFINITION, ''), ...body]);
			const colons = ':'.repeat(Math.max(3, colonsIn(inner) + 1));
			entries.push([`${colons}dd`, ...inner, colons]);
			const next = skipBlank(lines, end);
			index = next < lines.length && DEFINITION.test(lines[next]) ? next : end;
		}
		const next = skipBlank(lines, index);
		if (!isTerm(lines, next)) break;
		index = next;
	}
	const inner = entries.flat();
	const colons = ':'.repeat(Math.max(4, colonsIn(inner) + 1));
	return { out: ['', `${colons}dl`, ...inner, colons, ''], end: index };
}

/** Convert a run of lines, recursively for the bodies of containers. */
function convert(lines: string[]): string[] {
	const out: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];

		const fence = FENCE.exec(line);
		if (fence) {
			const marker = fence[1];
			const indent = line.slice(0, line.indexOf(marker));
			out.push(line);
			index++;
			while (index < lines.length && !lines[index].startsWith(indent + marker)) {
				out.push(lines[index]);
				index++;
			}
			if (index < lines.length) out.push(lines[index++]);
			continue;
		}

		const admonition = ADMONITION.exec(line);
		if (admonition) {
			const { body, end } = takeIndented(lines, index + 1);
			const inner = convert(body);
			const colons = ':'.repeat(Math.max(3, colonsIn(inner) + 1));
			const title = admonition[3] !== undefined ? `[${escapeLabel(admonition[3])}]` : '';
			const marker = admonition[1];
			const collapsible =
				marker === '!!!' ? '' : `{collapsible="${marker === '???+' ? 'open' : 'closed'}"}`;
			out.push('', `${colons}${admonition[2]}${title}${collapsible}`, ...inner, colons, '');
			index = end;
			continue;
		}

		if (TAB.test(line)) {
			const tabs: string[][] = [];
			while (index < lines.length) {
				const tab = TAB.exec(lines[index]);
				if (!tab) break;
				const { body, end } = takeIndented(lines, index + 1);
				const inner = convert(body);
				const colons = ':'.repeat(Math.max(3, colonsIn(inner) + 1));
				tabs.push([`${colons}tab[${escapeLabel(tab[1])}]`, ...inner, colons]);
				index = end;
				// Blank lines between two tabs of one set.
				let next = index;
				while (next < lines.length && lines[next].trim() === '') next++;
				if (next < lines.length && TAB.test(lines[next])) index = next;
				else break;
			}
			const inner = tabs.flat();
			const colons = ':'.repeat(Math.max(4, colonsIn(inner) + 1));
			out.push('', `${colons}tabs`, ...inner, colons, '');
			continue;
		}

		if (CARDS_OPEN.test(line)) {
			let end = index + 1;
			while (end < lines.length && lines[end].trim() !== '</div>') end++;
			out.push('', ...convertCards(lines.slice(index + 1, end)), '');
			index = end + 1;
			continue;
		}

		if (line.trim() === '{ .figure-caption }') {
			// The paragraph above is the caption: wrap the lines back to the blank one.
			let start = out.length;
			while (start > 0 && out[start - 1].trim() !== '') start--;
			const caption = out.splice(start);
			out.push(':::caption', ...caption, ':::');
			index++;
			continue;
		}

		if ((out.length === 0 || out[out.length - 1].trim() === '') && isTerm(lines, index)) {
			const definitions = convertDefinitions(lines, index);
			out.push(...definitions.out);
			index = definitions.end;
			continue;
		}

		out.push(inline(line));
		index++;
	}
	return out;
}

const INCLUDE = /^(\s*)--8<--\s+"([^"]+)"\s*$/;

/** Read a file to include, by the path a page writes; undefined when it does not exist. */
export type IncludeReader = (path: string) => string | undefined;

/**
 * The lines of an included file, or of one section of it, as pymdownx.snippets
 * gives them: `# --8<-- [start:name]` and `[end:name]` delimit a section, and
 * every marker line is left out. The include line's indentation is applied to
 * every line, so an example lands inside a tab as it would by hand.
 */
function includeLines(
	indent: string,
	ref: string,
	read: IncludeReader,
	problems: string[]
): string[] {
	const [path, name] = ref.split(':');
	const text = read(path);
	if (text === undefined) {
		problems.push(`missing include ${ref}`);
		return [];
	}
	let lines = text.replace(/\n$/, '').split('\n');
	if (name) {
		const start = lines.findIndex((line) => line.includes(`--8<-- [start:${name}]`));
		const end = lines.findIndex((line) => line.includes(`--8<-- [end:${name}]`));
		if (start < 0 || end < start) {
			problems.push(`missing section ${ref}`);
			return [];
		}
		lines = lines.slice(start + 1, end);
	}
	return lines
		.filter((line) => !line.includes('--8<--'))
		.map((line) => (line.trim() ? indent + line : ''));
}

/** Expand every include line of a page, before anything else reads it. */
export function expandIncludes(source: string, read: IncludeReader, problems: string[]): string {
	return source
		.split('\n')
		.flatMap((line) => {
			const include = INCLUDE.exec(line);
			return include ? includeLines(include[1], include[2], read, problems) : [line];
		})
		.join('\n');
}

/** Preprocess one page, given the abbreviations its language appends to every page. */
export function preprocess(source: string, shared: Map<string, string> = new Map()): Preprocessed {
	const abbreviations = new Map(shared);
	const kept: string[] = [];
	let inFence = false;
	for (const line of source.split('\n')) {
		if (FENCE.test(line)) inFence = !inFence;
		const abbreviation = inFence ? null : ABBREVIATION.exec(line);
		if (abbreviation) abbreviations.set(abbreviation[1], abbreviation[2].trim());
		else kept.push(line);
	}
	return { markdown: convert(kept).join('\n'), abbreviations };
}

/** Read the abbreviation file a language auto-appends (includes/abbreviations.md). */
export function readAbbreviations(source: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const line of source.split('\n')) {
		const abbreviation = ABBREVIATION.exec(line);
		if (abbreviation) found.set(abbreviation[1], abbreviation[2].trim());
	}
	return found;
}
