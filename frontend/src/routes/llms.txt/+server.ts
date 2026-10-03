import { idCards, SITE_URL } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';

export const prerender = true;

/**
 * The index an assistant reads first (llmstxt.org): every page with its
 * description, grouped by space, then every identifier card, each pointing at
 * its Markdown source.
 */
export async function GET() {
	const site = await getSite();
	const pages = [...site.pages.values()];
	const section = (title: string, filter: (route: string) => boolean) =>
		[
			`## ${title}`,
			'',
			...pages
				.filter((page) => filter(page.route))
				.map(
					(page) =>
						`- [${page.title}](https://docs.piighost.dev${page.route}index.md): ${page.description.replace(/\s+/g, ' ').slice(0, 160)}`
				),
			''
		].join('\n');
	const body = [
		'# piighost',
		'',
		'> A Python library that protects confidential data in conversations with LLMs through reversible de-identification: values are replaced by placeholders before the model, restored in the reply.',
		'',
		section('Technical guide (English)', (route) => route.startsWith('/en/guide/')),
		section('Guide technique (français)', (route) => route.startsWith('/fr/guide/')),
		section('Business wiki (English)', (route) => route.startsWith('/en/wiki/')),
		section('Wiki métier (français)', (route) => route.startsWith('/fr/wiki/')),
		[
			'## Identifier cards',
			'',
			...idCards(site.ids).map(
				({ en }) =>
					`- [${en.id}](${SITE_URL}/ids/${en.id}/index.md): ${en.summary.replace(/\s+/g, ' ').slice(0, 160)}`
			),
			''
		].join('\n')
	].join('\n');
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
