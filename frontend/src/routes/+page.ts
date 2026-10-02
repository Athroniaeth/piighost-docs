import { redirect } from '@sveltejs/kit';

/** The root goes to the French home, the language the wiki is written in. */
export function load() {
	redirect(308, '/fr/');
}
