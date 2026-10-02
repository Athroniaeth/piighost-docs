/**
 * Markdown to hast, with the directives of preprocess.ts turned into the
 * `pg-*` elements that tree.ts reads.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import { parse as parseYaml } from 'yaml';
import type { Root as MdastRoot, Paragraph, Blockquote, Text } from 'mdast';
import type { Root as HastRoot } from 'hast';
import type { ContainerDirective, TextDirective, LeafDirective } from 'mdast-util-directive';

const ADMONITIONS: Record<string, 'note' | 'tip' | 'warning' | 'danger'> = {
	note: 'note',
	info: 'note',
	abstract: 'note',
	example: 'note',
	question: 'note',
	quote: 'note',
	tip: 'tip',
	success: 'tip',
	warning: 'warning',
	caution: 'warning',
	important: 'warning',
	danger: 'danger',
	failure: 'danger',
	bug: 'danger'
};

const CONTAINERS = new Set([
	'tabs',
	'tab',
	'cards',
	'card',
	'caption',
	...Object.keys(ADMONITIONS)
]);
const TEXTS = new Set(['pii', 'ph']);

/** GitHub alerts, `> [!WARNING]`, as the openwiki pages write their callouts. */
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

/** The label paragraph of a container directive, `:::note[Title]`, removed and returned. */
function takeLabel(node: ContainerDirective): string | undefined {
	const first = node.children[0];
	if (
		first &&
		first.type === 'paragraph' &&
		(first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel
	) {
		node.children.shift();
		return toString(first);
	}
	return undefined;
}

function directives(source: string) {
	return (tree: MdastRoot) => {
		visit(tree, (node, index, parent) => {
			if (node.type === 'containerDirective') {
				const directive = node as ContainerDirective;
				if (!CONTAINERS.has(directive.name)) return;
				const label = takeLabel(directive);
				const data = (directive.data ??= {});
				const kind = ADMONITIONS[directive.name];
				if (kind) {
					data.hName = 'pg-admonition';
					data.hProperties = {
						kind,
						title: label ?? '',
						collapsible: directive.attributes?.collapsible ?? ''
					};
				} else if (directive.name === 'caption') {
					data.hName = 'p';
					data.hProperties = { className: ['figure-caption'] };
				} else {
					data.hName = `pg-${directive.name}`;
					data.hProperties = { label: label ?? '' };
				}
				return;
			}
			if (node.type === 'textDirective' || node.type === 'leafDirective') {
				const directive = node as TextDirective | LeafDirective;
				if (node.type === 'textDirective' && TEXTS.has(directive.name)) {
					const data = (directive.data ??= {});
					data.hName = `pg-${directive.name}`;
					data.hProperties = { v: directive.attributes?.v ?? '' };
					directive.children = [];
					return;
				}
				// Not ours: `hub:piighost/generic` read as a directive. Put the source back.
				if (
					parent &&
					index !== undefined &&
					node.position?.start.offset !== undefined &&
					node.position.end.offset !== undefined
				) {
					const text: Text = {
						type: 'text',
						value: source.slice(node.position.start.offset, node.position.end.offset)
					};
					parent.children.splice(index, 1, text as never);
					return [SKIP, index];
				}
			}
		});

		// `> [!WARNING]` blockquotes become admonitions too.
		visit(tree, 'blockquote', (node: Blockquote) => {
			const first = node.children[0] as Paragraph | undefined;
			const lead = first?.type === 'paragraph' ? first.children[0] : undefined;
			if (!lead || lead.type !== 'text') return;
			const match = ALERT.exec(lead.value);
			if (!match) return;
			lead.value = lead.value.slice(match[0].length);
			const kind = ADMONITIONS[match[1].toLowerCase()] ?? 'note';
			const data = (node.data ??= {});
			data.hName = 'pg-admonition';
			data.hProperties = { kind, title: '' };
		});
	};
}

export interface ParsedMarkdown {
	hast: HastRoot;
	frontmatter: Record<string, unknown>;
	mdast: MdastRoot;
}

/** Parse a preprocessed page into hast, keeping its mdast for definitions. */
export async function parseMarkdown(markdown: string): Promise<ParsedMarkdown> {
	const processor = unified()
		.use(remarkParse)
		.use(remarkFrontmatter, ['yaml'])
		.use(remarkGfm)
		.use(remarkDirective)
		.use(directives, markdown)
		// The docs carry real HTML (security tables, wide-table wrappers): parse it
		// rather than drop it. tree.ts strips every style and on* attribute after.
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw);
	const mdast = processor.parse(markdown) as MdastRoot;
	const transformed = (await processor.run(structuredClone(mdast))) as HastRoot;

	let frontmatter: Record<string, unknown> = {};
	const yaml = mdast.children.find((node) => node.type === 'yaml');
	if (yaml && 'value' in yaml) {
		try {
			frontmatter = (parseYaml(String(yaml.value)) as Record<string, unknown>) ?? {};
		} catch {
			frontmatter = {};
		}
	}
	return { hast: transformed, frontmatter, mdast };
}
