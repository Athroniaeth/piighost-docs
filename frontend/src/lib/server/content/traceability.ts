/**
 * From a rule to the code that implements it and the tests that exercise it.
 *
 * Each process page of the wiki lists, in "Où vivent les règles", the files and
 * lines that hold a rule: `BR-MSG-05 | components/overlap_resolver/merge.py:7-15`.
 * The code graph graphify builds (scripts/graph.sh) knows every function and
 * class with its line, and every call between them. Joining the two gives, for
 * a rule, the functions at those lines, the tests that call them, and the code
 * that relies on them: what the rule is "used by".
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import type { Root, Table, InlineCode } from 'mdast';
import { REPOSITORY, BRANCH } from './config';

export interface CodeRef {
	label: string;
	file: string;
	line: number;
	href: string;
}

export interface Trace {
	/** The functions and classes at the lines the wiki gives. */
	implementations: CodeRef[];
	/** The tests that call them, as pytest node ids. */
	tests: CodeRef[];
	/** Other code that calls them. */
	callers: CodeRef[];
}

interface GraphNode {
	id: string;
	label: string;
	source_file?: string;
	source_location?: string;
	file_type?: string;
}

interface GraphEdge {
	source: string;
	target: string;
	relation: string;
}

/** Where scripts/graph.sh writes the graph. */
const GRAPH_PATH = resolve(process.env.PIIGHOST_GRAPH ?? '.graph/graph.json');

const CALL_RELATIONS = new Set(['calls', 'indirect_call', 'uses', 'references']);
const RULE = /BR-[A-Z]+-\d{2}/g;
/** `BR-TOOL-01 à BR-TOOL-04`: every rule of the range. */
const RANGE = /(BR-[A-Z]+-)(\d{2})\s+à\s+BR-[A-Z]+-(\d{2})/g;
const PATH = /^([\w./-]+\.py)(?::(\d+)(?:-(\d+))?)?$/;
/** `_neutralize lignes 79-95`, after a path: lines of the path before. */
const LINES_AFTER = /lignes?\s+(\d+)(?:-(\d+))?/g;

const lineOf = (node: GraphNode) => Number(node.source_location?.replace(/^L/, '') ?? 0);
const github = (file: string, line: number) => `${REPOSITORY}/blob/${BRANCH}/${file}${line ? `#L${line}` : ''}`;
const strip = (label: string) => label.replace(/^\./, '');

/** The rules a cell names, ranges expanded. */
function rulesIn(text: string): string[] {
	const found = new Set<string>();
	for (const [, prefix, from, to] of text.matchAll(RANGE)) {
		for (let n = Number(from); n <= Number(to); n++) found.add(`${prefix}${String(n).padStart(2, '0')}`);
	}
	for (const [rule] of text.matchAll(RULE)) found.add(rule);
	return [...found];
}

class Graph {
	nodes = new Map<string, GraphNode>();
	incoming = new Map<string, GraphEdge[]>();
	classOfMethod = new Map<string, GraphNode>();
	byFile = new Map<string, GraphNode[]>();
	files: string[] = [];

	constructor(data: { nodes: GraphNode[]; links: GraphEdge[] }) {
		for (const node of data.nodes) {
			this.nodes.set(node.id, node);
			if (node.file_type !== 'code' || !node.source_file) continue;
			const list = this.byFile.get(node.source_file) ?? [];
			list.push(node);
			this.byFile.set(node.source_file, list);
		}
		for (const list of this.byFile.values()) list.sort((a, b) => lineOf(a) - lineOf(b));
		this.files = [...this.byFile.keys()];
		for (const edge of data.links) {
			const list = this.incoming.get(edge.target) ?? [];
			list.push(edge);
			this.incoming.set(edge.target, list);
			if (edge.relation === 'method') {
				const owner = this.nodes.get(edge.source);
				if (owner) this.classOfMethod.set(edge.target, owner);
			}
		}
	}

	/**
	 * A path as the wiki writes it, `merge.py` or `components/x.py`, to the
	 * graph's file. An ambiguous name (there are several `detector.py`) takes the
	 * folder of the path before it in the cell, then any folder the same table
	 * names unambiguously.
	 */
	file(path: string, near: string[] = []): string | undefined {
		const clean = path.replace(/^\.?\//, '');
		const matches = this.files.filter((file) => file === clean || file.endsWith(`/${clean}`));
		if (matches.length <= 1) return matches[0];
		for (const hint of near) {
			const folder = hint.slice(0, hint.lastIndexOf('/') + 1);
			const found = matches.find((file) => file.startsWith(folder));
			if (found) return found;
		}
		return undefined;
	}

	/** The innermost function or class that starts at or before a line. */
	at(file: string, line: number): GraphNode | undefined {
		const candidates = (this.byFile.get(file) ?? []).filter(
			(node) => lineOf(node) > 1 && lineOf(node) <= line && !node.label.endsWith('.py')
		);
		return candidates.at(-1);
	}

	ref(node: GraphNode): CodeRef {
		const owner = this.classOfMethod.get(node.id);
		const label = owner ? `${owner.label}.${strip(node.label)}` : strip(node.label);
		return { label, file: node.source_file ?? '', line: lineOf(node), href: github(node.source_file ?? '', lineOf(node)) };
	}

	/** A test node as its pytest id: tests/x.py::TestClass::test_name. */
	testRef(node: GraphNode): CodeRef {
		const owner = this.classOfMethod.get(node.id);
		const name = strip(node.label).replace(/\(\)$/, '');
		const id = [node.source_file, owner?.label, name].filter(Boolean).join('::');
		return { label: id, file: node.source_file ?? '', line: lineOf(node), href: github(node.source_file ?? '', lineOf(node)) };
	}

	/** Who calls a node, the test methods apart. */
	users(node: GraphNode): { tests: GraphNode[]; callers: GraphNode[] } {
		const tests: GraphNode[] = [];
		const callers: GraphNode[] = [];
		const targets = [node];
		// A test exercises a method through its class as often as directly.
		const owner = this.classOfMethod.get(node.id);
		if (owner) targets.push(owner);
		for (const target of targets) {
			for (const edge of this.incoming.get(target.id) ?? []) {
				if (!CALL_RELATIONS.has(edge.relation)) continue;
				const source = this.nodes.get(edge.source);
				if (!source?.source_file) continue;
				if (source.source_file.startsWith('tests/')) {
					if (/^\.?test_/.test(source.label)) tests.push(source);
				} else if (source.id !== node.id) callers.push(source);
			}
		}
		return { tests, callers };
	}
}

function loadGraph(): Graph | undefined {
	if (!existsSync(GRAPH_PATH)) return undefined;
	return new Graph(JSON.parse(readFileSync(GRAPH_PATH, 'utf8')));
}

/** The code references a rules table gives for each rule, as (file, line) pairs. */
function referencesOf(tree: Root, graph: Graph): Map<string, { file: string; line: number }[]> {
	const out = new Map<string, { file: string; line: number }[]>();
	visit(tree, 'table', (table: Table) => {
		// The folders the table names without ambiguity, to place a bare `base.py`.
		const context: string[] = [];
		visit(table, 'inlineCode', (code: InlineCode) => {
			const match = PATH.exec(code.value);
			const file = match ? graph.file(match[1]) : undefined;
			if (file) context.push(file);
		});
		for (const row of table.children.slice(1)) {
			const [first, second] = row.children;
			if (!first || !second) continue;
			const rules = rulesIn(toString(first));
			if (rules.length === 0) continue;
			const refs: { file: string; line: number }[] = [];
			let last: string | undefined;
			for (const child of second.children) {
				if (child.type === 'inlineCode') {
					const match = PATH.exec((child as InlineCode).value);
					if (!match) continue;
					const file = graph.file(match[1], last ? [last, ...context] : context);
					if (!file) continue;
					last = file;
					refs.push({ file, line: match[2] ? Number(match[2]) : 0 });
				} else if (child.type === 'text' && last) {
					for (const [, from] of child.value.matchAll(LINES_AFTER)) refs.push({ file: last, line: Number(from) });
				}
			}
			for (const rule of rules) out.set(rule, [...(out.get(rule) ?? []), ...refs]);
		}
	});
	return out;
}

const unique = (refs: CodeRef[]) => [...new Map(refs.map((ref) => [ref.label, ref])).values()];

/** The trace of every rule the wiki locates, or an empty map without a graph. */
export function traceRules(trees: Root[]): Map<string, Trace> {
	const graph = loadGraph();
	const traces = new Map<string, Trace>();
	if (!graph) return traces;
	for (const tree of trees) {
		for (const [rule, refs] of referencesOf(tree, graph)) {
			const placed = refs.map((ref) => ({ ref, node: ref.line ? graph.at(ref.file, ref.line) : undefined }));
			const nodes = placed.map((item) => item.node).filter((node): node is GraphNode => !!node);
			// A line no function starts before, a module constant: the line itself.
			const bare = placed
				.filter((item) => item.ref.line && !item.node)
				.map(({ ref }) => ({ label: `${ref.file.split('/').pop()}:${ref.line}`, file: ref.file, line: ref.line, href: github(ref.file, ref.line) }));
			const implementations = unique([...nodes.map((node) => graph.ref(node)), ...bare]);
			const tests: CodeRef[] = [];
			const callers: CodeRef[] = [];
			for (const node of nodes) {
				const users = graph.users(node);
				tests.push(...users.tests.map((test) => graph.testRef(test)));
				callers.push(...users.callers.map((caller) => graph.ref(caller)));
			}
			const files = refs.filter((ref) => !ref.line).map((ref) => ({ label: ref.file, file: ref.file, line: 0, href: github(ref.file, 0) }));
			traces.set(rule, {
				implementations: unique([...implementations, ...files]),
				tests: unique(tests).sort((a, b) => a.label.localeCompare(b.label)),
				callers: unique(callers).filter((caller) => !implementations.some((impl) => impl.label === caller.label))
			});
		}
	}
	return traces;
}
