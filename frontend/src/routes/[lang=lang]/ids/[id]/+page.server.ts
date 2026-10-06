import { error } from '@sveltejs/kit';
import { idEntry, idList, idRoute } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import { clip } from '#lib/server/content/seo.js';
import type { Language } from '#lib/server/content/config.js';
import type { NavLink } from '@piighost/ui';
import type { EntryGenerator, PageServerLoad } from './$types';

/**
 * /fr/ids/BR-MSG-05/ is the card of an identifier, the URL to cite from code,
 * issues and the chatbot: what it says, the page that defines it, and for a
 * rule the code that implements it and the tests that reach it. One card per
 * language, inside the domain documentation.
 */
export const entries: EntryGenerator = async () =>
	idList((await getSite()).ids).flatMap((id) => [
		{ lang: 'fr', id },
		{ lang: 'en', id }
	]);

export const load: PageServerLoad = async ({ params }) => {
	const site = await getSite();
	const lang = params.lang as Language;
	const entry = idEntry(site.ids, params.id, lang);
	if (!entry) error(404, 'Unknown identifier');
	const route = idRoute(lang, entry.id);
	const definition = site.pages.get(entry.page);
	const breadcrumbs: NavLink[] = [
		...(definition?.breadcrumbs.slice(0, -1) ?? []),
		{ href: entry.page, label: entry.title },
		{ href: route, label: entry.id }
	];
	return {
		entry,
		description: clip(entry.summary),
		route,
		breadcrumbs,
		nav: site.nav.get(`${lang}/domain`) ?? [],
		alternate: idRoute(lang === 'fr' ? 'en' : 'fr', entry.id),
		markdownUrl: `${route}index.md`
	};
};
