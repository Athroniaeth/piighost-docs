/**
 * The card of an identifier, the URL to cite from code, issues and the
 * chatbot. An identifier is defined in both languages of the wiki, so its card
 * holds both definitions, English first, and for a rule its code, its tests and
 * its callers, which do not depend on the language.
 */
import type { Language } from './config';
import type { IdEntry, IdIndex } from './ids';
import type { CodeRef } from './traceability';

export const SITE_URL = 'https://docs.piighost.dev';

/** An identifier's definition in each language of the wiki. */
export type IdCard = Record<Language, IdEntry>;

/** Every identifier's card, in the order the English wiki defines them. */
export function idCards(ids: Map<Language, IdIndex>): IdCard[] {
	const fr = ids.get('fr') ?? new Map();
	return [...(ids.get('en') ?? new Map()).values()]
		.filter((entry) => fr.has(entry.id))
		.map((entry) => ({ en: entry, fr: fr.get(entry.id)! }));
}

/** One identifier's card, or undefined when a language does not define it. */
export function idCard(ids: Map<Language, IdIndex>, id: string): IdCard | undefined {
	const en = ids.get('en')?.get(id);
	const fr = ids.get('fr')?.get(id);
	return en && fr ? { en, fr } : undefined;
}

const list = (title: string, refs: CodeRef[], empty: string) =>
	[
		`## ${title}`,
		'',
		...(refs.length ? refs.map((ref) => `- [\`${ref.label}\`](${ref.href})`) : [empty]),
		''
	].join('\n');

/** The card as Markdown, the twin of /ids/<ID>/ for an assistant. */
export function idMarkdown(card: IdCard): string {
	const { en, fr } = card;
	const parts = [
		`# ${en.id}`,
		'',
		en.summary,
		'',
		`Defined in [${en.title}](${SITE_URL}${en.href}).`,
		'',
		`En français : ${fr.summary} Défini dans [${fr.title}](${SITE_URL}${fr.href}).`,
		''
	];
	if (en.id.startsWith('BR-')) {
		const trace = en.trace;
		if (trace) {
			parts.push(
				list('Where the rule lives', trace.implementations, 'No location found.'),
				list('Tested by', trace.tests, 'No test calls it directly.'),
				list('Used by', trace.callers, 'No caller found.')
			);
		} else {
			parts.push('The page of this rule does not give its place in the code yet.', '');
		}
	}
	return parts.join('\n');
}
