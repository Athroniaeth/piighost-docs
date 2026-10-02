import { error } from '@sveltejs/kit';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, PageServerLoad } from './$types';

/**
 * /ids/BR-MSG-05/ stands for the rule wherever its page moves: the URL to cite
 * from code, issues and the chatbot. A page that names the rule and sends the
 * reader on, rather than an HTTP redirect, so a shared link previews the rule.
 */
export const entries: EntryGenerator = async () =>
	[...(await getSite()).ids.keys()].map((id) => ({ id }));

export const load: PageServerLoad = async ({ params }) => {
	const entry = (await getSite()).ids.get(params.id);
	if (!entry) error(404, 'Unknown identifier');
	return { entry };
};
