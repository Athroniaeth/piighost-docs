import { error } from '@sveltejs/kit';
import { idEntry, idList, idMarkdown } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import type { Language } from '#lib/server/content/config.js';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

/** The card of an identifier in Markdown, like every page of the site. */
export const entries: EntryGenerator = async () =>
	idList((await getSite()).ids).flatMap((id) => [
		{ lang: 'fr', id },
		{ lang: 'en', id }
	]);

export const GET: RequestHandler = async ({ params }) => {
	const lang = params.lang as Language;
	const entry = idEntry((await getSite()).ids, params.id, lang);
	if (!entry) error(404, 'Unknown identifier');
	return new Response(idMarkdown(entry, lang), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
};
