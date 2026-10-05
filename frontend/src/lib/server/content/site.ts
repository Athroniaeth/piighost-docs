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
import { expandIncludes, preprocess, readAbbreviations } from './preprocess';
import { parseMarkdown } from './markdown';
import { buildTree } from './tree';
import { collectDefinitions, anchorOf, NEED, type IdIndex } from './ids';
import { renderDiagram, closeDiagrams } from './diagrams';
import { traceRules } from './traceability';

export type Space = 'guide' | 'domain';

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
	/** The identifiers each language's wiki defines, the same set in both. */
	ids: Map<Language, IdIndex>;
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

/** The wiki's folders, the same English paths in both languages, with each language's label. */
const WIKI_SECTIONS: [string, Record<Language, string>][] = [
	['processes', { fr: 'Processus', en: 'Processes' }],
	['integrations', { fr: 'Intégrations', en: 'Integrations' }],
	['operations', { fr: 'Exploitation', en: 'Operations' }],
	['architecture', { fr: 'Architecture', en: 'Architecture' }],
	['tests', { fr: 'Tests', en: 'Tests' }],
	['reference', { fr: 'Référence', en: 'Reference' }]
];
const WIKI_TOP = ['quickstart.md', 'needs-by-profile.md', 'glossary.md'];

/** The first crumb of each space, as the navigation names it. */
const HOME_LABELS: Record<Space, Record<Language, string>> = {
	guide: { fr: 'Technique', en: 'Technical' },
	domain: { fr: 'Métier', en: 'Domain' }
};

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
	if (draft.space === 'domain' && draft.repoPath.endsWith('index.md')) {
		const folder = draft.repoPath.split('/').slice(-2, -1)[0];
		return WIKI_SECTIONS.find(([name]) => name === folder)?.[1][draft.lang] ?? 'Documentation';
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
	// A reference page opens on the module it documents, `Module: piighost.x`,
	// which says nothing of what the page holds: the next paragraph does.
	const paragraph = draft.mdast.children.find(
		(node) => node.type === 'paragraph' && !/^Module\s?:/.test(toString(node))
	);
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

/** One language's wiki tree: its three entry pages, then one section per folder. */
function wikiNav(lang: Language, drafts: Draft[]): TreeNode[] {
	const byRepo = new Map(drafts.map((draft) => [draft.repoPath, draft]));
	const node = (repoPath: string): TreeNode | undefined => {
		const draft = byRepo.get(repoPath);
		return draft ? { label: titleOf(draft), href: draft.route } : undefined;
	};
	const top = WIKI_TOP.map((name) => node(`openwiki/${lang}/${name}`)).filter(
		(item): item is TreeNode => !!item
	);
	const sections = WIKI_SECTIONS.map(([folder, labels]) => ({
		label: labels[lang],
		children: drafts
			.filter(
				(draft) =>
					draft.repoPath.startsWith(`openwiki/${lang}/${folder}/`) &&
					!draft.repoPath.endsWith('/index.md')
			)
			.map((draft) => ({ label: titleOf(draft), href: draft.route }))
	})).filter((section) => section.children.length > 0);
	return [...top, ...sections];
}

/** The headings of the sections that define needs, one per profile. */
function profileHeadings(tree: MdastRoot): Set<string> {
	const found = new Set<string>();
	let section = '';
	for (const node of tree.children) {
		if (node.type === 'heading' && node.depth === 2) section = toString(node).trim();
		else if (node.type === 'paragraph' && section && NEED.test(toString(node).trim()))
			found.add(section);
	}
	return found;
}

/**
 * The needs page becomes a section of the tree: its first heading opens the
 * page, then one entry per profile leads to that profile's section.
 */
function listProfiles(tree: TreeNode[], page: Page, draft: Draft): TreeNode[] {
	const profiles = profileHeadings(draft.mdast);
	const sections = page.toc.filter((entry) => entry.depth === 2 && profiles.has(entry.text));
	if (sections.length === 0) return tree;
	return tree.map((node) =>
		node.href === page.route
			? {
					label: page.title,
					children: [
						{ label: page.toc[0]?.text ?? page.title, href: page.route },
						...sections.map((entry) => ({ label: entry.text, href: `${page.route}#${entry.id}` }))
					]
				}
			: node
	);
}

/** Pages in tree order, for previous and next. A link to a section is not a page. */
function flatten(nodes: TreeNode[], trail: NavLink[] = []): { link: NavLink; trail: NavLink[] }[] {
	const out: { link: NavLink; trail: NavLink[] }[] = [];
	for (const node of nodes) {
		if (node.href && !node.href.includes('#'))
			out.push({ link: { href: node.href, label: node.label }, trail });
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
		const written = readFileSync(file, 'utf8');
		// Includes resolve as Zensical's base_path does: the page's language folder, then docs/.
		const bases =
			space === 'guide'
				? [join(CONTENT_ROOT, 'docs', lang), join(CONTENT_ROOT, 'docs')]
				: [join(CONTENT_ROOT, 'openwiki', lang)];
		const read = (path: string) => {
			const found = bases
				.map((base) => join(base, path))
				.find((candidate) => existsSync(candidate));
			return found ? readFileSync(found, 'utf8') : undefined;
		};
		const includeProblems: string[] = [];
		// The source an assistant reads (index.md) is the page as a reader sees it, examples included.
		const source = expandIncludes(written, read, includeProblems);
		for (const problem of includeProblems) problems.push(`${repoPath}: ${problem}`);
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
	for (const lang of LANGUAGES) {
		const wikiRoot = join(CONTENT_ROOT, 'openwiki', lang);
		for (const rel of markdownFiles(wikiRoot, () => false)) {
			await read(
				'domain',
				lang,
				`openwiki/${lang}/${rel}`,
				`/${lang}/domain/${routePart(rel)}`,
				new Map()
			);
		}
	}

	// The two wikis are one wiki in two languages: a page in one only is a gap.
	const wikiPaths = (lang: Language) =>
		new Set(
			drafts
				.filter((draft) => draft.space === 'domain' && draft.lang === lang)
				.map((draft) => draft.repoPath.slice(`openwiki/${lang}/`.length))
		);
	const [frPages, enPages] = [wikiPaths('fr'), wikiPaths('en')];
	for (const path of frPages)
		if (!enPages.has(path)) problems.push(`openwiki/en/${path} is missing`);
	for (const path of enPages)
		if (!frPages.has(path)) problems.push(`openwiki/fr/${path} is missing`);

	const routes = new Map(drafts.map((draft) => [draft.repoPath, draft.route]));

	// First pass: the identifiers each language's wiki defines, once each.
	const ids = new Map<Language, IdIndex>(LANGUAGES.map((lang) => [lang, new Map()]));
	const definedBy = new Map<string, Map<string, string>>();
	for (const draft of drafts.filter((item) => item.space === 'domain')) {
		const index = ids.get(draft.lang)!;
		const anchors = new Map<string, string>();
		for (const entry of collectDefinitions(draft.mdast, draft.route, titleOf(draft))) {
			if (index.has(entry.id)) {
				problems.push(`${entry.id} defined twice: ${index.get(entry.id)?.page} and ${draft.route}`);
				continue;
			}
			index.set(entry.id, entry);
			anchors.set(entry.id, anchorOf(entry.id));
		}
		definedBy.set(draft.route, anchors);
	}
	const [frIds, enIds] = [ids.get('fr')!, ids.get('en')!];
	for (const id of frIds.keys())
		if (!enIds.has(id)) problems.push(`${id} is not defined in English`);
	for (const id of enIds.keys())
		if (!frIds.has(id)) problems.push(`${id} is not defined in French`);

	// The rules the wiki locates, joined to the code graph when it was built.
	// The code is the same in both languages: the French pages give it.
	for (const [rule, trace] of traceRules(
		drafts.filter((item) => item.space === 'domain' && item.lang === 'fr').map((item) => item.mdast)
	)) {
		for (const index of ids.values()) {
			const entry = index.get(rule);
			if (entry) entry.trace = trace;
		}
	}

	const nav = new Map<string, TreeNode[]>();
	for (const lang of LANGUAGES) nav.set(`${lang}/guide`, guideNav(lang, routes));
	for (const lang of LANGUAGES)
		nav.set(
			`${lang}/domain`,
			wikiNav(
				lang,
				drafts.filter((draft) => draft.space === 'domain')
			)
		);

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
			ids: ids.get(draft.lang)!,
			abbreviations: draft.abbreviations,
			definitionAnchors: definedBy.get(draft.route) ?? new Map(),
			slugStyle: draft.space === 'domain' ? 'github' : 'python-markdown',
			lang: draft.lang,
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

	for (const lang of LANGUAGES) {
		const key = `${lang}/domain`;
		const draft = drafts.find((item) => item.repoPath === `openwiki/${lang}/needs-by-profile.md`);
		const page = draft && pages.get(draft.route);
		if (draft && page) nav.set(key, listProfiles(nav.get(key)!, page, draft));
	}

	/** The first crumb: the guide's home, or the domain documentation's first page. */
	const homeCrumb = (lang: Language, space: Space): NavLink => ({
		href: space === 'domain' ? `/${lang}/domain/quickstart/` : `/${lang}/guide/`,
		label: HOME_LABELS[space][lang]
	});
	/**
	 * A section of the tree is a heading, not a page: its crumb leads to the
	 * folder's index when the wiki has one, and is plain text otherwise (the
	 * guide's sections have none).
	 */
	const sectionHref = (crumb: NavLink, lang: Language, space: Space): string => {
		if (crumb.href) return crumb.href;
		if (space !== 'domain') return '';
		const folder = WIKI_SECTIONS.find(([, names]) => names[lang] === crumb.label)?.[0];
		const route = folder ? `/${lang}/domain/${folder}/` : '';
		return pages.has(route) ? route : '';
	};

	// A domain page is named by its title, even where the tree shows it under
	// another label: the needs page opens on its first heading. The guide keeps
	// the labels of its Zensical nav.
	const named = (link: NavLink | undefined, space: Space): NavLink | undefined =>
		link && space === 'domain'
			? { href: link.href, label: pages.get(link.href)?.title ?? link.label }
			: link;
	for (const [key, tree] of nav) {
		const order = flatten(tree);
		const [lang, space] = key.split('/') as [Language, Space];
		order.forEach((item, index) => {
			const page = pages.get(item.link.href);
			if (!page) return;
			page.previous = named(order[index - 1]?.link, space);
			page.next = named(order[index + 1]?.link, space);
			const link = named(item.link, space)!;
			const trail = item.trail
				.filter((crumb) => crumb.label && crumb.label !== link.label)
				.map((crumb) => ({ label: crumb.label, href: sectionHref(crumb, lang, space) }));
			page.breadcrumbs = [homeCrumb(lang, space), ...trail, link];
		});
	}
	// A page outside the tree, a wiki folder's index: under its space's home.
	for (const page of pages.values())
		if (page.breadcrumbs.length === 0)
			page.breadcrumbs = [
				homeCrumb(page.lang, page.space),
				{ href: page.route, label: page.title }
			];

	return { pages, nav, ids, problems };
}

let site: Promise<Site> | undefined;

/** The site, loaded on first use and kept for the rest of the build. */
export function getSite(): Promise<Site> {
	site ??= load();
	return site;
}
