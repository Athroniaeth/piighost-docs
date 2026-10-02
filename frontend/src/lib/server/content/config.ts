/**
 * Where the content comes from and where the build writes what it derives.
 *
 * The site holds no copy of the documentation. It reads a checkout of the
 * piighost repository: in CI the ref named by the dispatch, locally any
 * worktree, set by PIIGHOST_CONTENT.
 */
import { resolve } from 'node:path';
import { homedir } from 'node:os';

/** The piighost checkout the pages are read from. */
export const CONTENT_ROOT = resolve(
	process.env.PIIGHOST_CONTENT ?? resolve(homedir(), 'piighost-besoins')
);

/** The repository and branch the edit links point at. */
export const REPOSITORY = 'https://github.com/Athroniaeth/piighost';
export const BRANCH = process.env.PIIGHOST_BRANCH ?? 'master';

/** The languages of the technical guide. The wiki is French for now. */
export const LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Diagrams are written into static/ so the dev server and the build both serve them. */
export const DIAGRAMS_DIR = resolve('static/diagrams');
export const DIAGRAMS_URL = '/diagrams';

/** The Chromium mermaid-cli drives; the one Playwright installed, unless told otherwise. */
export const CHROMIUM_PATH =
	process.env.CHROMIUM_PATH ??
	resolve(homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
