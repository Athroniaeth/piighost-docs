import { error } from '@sveltejs/kit';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, PageServerLoad } from './$types';

/**
 * /ids/BR-MSG-05/ is the card of an identifier, the URL to cite from code,
 * issues and the chatbot: what it says, the page that defines it, and for a
 * rule the code that implements it and the tests that call it.
 */
export const entries: EntryGenerator = async () =>
	[...(await getSite()).ids.keys()].map((id) => ({ id }));

export const load: PageServerLoad = async ({ params }) => {
	const entry = (await getSite()).ids.get(params.id);
	if (!entry) error(404, 'Unknown identifier');
	return { entry };
};
