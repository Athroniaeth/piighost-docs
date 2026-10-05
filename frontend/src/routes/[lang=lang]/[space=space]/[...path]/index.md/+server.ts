import { error } from '@sveltejs/kit';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

/** The page as plain Markdown (export.ts), for an assistant or a reader who wants the text. */
export const entries: EntryGenerator = async () => {
	const site = await getSite();
	return [...site.pages.values()].map((page) => ({
		lang: page.lang,
		space: page.space,
		path: page.route.split('/').filter(Boolean).slice(2).join('/')
	}));
};

export const GET: RequestHandler = async ({ params }) => {
	const site = await getSite();
	const page = site.pages.get(
		`/${params.lang}/${params.space}/${params.path ? `${params.path}/` : ''}`
	);
	if (!page) error(404, 'Page not found');
	return new Response(page.markdown, {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
