import { defineParams } from '@sveltejs/kit/params';

/** The route parameter matchers, which SvelteKit 3 reads from this one module. */
export const params = defineParams({
	/** The two languages of the site. */
	lang: (param: string) => (param === 'fr' || param === 'en' ? param : undefined),
	/** The two spaces: the technical documentation and the domain documentation. */
	space: (param: string) => (param === 'guide' || param === 'domain' ? param : undefined)
});
