import { idEntry, idList, idMarkdown, idRoute, SITE_URL } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import { fullText, isRedirected } from '#lib/server/content/seo.js';

export const prerender = true;

/** Every page's Markdown, then every identifier card, in one file for an assistant that takes it whole. */
export async function GET() {
	const site = await getSite();
	const pages = [...site.pages.values()].filter((page) => !isRedirected(page.route)).map(fullText);
	const cards = (['en', 'fr'] as const).flatMap((lang) =>
		idList(site.ids).map(
			(id) =>
				`${idMarkdown(idEntry(site.ids, id, lang)!, lang)}\nSource: ${SITE_URL}${idRoute(lang, id)}`
		)
	);
	const body = [...pages, ...cards].join('\n\n---\n\n');
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
