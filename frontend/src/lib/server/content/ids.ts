/**
 * The identifiers of the wiki and where each one is defined.
 *
 * Identifiers are in English and the same in every language (openwiki
 * INSTRUCTIONS.md, "Identifiants"): needs DPO-n, DEV-n, OPS-n, USER-n; rules
 * BR-<DOMAIN>-NN; acceptance tests AT-<need>-<n>; gaps ECART-NN. Each is defined
 * once, by the way its page writes it, and linked everywhere else.
 */
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import type { Root, Paragraph, TableRow, Heading } from 'mdast';

export const ID_PATTERN =
	/\b(?:(?:DPO|DEV|OPS|USER)-\d+|BR-[A-Z]+-\d{2}|AT-(?:DPO|DEV|OPS|USER)-\d+-\d+|ECART-\d{2})\b/g;

export interface IdEntry {
	id: string;
	href: string;
	title: string;
	summary: string;
	/** The page that defines it, as a route. */
	page: string;
}

export type IdIndex = Map<string, IdEntry>;

const NEED = /^((?:DPO|DEV|OPS|USER)-\d+)\.\s+(.+)$/s;
const RULE = /^(BR-[A-Z]+-\d{2})\.\s+(.+)$/s;
const GAP = /^(ECART-\d{2})\s*:\s*(.+)$/;
const TEST = /^AT-(?:DPO|DEV|OPS|USER)-\d+-\d+$/;

/** The first sentence, enough for a hover card. */
function firstSentence(text: string): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	const end = clean.search(/[.!?](\s|$)/);
	return end > 0 ? clean.slice(0, end + 1) : clean;
}

/** The anchor every definition gets on its page. */
export const anchorOf = (id: string) => id.toLowerCase();

/** Collect the definitions one page holds. */
export function collectDefinitions(tree: Root, page: string, title: string): IdEntry[] {
	const found: IdEntry[] = [];
	const add = (id: string, summary: string) =>
		found.push({
			id,
			href: `${page}#${anchorOf(id)}`,
			title,
			summary: firstSentence(summary),
			page
		});

	// Only a top-level paragraph defines: the same words at the head of a list
	// item, in a to-do list for example, cite the identifier.
	visit(tree, 'paragraph', (node: Paragraph, _index, parent) => {
		if (parent?.type !== 'root') return;
		const text = toString(node).trim();
		// No value is returned: unist-util-visit reads a returned number as the
		// index to resume at, and would visit the same nodes again.
		const need = NEED.exec(text);
		const rule = need ? null : RULE.exec(text);
		if (need) add(need[1], need[2]);
		else if (rule) add(rule[1], rule[2]);
	});
	visit(tree, 'heading', (node: Heading) => {
		const gap = GAP.exec(toString(node).trim());
		if (gap) add(gap[1], gap[2]);
	});
	visit(tree, 'tableRow', (node: TableRow) => {
		const cells = node.children.map((cell) => toString(cell).trim());
		if (TEST.test(cells[0] ?? '')) add(cells[0], cells[2] ?? '');
	});
	return found;
}
