/**
 * What search engines and assistants read about a page beyond its text: a
 * description of the right length, the date of its last change, and which
 * routes are not pages of their own.
 */
import { execFileSync } from 'node:child_process';
import { CONTENT_ROOT } from './config';
import { SITE_URL } from './idcard';

/** The length search engines show of a description, ellipsis included. */
export const DESCRIPTION_LENGTH = 155;

/**
 * A text on one line, cut at the last word that fits in `max` characters,
 * with an ellipsis when something was cut.
 */
export function clip(text: string, max = DESCRIPTION_LENGTH): string {
	const line = text.replace(/\s+/g, ' ').trim();
	if (line.length <= max) return line;
	const room = line.slice(0, max - 1);
	// The cut falls on a space already: the last word is whole.
	const cut = line[max - 1] === ' ' ? room.length : room.lastIndexOf(' ');
	const kept = (cut > 0 ? room.slice(0, cut) : room).replace(/[\s,;:.([{«"'’-]+$/, '');
	return `${kept}…`;
}

/**
 * The index of the domain documentation, /fr/domain/ and /en/domain/: the
 * folder list OpenWiki generates. nginx answers it with a 301 to the
 * quickstart, so it is listed nowhere.
 */
export const isRedirected = (route: string) => /^\/(fr|en)\/domain\/$/.test(route);

let shallow: boolean | undefined;
const dates = new Map<string, string | undefined>();

/**
 * The date of the last commit that changed a file of the content checkout,
 * in ISO 8601, or undefined when the checkout carries no history. A shallow
 * clone gives every file the date of its one commit, which says nothing of
 * the page: no date then either.
 */
export function lastModified(repoPath: string): string | undefined {
	if (dates.has(repoPath)) return dates.get(repoPath);
	const git = (...args: string[]) =>
		execFileSync('git', ['-C', CONTENT_ROOT, ...args], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
	let date: string | undefined;
	try {
		shallow ??= git('rev-parse', '--is-shallow-repository') !== 'false';
		if (!shallow) date = git('log', '-1', '--format=%cI', '--', repoPath) || undefined;
	} catch {
		// No git, or no repository: the content was exported without its history.
		shallow = true;
	}
	dates.set(repoPath, date);
	return date;
}

/** A page in a full-text file: its title, its address, its Markdown. */
export const fullText = (page: { title: string; route: string; markdown: string }) =>
	`# ${page.title}\n\nSource: ${SITE_URL}${page.route}\n\n${page.markdown}`;
