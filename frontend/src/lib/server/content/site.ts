/**
 * The whole site, read once: every page of the guide and the wiki, their
 * routes, navigation, identifiers, and the problems found on the way.
 *
 * Two passes. The first reads and parses every page and collects the
 * identifiers the wiki defines. The second builds each page's tree, which is
 * when a link or an identifier can be checked against the whole site.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { toString } from 'mdast-util-to-string';
import type { Root as MdastRoot } from 'mdast';
import type { Root as HastRoot } from 'hast';
import type { ContentNode, TocEntry, TreeNode, NavLink } from '@piighost/ui';
import { CONTENT_ROOT, LANGUAGES, REPOSITORY, BRANCH, type Language } from './config';
import { preprocess, readAbbreviations } from './preprocess';
import { parseMarkdown } from './markdown';
import { buildTree } from './tree';
import { collectDefinitions, anchorOf, type IdIndex } from './ids';
import { renderDiagram, closeDiagrams } from './diagrams';

export type Space = 'guide' | 'wiki';

export interface Page {
	space: Space;
	lang: Language;
	/** The route, always with a trailing slash. */
	route: string;
	/** The path inside the repository, for edit links. */
	repoPath: string;
	file: string;
	title: string;
	description: string;
	source: string;
	nodes: ContentNode[];
	toc: TocEntry[];
	text: string;
	breadcrumbs: NavLink[];
	previous?: NavLink;
	next?: NavLink;
}

export interface Site {
	pages: Map<string, Page>;
	nav: Map<string, TreeNode[]>;
	ids: IdIndex;
	problems: string[];
}

interface Draft {
	space: Space;
	lang: Language;
	route: string;
	repoPath: string;
	file: string;
	source: string;
	hast: HastRoot;
	mdast: MdastRoot;
	frontmatter: Record<string, unknown>;
	abbreviations: Map<string, string>;
}

const WIKI_SECTIONS: [string, string][] = [
	['processus', 'Processus'],
	['integrations', 'Intégrations'],
	['exploitation', 'Exploitation'],
	['architecture', 'Architecture'],
	['tests', 'Tests'],
	['reference', 'Référence']
];
const WIKI_TOP = ['quickstart.md', 'besoins-par-profil.md', 'glossaire.md'];

/** Every Markdown file under a folder, as paths relative to it. */
function markdownFiles(root: string, skip: (path: string) => boolean): string[] {
	const out: string[] = [];
	const walk = (folder: string) => {
		for (const name of readdirSync(folder)) {
			if (name.startsWith('.')) continue;
			const full = join(folder, name);
			const rel = relative(root, full);
			if (skip(rel)) continue;
			if (statSync(full).isDirectory()) walk(full);
			else if (name.endsWith('.md')) out.push(rel);
		}
	};
	walk(root);
	return out.sort();
}

/** `getting-started/langchain.md` → `getting-started/langchain/`, `index.md` → ``. */
function routePart(rel: string): string {
	const stem = rel.replace(/\.md$/, '');
	if (stem === 'index') return '';
	return (stem.endsWith('/index') ? stem.slice(0, -'/index'.length) : stem) + '/';
}

function titleOf(draft: Draft): string {
	// A wiki folder index is a generated list headed "Fichiers": name it after its section.
	if (draft.space === 'wiki' && draft.repoPath.endsWith('index.md')) {
		const folder = draft.repoPath.split('/').slice(-2, -1)[0];
		return WIKI_SECTIONS.find(([name]) => name === folder)?.[1] ?? 'Wiki';
	}
	const fromMatter = draft.frontmatter.title;
	if (typeof fromMatter === 'string' && fromMatter) return fromMatter;
	const heading = draft.mdast.children.find((node) => node.type === 'heading' && node.depth === 1);
	if (heading) return toString(heading);
	return draft.route.split('/').filter(Boolean).pop() ?? 'piighost';
}

function descriptionOf(draft: Draft): string {
	const fromMatter = draft.frontmatter.description;
	if (typeof fromMatter === 'string' && fromMatter) return fromMatter;
	const paragraph = draft.mdast.children.find((node) => node.type === 'paragraph');
	return paragraph ? toString(paragraph).slice(0, 220) : '';
}

/** The guide's tree, from the `nav` of its Zensical configuration. */
function guideNav(lang: Language, routes: Map<string, string>): TreeNode[] {
	const config = lang === 'fr' ? 'docs/zensical.fr.toml' : 'docs/zensical.toml';
	const parsed = parseToml(readFileSync(join(CONTENT_ROOT, config), 'utf8')) as {
		project?: { nav?: unknown[] };
		nav?: unknown[];
	};
	const entries = parsed.project?.nav ?? parsed.nav ?? [];
	const convert = (entry: unknown): TreeNode | undefined => {
		if (typeof entry === 'string') {
			const href = routes.get(`docs/${lang}/${entry}`);
			return href ? { label: entry, href } : undefined;
		}
		const [label, value] = Object.entries(entry as Record<string, unknown>)[0] ?? [];
		if (label === undefined) return undefined;
		if (typeof value === 'string') {
			const href = routes.get(`docs/${lang}/${value}`);
			return href ? { label, href } : undefined;
		}
		const children = (value as unknown[]).map(convert).filter((node): node is TreeNode => !!node);
		return { label, children };
	};
	return entries.map(convert).filter((node): node is TreeNode => !!node);
}

/** The wiki's tree: its three entry pages, then one section per folder. */
function wikiNav(drafts: Draft[]): TreeNode[] {
	const byRepo = new Map(drafts.map((draft) => [draft.repoPath, draft]));
	const node = (repoPath: string): TreeNode | undefined => {
		const draft = byRepo.get(repoPath);
		return draft ? { label: titleOf(draft), href: draft.route } : undefined;
	};
	const top = WIKI_TOP.map((name) => node(`openwiki/${name}`)).filter(
		(item): item is TreeNode => !!item
	);
	const sections = WIKI_SECTIONS.map(([folder, label]) => ({
		label,
		children: drafts
			.filter(
				(draft) =>
					draft.repoPath.startsWith(`openwiki/${folder}/`) && !draft.repoPath.endsWith('/index.md')
			)
			.map((draft) => ({ label: titleOf(draft), href: draft.route }))
	})).filter((section) => section.children.length > 0);
	return [...top, ...sections];
}

/** Pages in tree order, for previous and next. */
function flatten(nodes: TreeNode[], trail: NavLink[] = []): { link: NavLink; trail: NavLink[] }[] {
	const out: { link: NavLink; trail: NavLink[] }[] = [];
	for (const node of nodes) {
		if (node.href) out.push({ link: { href: node.href, label: node.label }, trail });
		if (node.children)
			out.push(...flatten(node.children, [...trail, { href: node.href ?? '', label: node.label }]));
	}
	return out;
}

async function load(): Promise<Site> {
	const problems: string[] = [];
	const drafts: Draft[] = [];

	const read = async (
		space: Space,
		lang: Language,
		repoPath: string,
		route: string,
		abbreviations: Map<string, string>
	) => {
		const file = join(CONTENT_ROOT, repoPath);
		const source = readFileSync(file, 'utf8');
		const pre = preprocess(source, abbreviations);
		const parsed = await parseMarkdown(pre.markdown);
		drafts.push({
			space,
			lang,
			route,
			repoPath,
			file,
			source,
			...parsed,
			abbreviations: pre.abbreviations
		});
	};

	for (const lang of LANGUAGES) {
		const root = join(CONTENT_ROOT, 'docs', lang);
		const abbreviationsFile = join(root, 'includes/abbreviations.md');
		const shared = existsSync(abbreviationsFile)
			? readAbbreviations(readFileSync(abbreviationsFile, 'utf8'))
			: new Map();
		for (const rel of markdownFiles(root, (path) => path.startsWith('includes'))) {
			await read('guide', lang, `docs/${lang}/${rel}`, `/${lang}/guide/${routePart(rel)}`, shared);
		}
	}
	const wikiRoot = join(CONTENT_ROOT, 'openwiki');
	for (const rel of markdownFiles(wikiRoot, (path) => path === 'INSTRUCTIONS.md')) {
		await read('wiki', 'fr', `openwiki/${rel}`, `/fr/wiki/${routePart(rel)}`, new Map());
	}

	const routes = new Map(drafts.map((draft) => [draft.repoPath, draft.route]));

	// First pass: the identifiers the wiki defines.
	const ids: IdIndex = new Map();
	const definedBy = new Map<string, Map<string, string>>();
	for (const draft of drafts.filter((item) => item.space === 'wiki')) {
		const anchors = new Map<string, string>();
		for (const entry of collectDefinitions(draft.mdast, draft.route, titleOf(draft))) {
			if (ids.has(entry.id)) {
				problems.push(`${entry.id} defined twice: ${ids.get(entry.id)?.page} and ${draft.route}`);
				continue;
			}
			ids.set(entry.id, entry);
			anchors.set(entry.id, anchorOf(entry.id));
		}
		definedBy.set(draft.route, anchors);
	}

	const nav = new Map<string, TreeNode[]>();
	for (const lang of LANGUAGES) nav.set(`${lang}/guide`, guideNav(lang, routes));
	nav.set('fr/wiki', wikiNav(drafts.filter((draft) => draft.space === 'wiki')));

	// Second pass: every page's tree.
	const pages = new Map<string, Page>();
	for (const draft of drafts) {
		const pageProblems: string[] = [];
		const folder = dirname(draft.file);
		const resolveLink = (href: string): string => {
			if (/^(https?:|mailto:|#)/.test(href)) return href;
			const [path, hash] = href.split('#');
			if (!path) return href;
			const target = resolve(folder, path);
			const repoPath = relative(CONTENT_ROOT, target);
			const candidates =
				path.endsWith('/') || !path.includes('.')
					? [`${repoPath}/index.md`, `${repoPath}.md`]
					: [repoPath];
			for (const candidate of candidates) {
				const route = routes.get(candidate);
				if (route) return hash ? `${route}#${hash}` : route;
			}
			if (existsSync(target) && !repoPath.startsWith('..'))
				return `${REPOSITORY}/blob/${BRANCH}/${repoPath}${hash ? `#${hash}` : ''}`;
			pageProblems.push(`broken link ${href}`);
			return href;
		};
		const resolveAsset = (src: string): string => {
			if (/^(https?:|data:)/.test(src)) return src;
			const target = resolve(folder, src);
			const repoPath = relative(CONTENT_ROOT, target);
			if (!existsSync(target)) {
				pageProblems.push(`missing asset ${src}`);
				return src;
			}
			const destination = resolve('static/content', repoPath);
			mkdirSync(dirname(destination), { recursive: true });
			copyFileSync(target, destination);
			return `/content/${repoPath}`;
		};
		const built = await buildTree(draft.hast, {
			resolveLink,
			resolveAsset,
			renderDiagram,
			ids,
			abbreviations: draft.abbreviations,
			definitionAnchors: definedBy.get(draft.route) ?? new Map(),
			slugStyle: draft.space === 'wiki' ? 'github' : 'python-markdown',
			problems: pageProblems
		});
		for (const problem of new Set(pageProblems)) problems.push(`${draft.repoPath}: ${problem}`);
		pages.set(draft.route, {
			space: draft.space,
			lang: draft.lang,
			route: draft.route,
			repoPath: draft.repoPath,
			file: draft.file,
			title: titleOf(draft),
			description: descriptionOf(draft),
			source: draft.source,
			nodes: built.nodes,
			toc: built.toc,
			text: built.text,
			breadcrumbs: []
		});
	}
	await closeDiagrams();

	for (const [key, tree] of nav) {
		const order = flatten(tree);
		order.forEach((item, index) => {
			const page = pages.get(item.link.href);
			if (!page) return;
			page.previous = order[index - 1]?.link;
			page.next = order[index + 1]?.link;
			const home = key.endsWith('wiki')
				? { href: `/${key}/`, label: 'Wiki' }
				: { href: `/${key}/`, label: 'Guide' };
			page.breadcrumbs = [home, ...item.trail.filter((crumb) => crumb.label), item.link];
		});
	}

	return { pages, nav, ids, problems };
}

let site: Promise<Site> | undefined;

/** The site, loaded on first use and kept for the rest of the build. */
export function getSite(): Promise<Site> {
	site ??= load();
	return site;
}
