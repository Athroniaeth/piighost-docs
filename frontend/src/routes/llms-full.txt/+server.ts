import { getSite } from '#lib/server/content/site.js';

export const prerender = true;

/** Every page's Markdown in one file, for an assistant that takes it whole. */
export async function GET() {
	const site = await getSite();
	const body = [...site.pages.values()]
		.map(
			(page) =>
				`# ${page.title}\n\nSource: https://docs.piighost.dev${page.route}\n\n${page.source}`
		)
		.join('\n\n---\n\n');
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
