import type { EntryGenerator } from './$types';

/** One not-found page per language. */
export const entries: EntryGenerator = () => [{ lang: 'fr' }, { lang: 'en' }];
