/**
 * A page's Markdown as an assistant or a reader takes it away: "Copy page",
 * `index.md`, `llms-full.txt`. The source is written for Zensical; out of the
 * site its dialect means nothing, so the export is plain Markdown:
 *
 *   ---                       (front-matter)       dropped
 *   !!! note "Title"          > **Title**          an admonition, a quote
 *       body                  >
 *                             > body
 *   === "uv"                  **uv**               a tab, its label in bold
 *       body                  body
 *   [x](installation.md)      [x](https://docs.piighost.dev/fr/guide/getting-started/installation/)
 *   `x`{ .pii }               `x`
 *   { .figure-caption }       dropped
 *   ![x](a.svg#only-dark)     dropped, the light image stays
 *   -   :icon: __Title__      -   **Title**, a card
 *
 * Code fences are copied untouched.
 */
import type { Language } from './config';

const FENCE = /^\s*(```+|~~~+)/;
const ADMONITION = /^(!!!|\?\?\?\+?)\s+(\w+)(?:\s+"([^"]*)")?\s*$/;
const TAB = /^===\s+"([^"]*)"\s*$/;
const LINK = /(!?)\[((?:[^\]\\]|\\.)*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;
const ATTRIBUTES = /(`[^`]+`)\{\s*\.[\w-]+\s*\}/g;

/** The name an admonition kind gets when the source gives it no title. */
const KINDS: Record<Language, Record<string, string>> = {
	fr: {
		note: 'Note',
		info: 'Info',
		tip: 'Astuce',
		hint: 'Astuce',
		success: 'Réussite',
		question: 'Question',
		warning: 'Attention',
		caution: 'Attention',
		danger: 'Danger',
		failure: 'Échec',
		bug: 'Bogue',
		example: 'Exemple',
		quote: 'Citation',
		abstract: 'Résumé'
	},
	en: {
		note: 'Note',
		info: 'Info',
		tip: 'Tip',
		hint: 'Tip',
		success: 'Success',
		question: 'Question',
		warning: 'Warning',
		caution: 'Caution',
		danger: 'Danger',
		failure: 'Failure',
		bug: 'Bug',
		example: 'Example',
		quote: 'Quote',
		abstract: 'Summary'
	}
};

export interface ExportContext {
	lang: Language;
	/** A link as the page writes it, to an absolute URL. */
	link: (href: string) => string;
	/** An image as the page writes it, to an absolute URL. */
	asset: (src: string) => string;
}

/** The indented block under an opener, dedented by four spaces. */
function block(lines: string[], start: number): { body: string[]; end: number } {
	let end = start;
	while (end < lines.length && (lines[end].startsWith('    ') || lines[end].trim() === '')) end++;
	while (end > start && lines[end - 1].trim() === '') end--;
	const body = lines
		.slice(start, end)
		.map((line) => (line.startsWith('    ') ? line.slice(4) : ''));
	return { body, end };
}

/** Links and attributes, outside code spans. */
function inline(line: string, context: ExportContext): string {
	return line
		.split(/(`+[^`]*`+(?:\{\s*\.[\w-]+\s*\})?)/)
		.map((part, index) =>
			index % 2 === 1
				? part.replace(ATTRIBUTES, '$1')
				: part.replace(
						LINK,
						(_all, bang: string, text: string, href: string, title: string) =>
							`${bang}[${text}](${bang ? context.asset(href.replace(/#only-light$/, '')) : context.link(href)}${title})`
					)
		)
		.join('');
}

function convert(lines: string[], context: ExportContext): string[] {
	const out: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		const fence = FENCE.exec(line);
		if (fence) {
			const indent = line.slice(0, line.indexOf(fence[1]));
			out.push(line);
			index++;
			while (index < lines.length && !lines[index].startsWith(indent + fence[1]))
				out.push(lines[index++]);
			if (index < lines.length) out.push(lines[index++]);
			continue;
		}
		const admonition = ADMONITION.exec(line);
		if (admonition) {
			const { body, end } = block(lines, index + 1);
			const kind = admonition[2].toLowerCase();
			const title = admonition[3] || KINDS[context.lang][kind] || kind;
			const inner = convert(body, context);
			out.push(
				`> **${inline(title, context)}**`,
				...(inner.length ? ['>'] : []),
				...inner.map((text) => (text ? `> ${text}` : '>'))
			);
			index = end;
			continue;
		}
		const tab = TAB.exec(line);
		if (tab) {
			const { body, end } = block(lines, index + 1);
			out.push(`**${tab[1]}**`, '', ...convert(body, context));
			index = end;
			continue;
		}
		// A caption's marker, a grid's div, a card's rule, the dark twin of an image.
		if (
			line.trim() === '{ .figure-caption }' ||
			/^<\/?div\b[^>]*>\s*$/.test(line.trim()) ||
			/^\s{4,}---\s*$/.test(line) ||
			/^\s*!\[[^\]]*\]\([^)]*#only-dark\)\s*$/.test(line)
		) {
			index++;
			continue;
		}
		// A card's head, `-   :lucide-rocket: __Start__`: its title in bold.
		const card = /^(\s*-\s+)(?::[\w-]+:\s*)+(.*)$/.exec(line);
		if (card) {
			out.push(inline(`${card[1]}${card[2].replace(/__(.+?)__/g, '**$1**')}`, context));
			index++;
			continue;
		}
		out.push(inline(line, context));
		index++;
	}
	return out;
}

/** The page's Markdown, out of the Zensical dialect. */
export function exportMarkdown(source: string, context: ExportContext): string {
	const body = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
	return (
		convert(body.split('\n'), context)
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim() + '\n'
	);
}
