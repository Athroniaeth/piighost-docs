import { idMarkdown, SITE_URL } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';

export const prerender = true;

/** Every page's Markdown, then every identifier card, in one file for an assistant that takes it whole. */
export async function GET() {
	const site = await getSite();
	const pages = [...site.pages.values()].map(
		(page) => `# ${page.title}\n\nSource: ${SITE_URL}${page.route}\n\n${page.source}`
	);
	const cards = [...site.ids.values()].map(
		(entry) => `${idMarkdown(entry)}\nSource: ${SITE_URL}/ids/${entry.id}/`
	);
	const body = [...pages, ...cards].join('\n\n---\n\n');
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
