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
	/** Render a Mermaid diagram, returning the URLs of its two themes. */
	renderDiagram: (code: string) => Promise<{ light: string; dark: string }>;
	ids: IdIndex;
	abbreviations: Map<string, string>;
	/** The id this page defines with each block, read by its first words. */
	definitionAnchors: Map<string, string>;
	/** How headings become ids: the rule the page's links were written for. */
	slugStyle: 'python-markdown' | 'github';
	problems: string[];
}

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

	/** Text, split around identifiers and abbreviations. */
	text(value: string, linkify: boolean): ContentNode[] {
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
		for (const node of nodes) out.push(...(await this.node(node, linkify)));
		return out;
	}

	async node(node: RootContent | ElementContent, linkify: boolean): Promise<ContentNode[]> {
		if (node.type === 'text') return this.text(node.value, linkify);
		if (node.type !== 'element') return [];
		const tag = node.tagName;
		const props = node.properties ?? {};
		if (DROP_TAGS.has(tag)) return [];

		if (tag === 'pg-admonition') {
			const kind = String(props.kind ?? 'note') as 'note' | 'tip' | 'warning' | 'danger';
			const title = String(props.title ?? '') || undefined;
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
				{ type: 'tabs', labels: tabs.map((tab) => String(tab.properties?.label ?? '')), panels }
			];
		}
		if (tag === 'pg-cards') {
			const cards = node.children.filter(
				(child): child is Element => child.type === 'element' && child.tagName === 'pg-card'
			);
			const built = [];
			for (const card of cards) {
				built.push({
					title: String(card.properties?.label ?? ''),
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
			if (language === 'mermaid') {
				const { light, dark } = await this.context.renderDiagram(text);
				return [{ type: 'diagram', light, dark, alt: 'Diagram' }];
			}
			return [{ type: 'code', code: text, tokens: await highlight(text, language) }];
		}

		const attrs = attributes(node);
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
			if (tag === 'h2' || tag === 'h3') this.toc.push({ id, text, depth: tag === 'h2' ? 2 : 3 });
		} else if (BLOCKS.has(tag)) {
			const definition = this.definitionFor(toString(node));
			if (definition && attrs.id === undefined) attrs.id = definition;
		}
		if (tag === 'table') attrs.class = [attrs.class, 'table-scroll'].filter(Boolean).join(' ');

		// Code, links and abbreviations already set are never re-read for identifiers.
		const keepLinking = linkify && tag !== 'code' && tag !== 'a' && tag !== 'abbr';
		const children = await this.children(node.children, keepLinking);
		return [{ type: 'element', tag, attrs, children }];
	}

	/** The id a block defines, when it starts with a definition of this page. */
	definitionFor(text: string): string | undefined {
		const lead = text.trim().match(ID_PATTERN_AT_START)?.[0];
		return lead ? this.context.definitionAnchors.get(lead) : undefined;
	}
}

const ID_PATTERN_AT_START = new RegExp(`^${ID_PATTERN.source}`);

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
