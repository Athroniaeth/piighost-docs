import { idList } from '#lib/server/content/idcard.js';
import { getSite } from '#lib/server/content/site.js';
import type { EntryGenerator, PageServerLoad } from './$types';

/**
 * /ids/BR-MSG-05/, the address code and issues already cite, leads to the
 * card in the reader's language (+page.svelte).
 */
export const entries: EntryGenerator = async () =>
	idList((await getSite()).ids).map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => ({ id: params.id });
