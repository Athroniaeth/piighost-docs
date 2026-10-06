import { getSite } from '#lib/server/content/site.js';
import { isRedirected } from '#lib/server/content/seo.js';

export const prerender = true;

/**
 * Every page, with its other language when it has one, and the date of its
 * source's last commit when the checkout has its history. Never today's date:
 * a date that changes on every build tells a crawler nothing.
 */
export async function GET() {
	const site = await getSite();
	const url = (route: string) => `https://docs.piighost.dev${route}`;
	const pages = [...site.pages.values()].filter((page) => !isRedirected(page.route));
	const entries = pages.map((page) => {
		const other = page.route.replace(
			/^\/(fr|en)\//,
			(_all, lang: string) => `/${lang === 'fr' ? 'en' : 'fr'}/`
		);
		const alternate = site.pages.has(other)
			? `<xhtml:link rel="alternate" hreflang="${page.lang}" href="${url(page.route)}"/><xhtml:link rel="alternate" hreflang="${page.lang === 'fr' ? 'en' : 'fr'}" href="${url(other)}"/>`
			: '';
		const lastmod = page.modified ? `<lastmod>${page.modified}</lastmod>` : '';
		return `<url><loc>${url(page.route)}</loc>${lastmod}${alternate}</url>`;
	});
	// The two homes, and the root that picks between them.
	const homeLinks = ['fr', 'en', 'x-default']
		.map(
			(lang) =>
				`<xhtml:link rel="alternate" hreflang="${lang}" href="${url(lang === 'x-default' ? '/' : `/${lang}/`)}"/>`
		)
		.join('');
	const homes = ['/fr/', '/en/']
		.map((route) => `<url><loc>${url(route)}</loc>${homeLinks}</url>`)
		.join('\n');
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${homes}\n${entries.join('\n')}\n</urlset>\n`;
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
