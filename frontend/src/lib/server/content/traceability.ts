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
import { join } from 'node:path';
import { CONTENT_ROOT, REPOSITORY, BRANCH } from './config';

export interface CodeRef {
	label: string;
	file: string;
	line: number;
	href: string;
}

export interface Trace {
	/** The functions and classes at the lines the wiki gives. */
	implementations: CodeRef[];
	/** The tests that call them, or their class, themselves or through a test helper, as pytest node ids. */
	tests: CodeRef[];
	/**
	 * The tests that reach them through the code of their own module: a private
	 * function the public method calls, which the test calls.
	 */
	indirectTests: CodeRef[];
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
/** `_thread_id`, `flush`, `InMemoryConfig`: a name the cell gives beside its path. */
const NAME = /^[A-Za-z_]\w*$/;
/** A module constant's definition, `MAX_TOKEN_LENGTH = 128`, `_TOOL_FIELDS: dict = {`. */
const CONSTANT = /^(_?[A-Z][A-Z0-9_]*)\s*[:=]/;
/** How many calls inside its own module a test may go through to reach a rule. */
const MODULE_HOPS = 3;
/** `_neutralize lignes 79-95`, after a path: lines of the path before. */
const LINES_AFTER = /lignes?\s+(\d+)(?:-(\d+))?/g;

const lineOf = (node: GraphNode) => Number(node.source_location?.replace(/^L/, '') ?? 0);
const github = (file: string, line: number) =>
	`${REPOSITORY}/blob/${BRANCH}/${file}${line ? `#L${line}` : ''}`;
const strip = (label: string) => label.replace(/^\./, '');

/** The rules a cell names, ranges expanded. */
function rulesIn(text: string): string[] {
	const found = new Set<string>();
	for (const [, prefix, from, to] of text.matchAll(RANGE)) {
		for (let n = Number(from); n <= Number(to); n++)
			found.add(`${prefix}${String(n).padStart(2, '0')}`);
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
	/** The classes that extend each class, read from the source: graphify loses `Base[T]`. */
	subclasses = new Map<string, GraphNode[]>();

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
		this.readSubclasses();
	}

	/**
	 * `class AnonymizationPipeline(BaseAnonymizationPipeline[T])`: graphify keeps
	 * no edge for a generic base, so a test that builds the subclass would not
	 * reach the base's methods. The declarations are read from the source.
	 */
	readSubclasses() {
		const classes = new Map<string, GraphNode[]>();
		for (const list of this.byFile.values())
			for (const node of list)
				if (/^[A-Z]\w*$/.test(node.label))
					classes.set(node.label, [...(classes.get(node.label) ?? []), node]);
		for (const [file, list] of this.byFile) {
			if (!file.startsWith('src/')) continue;
			const path = join(CONTENT_ROOT, file);
			if (!existsSync(path)) continue;
			const source = readFileSync(path, 'utf8');
			for (const [, name, bases] of source.matchAll(/^class (\w+)\(([^)]*)\)/gm)) {
				const child = list.find((node) => node.label === name);
				if (!child) continue;
				for (const base of bases.split(',')) {
					const bare = base.replace(/\[.*$/s, '').trim().split('.').pop() ?? '';
					const parents = classes.get(bare) ?? [];
					const parent = parents.find((node) => node.source_file === file) ?? parents[0];
					if (parent && parent !== child)
						this.subclasses.set(parent.id, [...(this.subclasses.get(parent.id) ?? []), child]);
				}
			}
		}
	}

	/** A class and every class that extends it, at any depth. */
	family(node: GraphNode): GraphNode[] {
		const out = [node];
		for (let index = 0; index < out.length; index++)
			for (const child of this.subclasses.get(out[index].id) ?? [])
				if (!out.includes(child)) out.push(child);
		return out;
	}

	/** The classes and functions a module defines at its top level. */
	topLevel(file: string): GraphNode[] {
		return (this.byFile.get(file) ?? []).filter(
			(node) => lineOf(node) > 1 && !this.classOfMethod.has(node.id) && !node.label.endsWith('.py')
		);
	}

	/** The functions and classes of a file named `name`, a method by its bare name. */
	named(file: string, name: string): GraphNode[] {
		return (this.byFile.get(file) ?? []).filter(
			(node) => strip(node.label).replace(/\(\)$/, '') === name
		);
	}

	/**
	 * The functions and classes a range of lines holds. The wiki's lines drift
	 * as the code moves: `base.py:313-341` names `_guard`, which starts at 333.
	 * The definitions that start in the range are the rule's; the one that
	 * encloses its first line only when none starts near it.
	 */
	within(file: string, start: number, end: number): GraphNode[] {
		const inside = (this.byFile.get(file) ?? []).filter(
			(node) => lineOf(node) >= start && lineOf(node) <= end && !node.label.endsWith('.py')
		);
		// A module constant belongs to no function, whatever comes before it.
		const first = this.linesOf(file)[start - 1] ?? '';
		const enclosing = CONSTANT.test(first) ? undefined : this.at(file, start);
		const near = inside.some((node) => lineOf(node) - start <= 3);
		return enclosing && !near && !inside.includes(enclosing) ? [enclosing, ...inside] : inside;
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
		return {
			label,
			file: node.source_file ?? '',
			line: lineOf(node),
			href: github(node.source_file ?? '', lineOf(node))
		};
	}

	/**
	 * The functions of a file that read the module constants written between
	 * two lines. A rule held by a constant, `DEFAULT_TTL = 86_400.0`, has no
	 * function of its own: what reads the constant carries it, and its tests
	 * are the rule's.
	 */
	readersOf(file: string, start: number, end: number): GraphNode[] {
		const path = join(CONTENT_ROOT, file);
		if (!existsSync(path)) return [];
		const lines = readFileSync(path, 'utf8').split('\n');
		const names = lines
			.slice(start - 1, end)
			.map((line) => CONSTANT.exec(line)?.[1])
			.filter((name): name is string => !!name);
		if (names.length === 0) return [];
		const uses = new RegExp(`\\b(?:${names.join('|')})\\b`);
		const nodes = (this.byFile.get(file) ?? []).filter(
			(node) => lineOf(node) > 1 && !node.label.endsWith('.py')
		);
		return nodes.filter((node, index) => {
			const from = lineOf(node);
			const to = index + 1 < nodes.length ? lineOf(nodes[index + 1]) - 1 : lines.length;
			return uses.test(lines.slice(from - 1, to).join('\n'));
		});
	}

	/** A test node as its pytest id: tests/x.py::TestClass::test_name. */
	testRef(node: GraphNode): CodeRef {
		const owner = this.classOfMethod.get(node.id);
		const name = strip(node.label).replace(/\(\)$/, '');
		const id = [node.source_file, owner?.label, name].filter(Boolean).join('::');
		return {
			label: id,
			file: node.source_file ?? '',
			line: lineOf(node),
			href: github(node.source_file ?? '', lineOf(node))
		};
	}

	/** A file of the checkout, as lines, read once. */
	linesOf(file: string): string[] {
		let lines = this.sources.get(file);
		if (!lines) {
			const path = join(CONTENT_ROOT, file);
			lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
			this.sources.set(file, lines);
		}
		return lines;
	}

	/** The line a module constant is defined on, 0 when the file does not define it. */
	constantLine(file: string, name: string): number {
		return this.linesOf(file).findIndex((line) => CONSTANT.exec(line)?.[1] === name) + 1;
	}

	/**
	 * The tests that read a module constant by name, `WORD_JOIN_CHARS`, in a
	 * test file that imports its module: graphify keeps no node for a constant.
	 */
	testsNaming(file: string, names: string[]): GraphNode[] {
		if (names.length === 0) return [];
		const module = file
			.replace(/^src\//, '')
			.replace(/(\/__init__)?\.py$/, '')
			.replaceAll('/', '.');
		const uses = new RegExp(`\\b(?:${names.join('|')})\\b`);
		const out: GraphNode[] = [];
		for (const [path, nodes] of this.byFile) {
			if (!path.startsWith('tests/') || !this.linesOf(path).join('\n').includes(module)) continue;
			for (const node of nodes)
				if (/^\.?test_/.test(node.label) && uses.test(this.bodyOf(node))) out.push(node);
		}
		return out;
	}

	/**
	 * The tests that call a module function by its name, `module._thread_id()`,
	 * in a test file that names its module: graphify does not follow a call
	 * through `importlib`, nor through an alias. A helper of the test file that
	 * calls it brings the tests that call the helper.
	 */
	testsCallingByName(node: GraphNode): GraphNode[] {
		if (this.classOfMethod.has(node.id) || !node.source_file) return [];
		const name = strip(node.label).replace(/\(\)$/, '');
		if (!/^\w+$/.test(name)) return [];
		const module = node.source_file
			.replace(/^src\//, '')
			.replace(/(\/__init__)?\.py$/, '')
			.replaceAll('/', '.');
		const call = new RegExp(`(?<![\\w.])(?:\\w+\\.)?${name}\\(`);
		const out = new Set<GraphNode>();
		for (const [path, nodes] of this.byFile) {
			if (!path.startsWith('tests/') || !this.linesOf(path).join('\n').includes(module)) continue;
			for (const test of nodes) {
				const body = this.bodyOf(test).replace(
					new RegExp(`^\\s*(?:async\\s+)?def\\s+${name}\\(`),
					''
				);
				if (!call.test(body)) continue;
				if (/^\.?test_/.test(test.label)) out.add(test);
				else
					for (const edge of this.incoming.get(test.id) ?? []) {
						const caller = this.nodes.get(edge.source);
						if (CALL_RELATIONS.has(edge.relation) && caller && /^\.?test_/.test(caller.label))
							out.add(caller);
					}
			}
		}
		return [...out];
	}

	/** The source lines of a definition, up to the next definition of its file. */
	bodyOf(node: GraphNode): string {
		const file = node.source_file ?? '';
		const lines = this.linesOf(file);
		const from = lineOf(node);
		const next = (this.byFile.get(file) ?? []).find((other) => lineOf(other) > from);
		return lines.slice(from - 1, next ? lineOf(next) - 1 : lines.length).join('\n');
	}
	sources = new Map<string, string[]>();

	/**
	 * Who calls a node. A test calls it directly when it, or a helper of its
	 * test file (`_stream`, `_pipeline`), calls it by name: graphify does not
	 * resolve `decoder.flush()` on an instance, so a test that builds the class
	 * and writes `.flush(` in its body calls it too. A test that only builds
	 * the class, or one that reaches the function through other functions of
	 * its module (the public method that calls a private helper), exercises
	 * it indirectly. Code elsewhere that calls it is a caller.
	 */
	users(start: GraphNode): { tests: GraphNode[]; indirect: GraphNode[]; callers: GraphNode[] } {
		const tests = new Set<GraphNode>();
		const indirect = new Set<GraphNode>();
		const callers = new Set<GraphNode>();
		const seen = new Set<string>();
		type Step = { node: GraphNode; direct: boolean; hops: number };
		const queue: Step[] = [{ node: start, direct: true, hops: 0 }];
		while (queue.length) {
			const { node, direct, hops } = queue.shift()!;
			const key = `${node.id}:${direct}`;
			if (seen.has(key) || (!direct && seen.has(`${node.id}:true`))) continue;
			seen.add(key);
			const name = strip(node.label).replace(/\(\)$/, '');
			const owner = this.classOfMethod.get(node.id);
			const byName = new RegExp(`\\.${name.replace(/\W/g, '')}\\(`);
			// A method is reached through its class and the classes that extend
			// it; a class through the classes that extend it.
			const targets = [
				{ target: node, own: true },
				...(owner ? this.family(owner) : this.family(node).slice(1)).map((target) => ({
					target,
					own: false
				}))
			];
			for (const { target, own } of targets) {
				for (const edge of this.incoming.get(target.id) ?? []) {
					const source = this.nodes.get(edge.source);
					// A nested function runs when the function that holds it does.
					if (edge.relation === 'contains' && source?.label.endsWith('()') && hops < MODULE_HOPS)
						queue.push({ node: source, direct: false, hops: hops + 1 });
					if (!CALL_RELATIONS.has(edge.relation)) continue;
					if (!source?.source_file || source.id === start.id) continue;
					if (source.source_file.startsWith('tests/')) {
						const calls = own || name === '__init__' || !owner || byName.test(this.bodyOf(source));
						const reach = direct && calls;
						// A helper of the test file is part of the tests that call it.
						if (/^\.?test_/.test(source.label)) (reach ? tests : indirect).add(source);
						else queue.push({ node: source, direct: reach, hops });
					} else if (source.source_file === start.source_file) {
						if (hops === 0 && own) callers.add(source);
						if (hops < MODULE_HOPS) queue.push({ node: source, direct: false, hops: hops + 1 });
					} else if (hops === 0 && own) callers.add(source);
				}
			}
		}
		for (const test of tests) indirect.delete(test);
		return { tests: [...tests], indirect: [...indirect], callers: [...callers] };
	}
}

function loadGraph(): Graph | undefined {
	if (!existsSync(GRAPH_PATH)) return undefined;
	return new Graph(JSON.parse(readFileSync(GRAPH_PATH, 'utf8')));
}

/** The code references a rules table gives for each rule, as (file, line) pairs. */
interface Reference {
	file: string;
	line: number;
	/** The last line of a range, `memory.py:13-25`, the line itself otherwise. */
	end: number;
	/** A definition the cell names, `(\`_thread_id\`)`, in the file before it. */
	name?: string;
}

function referencesOf(tree: Root, graph: Graph): Map<string, Reference[]> {
	const out = new Map<string, Reference[]>();
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
			const refs: Reference[] = [];
			let last: string | undefined;
			for (const child of second.children) {
				if (child.type === 'inlineCode') {
					const value = (child as InlineCode).value;
					if (last && NAME.test(value)) {
						const line = graph.constantLine(last, value);
						refs.push(
							line ? { file: last, line, end: line } : { file: last, line: 0, end: 0, name: value }
						);
						continue;
					}
					const match = PATH.exec(value);
					if (!match) continue;
					const file = graph.file(match[1], last ? [last, ...context] : context);
					if (!file) continue;
					last = file;
					const line = match[2] ? Number(match[2]) : 0;
					refs.push({ file, line, end: match[3] ? Number(match[3]) : line });
				} else if (child.type === 'text' && last) {
					for (const [, from, to] of child.value.matchAll(LINES_AFTER))
						refs.push({ file: last, line: Number(from), end: Number(to ?? from) });
				}
			}
			for (const rule of rules) out.set(rule, [...(out.get(rule) ?? []), ...refs]);
		}
	});
	return out;
}

const unique = (refs: CodeRef[]) => [...new Map(refs.map((ref) => [ref.label, ref])).values()];
const unique_nodes = (nodes: GraphNode[]) => [
	...new Map(nodes.map((node) => [node.id, node])).values()
];

/** The trace of every rule the wiki locates, or an empty map without a graph. */
export function traceRules(trees: Root[]): Map<string, Trace> {
	const graph = loadGraph();
	const traces = new Map<string, Trace>();
	if (!graph) return traces;
	for (const tree of trees) {
		for (const [rule, all] of referencesOf(tree, graph)) {
			const named = all.filter((ref) => ref.name);
			const refs = all.filter((ref) => !ref.name);
			const placed = refs.map((ref) => ({
				ref,
				nodes: ref.line ? graph.within(ref.file, ref.line, ref.end) : []
			}));
			const nodes = unique_nodes([
				...placed.flatMap((item) => item.nodes),
				...named.flatMap((ref) => graph.named(ref.file, ref.name!))
			]);
			// A line no function starts before, a module constant: the line itself.
			const loose = placed.filter((item) => item.ref.line && item.nodes.length === 0);
			const bare = loose.map(({ ref }) => ({
				label: `${ref.file.split('/').pop()}:${ref.line}`,
				file: ref.file,
				line: ref.line,
				href: github(ref.file, ref.line)
			}));
			const implementations = unique([...nodes.map((node) => graph.ref(node)), ...bare]);
			const tests: CodeRef[] = [];
			const indirectTests: CodeRef[] = [];
			const callers: CodeRef[] = [];
			// A constant's readers call nothing for the rule: they are its users,
			// and their tests are its tests.
			const readers = loose.flatMap(({ ref }) => graph.readersOf(ref.file, ref.line, ref.end));
			callers.push(...readers.map((reader) => graph.ref(reader)));
			for (const node of nodes) {
				const users = graph.users(node);
				tests.push(...users.tests.map((test) => graph.testRef(test)));
				tests.push(...graph.testsCallingByName(node).map((test) => graph.testRef(test)));
				indirectTests.push(...users.indirect.map((test) => graph.testRef(test)));
				callers.push(...users.callers.map((caller) => graph.ref(caller)));
			}
			// The tests of what reads the constant go through that reader; a test
			// that names the constant reads it itself.
			for (const node of readers) {
				const users = graph.users(node);
				indirectTests.push(
					...[...users.tests, ...users.indirect].map((test) => graph.testRef(test))
				);
				callers.push(...users.callers.map((caller) => graph.ref(caller)));
			}
			for (const { ref } of loose) {
				const names = graph
					.linesOf(ref.file)
					.slice(ref.line - 1, ref.end)
					.map((line) => CONSTANT.exec(line)?.[1])
					.filter((name): name is string => !!name);
				tests.push(...graph.testsNaming(ref.file, names).map((test) => graph.testRef(test)));
			}
			// A whole file the wiki names, `models/entity.py`, without a line or a
			// name: the tests of its classes and functions reach the rule through it.
			const wholeFiles = refs.filter(
				(ref) => !ref.line && !named.some((other) => other.file === ref.file)
			);
			for (const node of wholeFiles.flatMap((ref) => graph.topLevel(ref.file))) {
				const users = graph.users(node);
				indirectTests.push(
					...[...users.tests, ...users.indirect].map((test) => graph.testRef(test))
				);
			}
			const files = refs
				.filter((ref) => !ref.line)
				.map((ref) => ({ label: ref.file, file: ref.file, line: 0, href: github(ref.file, 0) }));
			const direct = unique(tests).sort((a, b) => a.label.localeCompare(b.label));
			traces.set(rule, {
				implementations: unique([...implementations, ...files]),
				tests: direct,
				indirectTests: unique(indirectTests)
					.filter((test) => !direct.some((other) => other.label === test.label))
					.sort((a, b) => a.label.localeCompare(b.label)),
				callers: unique(callers).filter(
					(caller) => !implementations.some((impl) => impl.label === caller.label)
				)
			});
		}
	}
	return traces;
}
