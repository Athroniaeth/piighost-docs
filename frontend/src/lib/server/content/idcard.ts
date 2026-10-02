/**
 * The card of an identifier as Markdown, the twin of /ids/<ID>/ for an
 * assistant: what it says, the page that defines it and, for a rule, its code,
 * its tests and its callers. Written in French, as the wiki that defines it.
 */
import type { IdEntry } from './ids';
import type { CodeRef } from './traceability';

export const SITE_URL = 'https://docs.piighost.dev';

const list = (title: string, refs: CodeRef[], empty: string) =>
	[
		`## ${title}`,
		'',
		...(refs.length ? refs.map((ref) => `- [\`${ref.label}\`](${ref.href})`) : [empty]),
		''
	].join('\n');

export function idMarkdown(entry: IdEntry): string {
	const parts = [
		`# ${entry.id}`,
		'',
		entry.summary,
		'',
		`Défini dans [${entry.title}](${SITE_URL}${entry.href}).`,
		''
	];
	if (entry.id.startsWith('BR-')) {
		const trace = entry.trace;
		if (trace) {
			parts.push(
				list('Où vit la règle', trace.implementations, 'Aucun emplacement relevé.'),
				list('Testée par', trace.tests, 'Aucun test ne l’appelle directement.'),
				list('Utilisée par', trace.callers, 'Aucun appelant relevé.')
			);
		} else {
			parts.push('La page de cette règle ne donne pas encore son emplacement dans le code.', '');
		}
	}
	return parts.join('\n');
}
