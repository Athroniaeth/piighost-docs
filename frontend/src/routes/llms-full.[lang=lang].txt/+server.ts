import { getSite } from '#lib/server/content/site.js';
import { fullText } from '#lib/server/content/seo.js';
import type { TreeNode } from '@piighost/ui';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

/** One file per language. */
export const entries: EntryGenerator = () => [{ lang: 'en' }, { lang: 'fr' }];

/** The routes of a tree, in reading order. A link to a section is not a page. */
const routes = (nodes: TreeNode[]): string[] =>
	nodes.flatMap((node) => [
		...(node.href && !node.href.includes('#') ? [node.href] : []),
		...routes(node.children ?? [])
	]);

/**
 * The technical guide of one language, whole, in the order of its menu: what
 * an assistant needs to use piighost, at a size its context can hold. The
 * domain documentation and the identifier cards stay in llms-full.txt.
 */
export const GET: RequestHandler = async ({ params }) => {
	const site = await getSite();
	const guide = [...site.pages.values()].filter((page) =>
		page.route.startsWith(`/${params.lang}/guide/`)
	);
	const order = routes(site.nav.get(`${params.lang}/guide`) ?? []);
	const rank = (route: string) => {
		const index = order.indexOf(route);
		return index === -1 ? order.length : index;
	};
	guide.sort((a, b) => rank(a.route) - rank(b.route));
	const body = guide.map(fullText).join('\n\n---\n\n');
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
