/**
 * hast to the ContentNode tree @piighost/ui renders.
 *
 * Here the page becomes a site page: links are rewritten to routes, headings
 * get ids and feed the table of contents, `pg-*` elements become components,
 * identifiers become links to their definition, abbreviations get a title,
 * code is highlighted, and every `style` and `on*` attribute is dropped, as
 * the production policy `style-src 'self'` demands.
 */
import GithubSlugger from 'github-slugger';
import { find, html } from 'property-information';
import { toString } from 'hast-util-to-string';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { Attributes, ContentNode } from '@piighost/ui/content';
import type { TocEntry } from '@piighost/ui';
import { assignHues, categoryOf } from '@piighost/ui/utils';
import { highlight } from './highlight';
import { ID_PATTERN, type IdIndex } from './ids';

export interface TreeContext {
	/** Rewrite a link written in the page, relative to its file. */
	resolveLink: (href: string) => string;
	/** Rewrite an image source, relative to the page's file. */
	resolveAsset: (src: string) => string;
	/** Render a Mermaid diagram, returning the URLs of its two themes and its size. */
	renderDiagram: (
		code: string
	) => Promise<{ light: string; dark: string; width: number; height: number }>;
	ids: IdIndex;
	abbreviations: Map<string, string>;
	/** The id this page defines with each block, read by its first words. */
	definitionAnchors: Map<string, string>;
	/** How headings become ids: the rule the page's links were written for. */
	slugStyle: 'python-markdown' | 'github';
	/** The page's language: French puts a narrow no-break space before : ; ! ? */
	lang: 'fr' | 'en';
	problems: string[];
}

/**
 * French typography: the space before a high punctuation mark never breaks,
 * so a line never starts with ":" and the gap stays narrow (U+202F). Applied
 * to what the reader sees, never to what an id is made from.
 */
export function typeset(text: string, lang: 'fr' | 'en'): string {
	return lang === 'fr' ? text.replace(/ ([:;!?»])/g, '\u202f$1').replace(/« /g, '«\u202f') : text;
}

/** A diagram wider than this is shrunk below half its size on a phone: it gets a link to its full size. */
const WIDE_DIAGRAM = 600;

/**
 * Python-Markdown's toc slugify, which Zensical uses: accents dropped by NFKD,
 * anything but word characters, spaces and hyphens removed, runs of both made
 * one hyphen, and a repeated slug suffixed `_1`, `_2`.
 */
class PythonMarkdownSlugger {
	seen = new Map<string, number>();
	slug(text: string): string {
		const base = text
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			// Python's encode('ascii', 'ignore'): every non-ASCII character goes.
			.replace(/[^\p{ASCII}]/gu, '')
			.replace(/[^\w\s-]/g, '')
			.trim()
			.toLowerCase()
			.replace(/[-\s]+/g, '-');
		const count = this.seen.get(base);
		this.seen.set(base, (count ?? 0) + 1);
		return count === undefined ? base : `${base}_${count}`;
	}
}

export interface BuiltTree {
	title: string;
	nodes: ContentNode[];
	toc: TocEntry[];
	text: string;
}

const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed']);
const BLOCKS = new Set([
	'p',
	'li',
	'td',
	'th',
	'dd',
	'blockquote',
	'figcaption',
	'h1',
	'h2',
	'h3',
	'h4'
]);

function attributes(element: Element): Attributes {
	const out: Attributes = {};
	for (const [property, value] of Object.entries(element.properties ?? {})) {
		if (value === undefined || value === null || value === false) continue;
		const attribute = find(html, property).attribute;
		if (attribute === 'style' || attribute.startsWith('on')) continue;
		out[attribute] = Array.isArray(value) ? value.join(' ') : value === true ? true : String(value);
	}
	return out;
}

class Builder {
	slugger: { slug: (text: string) => string };
	toc: TocEntry[] = [];
	title = '';
	abbreviationPattern: RegExp | null;

	constructor(private context: TreeContext) {
		this.slugger =
			context.slugStyle === 'github' ? new GithubSlugger() : new PythonMarkdownSlugger();
		const names = [...context.abbreviations.keys()].sort((a, b) => b.length - a.length);
		this.abbreviationPattern = names.length
			? new RegExp(
					`(?<![\\w-])(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`,
					'g'
				)
			: null;
	}

	/** How many code elements enclose the current node: their text stays as written. */
	codeDepth = 0;

	/** Text, split around identifiers and abbreviations. */
	text(raw: string, linkify: boolean): ContentNode[] {
		// French typography, outside code, whose text stays as written.
		const value = this.codeDepth === 0 ? typeset(raw, this.context.lang) : raw;
		if (!linkify) return [{ type: 'text', value }];
		const out: ContentNode[] = [];
		let last = 0;
		for (const match of value.matchAll(ID_PATTERN)) {
			const id = match[0];
			const entry = this.context.ids.get(id);
			if (!entry) {
				this.context.problems.push(`unknown identifier ${id}`);
				continue;
			}
			if (match.index > last) out.push(...this.abbreviations(value.slice(last, match.index)));
			out.push({ type: 'id', id, href: entry.href, title: entry.title, summary: entry.summary });
			last = match.index + id.length;
		}
		if (last < value.length) out.push(...this.abbreviations(value.slice(last)));
		return out;
	}

	abbreviations(value: string): ContentNode[] {
		if (!this.abbreviationPattern) return [{ type: 'text', value }];
		const out: ContentNode[] = [];
		let last = 0;
		for (const match of value.matchAll(this.abbreviationPattern)) {
			if (match.index > last) out.push({ type: 'text', value: value.slice(last, match.index) });
			out.push({
				type: 'element',
				tag: 'abbr',
				attrs: { title: this.context.abbreviations.get(match[0]) ?? '' },
				children: [{ type: 'text', value: match[0] }]
			});
			last = match.index + match[0].length;
		}
		if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
		return out;
	}

	async children(
		nodes: (RootContent | ElementContent)[],
		linkify: boolean
	): Promise<ContentNode[]> {
		const out: ContentNode[] = [];
		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index];
			const mermaid = mermaidOf(node);
			if (mermaid === undefined) {
				out.push(...(await this.node(node, linkify)));
				continue;
			}
			// The caption written under a diagram is its figure's caption and,
			// unless the diagram names itself, the text of its image.
			let next = index + 1;
			while (next < nodes.length && isBlank(nodes[next])) next++;
			const caption = isCaption(nodes[next]) ? (nodes[next] as Element) : undefined;
			if (caption) index = next;
			out.push(await this.diagram(mermaid, caption, linkify));
		}
		return out;
	}

	/** A Mermaid diagram as a figure, each theme's image a link to its full size. */
	async diagram(
		code: string,
		caption: Element | undefined,
		linkify: boolean
	): Promise<ContentNode> {
		const { light, dark, width, height } = await this.context.renderDiagram(code);
		const fr = this.context.lang === 'fr';
		const named =
			/^\s*accTitle\s*:\s*(.+)$/m.exec(code)?.[1] ??
			/^---\s*\n(?:.*\n)*?\s*title\s*:\s*(.+)\n(?:.*\n)*?---/m.exec(code)?.[1];
		const alt =
			named?.trim() ||
			(caption ? toString(caption).replace(/\s+/g, ' ').trim() : '') ||
			(fr ? 'Schéma' : 'Diagram');
		const wide = width > WIDE_DIAGRAM;
		// The light render on both themes: opened alone, an SVG shows on the
		// browser's white page, where the dark render's light text is lost.
		const image = (theme: 'light' | 'dark', src: string): ContentNode => ({
			type: 'element',
			tag: 'a',
			attrs: { href: light, target: '_blank', class: `diagram-${theme} diagram-open` },
			children: [
				{
					type: 'element',
					tag: 'img',
					attrs: {
						src,
						alt: typeset(alt, this.context.lang),
						...(width ? { width, height } : {}),
						loading: 'lazy'
					}
				}
			]
		});
		const children: ContentNode[] = [image('light', light), image('dark', dark)];
		if (caption)
			children.push({
				type: 'element',
				tag: 'figcaption',
				attrs: { class: 'figure-caption' },
				children: await this.children(captionContent(caption), linkify)
			});
		if (wide)
			children.push({
				type: 'element',
				tag: 'p',
				attrs: { class: 'diagram-hint' },
				children: [
					{
						type: 'element',
						tag: 'a',
						attrs: { href: light, target: '_blank' },
						children: [
							{
								type: 'text',
								value: fr ? 'Ouvrir le schéma en taille réelle ↗' : 'Open the diagram full size ↗'
							}
						]
					}
				]
			});
		return {
			type: 'element',
			tag: 'figure',
			attrs: { class: wide ? 'diagram diagram-wide' : 'diagram' },
			children
		};
	}

	async node(node: RootContent | ElementContent, linkify: boolean): Promise<ContentNode[]> {
		if (node.type === 'text') return this.text(node.value, linkify);
		if (node.type !== 'element') return [];
		const tag = node.tagName;
		const props = node.properties ?? {};
		if (DROP_TAGS.has(tag)) return [];

		if (tag === 'pg-admonition') {
			const kind = String(props.kind ?? 'note') as 'note' | 'tip' | 'warning' | 'danger';
			const title = typeset(String(props.title ?? ''), this.context.lang) || undefined;
			const folding = String(props.collapsible ?? '');
			const collapsible = folding === 'open' || folding === 'closed' ? folding : undefined;
			return [
				{
					type: 'admonition',
					kind,
					title,
					collapsible,
					children: await this.children(node.children, linkify)
				}
			];
		}
		if (tag === 'pg-tabs') {
			const tabs = node.children.filter(
				(child): child is Element => child.type === 'element' && child.tagName === 'pg-tab'
			);
			const panels: ContentNode[][] = [];
			for (const tab of tabs) panels.push(await this.children(tab.children, linkify));
			return [
				{
					type: 'tabs',
					labels: tabs.map((tab) =>
						typeset(String(tab.properties?.label ?? ''), this.context.lang)
					),
					panels
				}
			];
		}
		if (tag === 'pg-cards') {
			const cards = node.children.filter(
				(child): child is Element => child.type === 'element' && child.tagName === 'pg-card'
			);
			const built = [];
			for (const card of cards) {
				built.push({
					title: typeset(String(card.properties?.label ?? ''), this.context.lang),
					children: await this.children(card.children, linkify)
				});
			}
			return [{ type: 'cards', cards: built }];
		}
		if (tag === 'pg-pii' || tag === 'pg-ph') {
			const value = String(props.v ?? '');
			return [
				{
					type: 'entity',
					text: value,
					hue: 0,
					title: tag === 'pg-ph' ? categoryOf(value) : undefined
				}
			];
		}
		if (tag === 'pre') {
			const code = node.children.find(
				(child): child is Element => child.type === 'element' && child.tagName === 'code'
			);
			const text = toString(code ?? node).replace(/\n$/, '');
			const classes = (code?.properties?.className as string[] | undefined) ?? [];
			const language = classes
				.find((name) => name.startsWith('language-'))
				?.slice('language-'.length);
			return [{ type: 'code', code: text, tokens: await highlight(text, language) }];
		}

		const attrs = attributes(node);
		// GFM turns every e-mail address into a mailto link, the examples too
		// (jean.dupont@exemple.fr): an address that is its own link text is text.
		if (tag === 'a' && typeof attrs.href === 'string' && attrs.href === `mailto:${toString(node)}`)
			return this.children(node.children, linkify);
		// A short inline code never breaks in the middle (piighost-api, DEV-n).
		if (tag === 'code' && toString(node).length <= 32)
			attrs.class = [attrs.class, 'nowrap'].filter(Boolean).join(' ');
		if (tag === 'a' && typeof attrs.href === 'string') {
			attrs.href = this.context.resolveLink(attrs.href);
			if (/^https?:/.test(attrs.href)) {
				attrs.target = '_blank';
				attrs.rel = 'noreferrer';
			}
		}
		if (tag === 'img' && typeof attrs.src === 'string') {
			const [src, fragment] = attrs.src.split('#');
			attrs.src = this.context.resolveAsset(src);
			if (fragment === 'only-light') attrs.class = 'diagram-light';
			if (fragment === 'only-dark') attrs.class = 'diagram-dark';
			attrs.loading = 'lazy';
		}
		if (/^h[1-4]$/.test(tag)) {
			const text = toString(node);
			const definition = this.definitionFor(text);
			const id = definition ?? this.slugger.slug(text);
			attrs.id = id;
			if (tag === 'h1' && !this.title) this.title = text;
			// The id is made from the text as written, the outline shows it typeset.
			if (tag === 'h2' || tag === 'h3')
				this.toc.push({ id, text: typeset(text, this.context.lang), depth: tag === 'h2' ? 2 : 3 });
		} else if (BLOCKS.has(tag)) {
			const definition = this.definitionFor(toString(node));
			if (definition && attrs.id === undefined) attrs.id = definition;
		}

		// Code, links and abbreviations already set are never re-read for identifiers.
		const keepLinking = linkify && tag !== 'code' && tag !== 'a' && tag !== 'abbr';
		if (tag === 'code') this.codeDepth++;
		const children = await this.children(node.children, keepLinking);
		if (tag === 'code') this.codeDepth--;
		const traced =
			tag === 'p' && typeof attrs.id === 'string' ? this.traceLink(String(attrs.id)) : undefined;
		if (traced) children.push({ type: 'text', value: ' ' }, traced);
		const element: ContentNode = { type: 'element', tag, attrs, children };
		return tag === 'table' ? [this.scroller(node, element)] : [element];
	}

	/**
	 * A table in a region that scrolls on its own, never the page. The region
	 * takes the keyboard focus, so the arrows scroll it, and is named after the
	 * table's first headers; the layout marks the side it can scroll to.
	 */
	scroller(table: Element, built: ContentNode): ContentNode {
		const headers: string[] = [];
		visitHeaders(table, headers);
		const fr = this.context.lang === 'fr';
		const named = headers.slice(0, 3).join(', ') + (headers.length > 3 ? ', …' : '');
		const label = fr
			? `Tableau${named ? ` : ${named}` : ''}, défilement horizontal`
			: `Table${named ? `: ${named}` : ''}, scrolls horizontally`;
		return {
			type: 'element',
			tag: 'div',
			attrs: { class: 'table-wrap' },
			children: [
				{
					type: 'element',
					tag: 'div',
					attrs: {
						class: 'table-scroll',
						role: 'region',
						tabindex: 0,
						'aria-label': typeset(label, this.context.lang)
					},
					children: [built]
				}
			]
		};
	}

	/** After a rule's definition, a link to what implements and tests it. */
	traceLink(anchor: string): ContentNode | undefined {
		const id = [...this.context.definitionAnchors].find(([, value]) => value === anchor)?.[0];
		const trace = id ? this.context.ids.get(id)?.trace : undefined;
		if (!id || !trace || (trace.implementations.length === 0 && trace.tests.length === 0))
			return undefined;
		const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		const fr = this.context.lang === 'fr';
		// No "0 tests": the graph sees only the tests that reach a rule through
		// its own module, so a missing count is no claim the rule is untested.
		const text = [
			fr
				? count(trace.implementations.length, 'emplacement', 'emplacements')
				: count(trace.implementations.length, 'location', 'locations'),
			...(trace.tests.length
				? [
						fr
							? count(trace.tests.length, 'test direct', 'tests directs')
							: count(trace.tests.length, 'direct test', 'direct tests')
					]
				: []),
			...(trace.indirectTests.length
				? [
						// After the direct tests, "indirect" alone says which tests.
						fr
							? trace.tests.length
								? count(trace.indirectTests.length, 'indirect', 'indirects')
								: count(trace.indirectTests.length, 'test indirect', 'tests indirects')
							: trace.tests.length
								? `${trace.indirectTests.length} indirect`
								: count(trace.indirectTests.length, 'indirect test', 'indirect tests')
					]
				: [])
		].join(' · ');
		return {
			type: 'element',
			tag: 'a',
			attrs: { href: `/${this.context.lang}/ids/${id}/`, class: 'trace-link' },
			children: [{ type: 'text', value: text }]
		};
	}

	/** The anchors already placed: an id is unique in a page. */
	placed = new Set<string>();

	/**
	 * The id a block defines, when it starts with a definition of this page and
	 * that anchor is not placed yet: the rule's paragraph comes before its row
	 * in "Où vivent les règles", which keeps no id.
	 */
	definitionFor(text: string): string | undefined {
		const lead = text.trim().match(ID_PATTERN_AT_START)?.[0];
		const anchor = lead ? this.context.definitionAnchors.get(lead) : undefined;
		if (!anchor || this.placed.has(anchor)) return undefined;
		this.placed.add(anchor);
		return anchor;
	}
}

const ID_PATTERN_AT_START = new RegExp(`^${ID_PATTERN.source}`);

/** The code of a Mermaid block, or undefined for anything else. */
function mermaidOf(node: RootContent | ElementContent): string | undefined {
	if (node.type !== 'element' || node.tagName !== 'pre') return undefined;
	const code = node.children.find(
		(child): child is Element => child.type === 'element' && child.tagName === 'code'
	);
	const classes = (code?.properties?.className as string[] | undefined) ?? [];
	return classes.includes('language-mermaid')
		? toString(code ?? node).replace(/\n$/, '')
		: undefined;
}

const isBlank = (node: RootContent | ElementContent | undefined) =>
	node?.type === 'text' && node.value.trim() === '';

/** The `{ .figure-caption }` paragraph markdown.ts makes. */
function isCaption(node: RootContent | ElementContent | undefined): boolean {
	if (node?.type !== 'element' || node.tagName !== 'p') return false;
	const classes = node.properties?.className;
	return Array.isArray(classes) && classes.includes('figure-caption');
}

/** A caption's text, without the emphasis the source writes it in. */
function captionContent(caption: Element): ElementContent[] {
	const inner = caption.children.filter((child) => !isBlank(child));
	const [only] = inner;
	return inner.length === 1 && only.type === 'element' && only.tagName === 'em'
		? only.children
		: caption.children;
}

/** The text of a table's header cells, in order. */
function visitHeaders(node: Element, out: string[]) {
	for (const child of node.children) {
		if (child.type !== 'element') continue;
		if (child.tagName === 'th') out.push(toString(child).replace(/\s+/g, ' ').trim());
		else if (child.tagName !== 'tbody') visitHeaders(child, out);
	}
}

/** Give every entity chip its hue: placeholders by category, values from the nearest placeholder. */
function colourEntities(nodes: ContentNode[]) {
	const categories: string[] = [];
	const blocks: { entity: Extract<ContentNode, { type: 'entity' }>; category?: string }[][] = [];

	const walk = (
		list: ContentNode[],
		block: { entity: Extract<ContentNode, { type: 'entity' }>; category?: string }[]
	) => {
		for (const node of list) {
			if (node.type === 'entity') {
				const category = node.title;
				if (category) categories.push(category);
				block.push({ entity: node, category });
			} else if (node.type === 'element' && node.children) {
				if (BLOCKS.has(node.tag)) {
					const inner: typeof block = [];
					blocks.push(inner);
					walk(node.children, inner);
				} else walk(node.children, block);
			} else if (node.type === 'admonition') walk(node.children, block);
			else if (node.type === 'tabs') node.panels.forEach((panel) => walk(panel, block));
			else if (node.type === 'cards') node.cards.forEach((card) => walk(card.children, block));
		}
	};
	const top: (typeof blocks)[number] = [];
	blocks.push(top);
	walk(nodes, top);

	const hues = assignHues([...categories, 'VALUE']);
	for (const block of blocks) {
		block.forEach((item, index) => {
			let category = item.category;
			if (!category) {
				const after = block.slice(index + 1).find((other) => other.category);
				const before = block
					.slice(0, index)
					.reverse()
					.find((other) => other.category);
				category = after?.category ?? before?.category ?? 'VALUE';
			}
			item.entity.hue = hues.get(category) ?? 1;
		});
	}
}

/** Build the page tree. */
export async function buildTree(root: Root, context: TreeContext): Promise<BuiltTree> {
	const builder = new Builder(context);
	const nodes = await builder.children(root.children, true);
	colourEntities(nodes);
	return { title: builder.title, nodes, toc: builder.toc, text: toString(root) };
}
