import { idEntry, idList, idRoute, SITE_URL } from '#lib/server/content/idcard.js';
import { getSite, type Page } from '#lib/server/content/site.js';
import { clip, isRedirected } from '#lib/server/content/seo.js';

export const prerender = true;

/**
 * The pages an assistant should read first, by section, as paths under the
 * guide (`docs/<lang>/`) or the domain documentation (`openwiki/<lang>/`).
 * The same paths exist in both languages.
 */
const CHOSEN: [string, string[]][] = [
	[
		'Get started',
		[
			'guide/',
			'guide/why-anonymize/',
			'guide/getting-started/installation/',
			'guide/getting-started/quickstart/',
			'guide/getting-started/first-pipeline/',
			'guide/getting-started/conversation/',
			'guide/getting-started/configuration/',
			'guide/getting-started/langchain/',
			'guide/getting-started/api-server/',
			'guide/getting-started/api-client/'
		]
	],
	[
		'Integrations and recipes',
		[
			'guide/examples/basic/',
			'guide/examples/langchain/',
			'guide/examples/pydantic-ai/',
			'guide/examples/llama-index/',
			'guide/examples/claude-code/',
			'guide/examples/openai-proxy/',
			'guide/examples/anthropic-proxy/',
			'guide/examples/detectors/',
			'guide/examples/overrides/',
			'guide/extending/',
			'guide/examples/testing/',
			'guide/deployment/',
			'guide/multi-instance/'
		]
	],
	[
		'Comparison, compliance and measures',
		[
			'guide/comparison/',
			'guide/compliance/',
			'guide/dpia/',
			'guide/security/',
			'guide/benchmark/',
			'guide/limitations/',
			'guide/architecture/',
			'guide/conception/',
			'guide/placeholder-factories/',
			'guide/tool-call-strategies/',
			'guide/glossary/'
		]
	],
	[
		'Reference',
		[
			'guide/reference/anonymizer/',
			'guide/reference/pipeline/',
			'guide/reference/langchain/',
			'guide/reference/detectors/',
			'guide/configuration/toml/',
			'guide/reference/api-endpoints/'
		]
	],
	['Community', ['guide/community/faq/', 'guide/community/upgrading/']],
	['Domain documentation', ['domain/quickstart/', 'domain/needs-by-profile/']]
];

/** The key pages in French, in the same order. */
const FRENCH = [
	'guide/',
	'guide/why-anonymize/',
	'guide/getting-started/installation/',
	'guide/getting-started/quickstart/',
	'guide/getting-started/langchain/',
	'guide/examples/basic/',
	'guide/examples/langchain/',
	'guide/examples/pydantic-ai/',
	'guide/examples/llama-index/',
	'guide/examples/openai-proxy/',
	'guide/comparison/',
	'guide/compliance/',
	'guide/dpia/',
	'guide/benchmark/',
	'guide/glossary/',
	'guide/community/faq/',
	'domain/quickstart/',
	'domain/needs-by-profile/'
];

const link = (page: Page) =>
	`- [${page.title}](${SITE_URL}${page.route}index.md)${page.description ? `: ${clip(page.description, 160)}` : ''}`;

/**
 * The index an assistant reads first (llmstxt.org): a short list of the pages
 * that answer most questions, in English then French, each pointing at its
 * Markdown, and the full texts. Every other page and the identifier cards
 * come under Optional, which an assistant short of context may skip.
 */
export async function GET() {
	const site = await getSite();
	const listed = new Set<string>();
	const pick = (lang: 'en' | 'fr', paths: string[]) =>
		paths.flatMap((path) => {
			const page = site.pages.get(`/${lang}/${path}`);
			if (!page) {
				console.warn(`llms.txt: no page /${lang}/${path}`);
				return [];
			}
			listed.add(page.route);
			return [link(page)];
		});
	const section = (title: string, lines: string[]) => [`## ${title}`, '', ...lines, ''];

	const chosen = CHOSEN.flatMap(([title, paths]) => section(title, pick('en', paths)));
	const french = section('Français', pick('fr', FRENCH));
	const others = [...site.pages.values()]
		.filter((page) => !listed.has(page.route) && !isRedirected(page.route))
		.map(link);
	const cards = (['en', 'fr'] as const).flatMap((lang) =>
		idList(site.ids).map((id) => {
			const entry = idEntry(site.ids, id, lang)!;
			return `- [${id} (${lang})](${SITE_URL}${idRoute(lang, id)}index.md): ${clip(entry.summary, 160)}`;
		})
	);

	const body = [
		'# piighost',
		'',
		'> A Python library that protects confidential data in conversations with LLMs through reversible de-identification: values are replaced by placeholders before the model, restored in the reply.',
		'',
		'The documentation exists in English and French. Each link leads to the Markdown of its page. The technical guide explains how to install, integrate and configure piighost. The domain documentation holds the rules of de-identification and the tests that check them.',
		'',
		...chosen,
		...section('Full text', [
			`- [Technical guide, English](${SITE_URL}/llms-full.en.txt): every page of the English guide in one file`,
			`- [Guide technique, français](${SITE_URL}/llms-full.fr.txt): toutes les pages du guide français en un fichier`
		]),
		...french,
		...section('Optional', [
			`- [Everything](${SITE_URL}/llms-full.txt): both languages, both documentations and every identifier card in one file`,
			...others,
			...cards
		])
	].join('\n');
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
