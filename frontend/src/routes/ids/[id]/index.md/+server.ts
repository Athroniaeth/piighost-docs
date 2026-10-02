import { error } from '@sveltejs/kit';
import { idMarkdown } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

/** The card of an identifier in Markdown, like every page of the site. */
export const entries: EntryGenerator = async () =>
	[...(await getSite()).ids.keys()].map((id) => ({ id }));

export const GET: RequestHandler = async ({ params }) => {
	const entry = (await getSite()).ids.get(params.id);
	if (!entry) error(404, 'Unknown identifier');
	return new Response(idMarkdown(entry), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
