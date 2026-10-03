import { error } from '@sveltejs/kit';
import { idCard, idCards, idMarkdown } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

/** The card of an identifier in Markdown, like every page of the site. */
export const entries: EntryGenerator = async () =>
	idCards((await getSite()).ids).map((card) => ({ id: card.en.id }));

export const GET: RequestHandler = async ({ params }) => {
	const card = idCard((await getSite()).ids, params.id);
	if (!card) error(404, 'Unknown identifier');
	return new Response(idMarkdown(card), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
