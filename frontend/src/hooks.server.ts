import type { Handle } from '@sveltejs/kit/hooks';

/** The page language, read from the first path segment, written on <html>. */
export const handle: Handle = ({ event, resolve }) => {
	const lang = event.url.pathname.startsWith('/en') ? 'en' : 'fr';
	return resolve(event, {
		transformPageChunk: ({ html }: { html: string }) => html.replace('%lang%', lang)
	});
};
