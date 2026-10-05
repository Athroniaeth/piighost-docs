/**
 * The card of an identifier, the URL to cite from code, issues and the
 * chatbot: `/fr/ids/<ID>/` and `/en/ids/<ID>/`, each in its own language.
 * An identifier is defined in both languages of the wiki, and for a rule its
 * card gives its code, its tests and its callers, which do not depend on the
 * language.
 */
import type { Language } from './config';
import type { IdEntry, IdIndex } from './ids';
import type { CodeRef, Trace } from './traceability';
import { CARD_TEXT } from '../../card-text';

export const SITE_URL = 'https://docs.piighost.dev';

/** The identifiers both languages define, in the order the English wiki defines them. */
export function idList(ids: Map<Language, IdIndex>): string[] {
	const fr = ids.get('fr') ?? new Map();
	return [...(ids.get('en') ?? new Map()).keys()].filter((id) => fr.has(id));
}

/** One identifier's definition in a language, or undefined when either language lacks it. */
export function idEntry(
	ids: Map<Language, IdIndex>,
	id: string,
	lang: Language
): IdEntry | undefined {
	const both = ids.get('en')?.has(id) && ids.get('fr')?.has(id);
	return both ? ids.get(lang)?.get(id) : undefined;
}

/** The route of a card. */
export const idRoute = (lang: Language, id: string) => `/${lang}/ids/${id}/`;

const list = (title: string, refs: CodeRef[], empty: string) =>
	[
		`## ${title}`,
		'',
		...(refs.length ? refs.map((ref) => `- [\`${ref.label}\`](${ref.href})`) : [empty]),
		''
	].join('\n');

/** A rule's trace as Markdown, in a language. */
function traceMarkdown(trace: Trace, lang: Language): string[] {
	const t = CARD_TEXT[lang];
	const parts = [list(t.lives, trace.implementations, t.livesEmpty)];
	if (trace.tests.length + trace.indirectTests.length === 0)
		parts.push(`## ${t.tests}`, '', t.untested, '');
	else
		parts.push(
			list(t.direct, trace.tests, t.directEmpty),
			list(t.indirect, trace.indirectTests, t.indirectEmpty)
		);
	parts.push(list(t.usedBy, trace.callers, t.usedByEmpty), t.source, '');
	return parts;
}

/** The card as Markdown, the twin of /<lang>/ids/<ID>/ for an assistant. */
export function idMarkdown(entry: IdEntry, lang: Language): string {
	const t = CARD_TEXT[lang];
	const parts = [
		`# ${entry.id}`,
		'',
		entry.summary,
		'',
		`${t.definedIn} [${entry.title}](${SITE_URL}${entry.href}).`,
		''
	];
	if (entry.id.startsWith('BR-')) {
		if (entry.trace) parts.push(...traceMarkdown(entry.trace, lang));
		else parts.push(t.noPlace, '');
	}
	return parts.join('\n');
}
