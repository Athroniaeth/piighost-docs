import { error } from '@sveltejs/kit';
import { idCard, idCards } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, PageServerLoad } from './$types';

/**
 * /ids/BR-MSG-05/ is the card of an identifier, the URL to cite from code,
 * issues and the chatbot: what it says in each language, the pages that define
 * it, and for a rule the code that implements it and the tests that call it.
 */
export const entries: EntryGenerator = async () =>
	idCards((await getSite()).ids).map((card) => ({ id: card.en.id }));

export const load: PageServerLoad = async ({ params }) => {
	const card = idCard((await getSite()).ids, params.id);
	if (!card) error(404, 'Unknown identifier');
	return { card };
};
