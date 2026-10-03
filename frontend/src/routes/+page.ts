import { redirect } from '@sveltejs/kit';

/** The root goes to the French home. */
export function load() {
	redirect(308, '/fr/');
}
