import { error } from '@sveltejs/kit';
import { getSite } from '#lib/server/content/site.js';
import { REPOSITORY, BRANCH } from '#lib/server/content/config.js';
import type { EntryGenerator, PageServerLoad } from './$types';

/** Every page of both spaces, so the prerender writes all of them. */
export const entries: EntryGenerator = async () => {
	const site = await getSite();
	return [...site.pages.values()].map((page) => ({
		lang: page.lang,
		space: page.space,
		path: page.route.split('/').filter(Boolean).slice(2).join('/')
	}));
};

export const load: PageServerLoad = async ({ params }) => {
	const site = await getSite();
	const path = (params.path ?? '').replace(/^\/+|\/+$/g, '');
	const route = `/${params.lang}/${params.space}/${path ? `${path}/` : ''}`;
	const page = site.pages.get(route);
	if (!page) {
		if (process.env.DEBUG_ROUTES)
			console.error('no page for', JSON.stringify(params), route, site.pages.size);
		error(404, 'Page not found');
	}
	const otherLang = params.lang === 'fr' ? 'en' : 'fr';
	const alternate = site.pages.get(route.replace(`/${params.lang}/`, `/${otherLang}/`))?.route;
	return {
		page: {
			title: page.title,
			description: page.description,
			nodes: page.nodes,
			toc: page.toc,
			breadcrumbs: page.breadcrumbs,
			previous: page.previous,
			next: page.next,
			route: page.route
		},
		nav: site.nav.get(`${params.lang}/${params.space}`) ?? [],
		alternate,
		editUrl: `${REPOSITORY}/edit/${BRANCH}/${page.repoPath}`,
		issueUrl: `${REPOSITORY}/issues/new?title=${encodeURIComponent(`docs: ${page.title}`)}&body=${encodeURIComponent(`Page: https://docs.piighost.dev${page.route}\n\n`)}`,
		markdownUrl: `${page.route}index.md`
	};
};
