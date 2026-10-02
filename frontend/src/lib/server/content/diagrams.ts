/**
 * Mermaid diagrams rendered at build time, one SVG per theme.
 *
 * A diagram rendered in the browser injects a <style> element, which
 * `style-src 'self'` refuses. Rendered here and loaded through <img>, its styles
 * belong to the image document and the page policy does not apply to them.
 * Each diagram is cached by the hash of its source, so a build only renders
 * the diagrams that changed.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMermaid } from '@mermaid-js/mermaid-cli';
import puppeteer, { type Browser } from 'puppeteer-core';
import { CHROMIUM_PATH, DIAGRAMS_DIR, DIAGRAMS_URL } from './config';

const FONT = '"Schibsted Grotesk Variable", "Schibsted Grotesk", system-ui, sans-serif';

const THEMES = {
	light: {
		theme: 'base',
		themeVariables: {
			fontFamily: FONT,
			primaryColor: '#eef0f6',
			primaryBorderColor: '#5b4ee0',
			primaryTextColor: '#1d2126',
			lineColor: '#6b7280',
			secondaryColor: '#f3f4f6',
			tertiaryColor: '#ffffff'
		}
	},
	dark: {
		theme: 'base',
		themeVariables: {
			darkMode: true,
			fontFamily: FONT,
			primaryColor: '#1d2230',
			primaryBorderColor: '#8f86ff',
			primaryTextColor: '#e6e8eb',
			lineColor: '#9aa3ad',
			secondaryColor: '#1a1d22',
			tertiaryColor: '#14171b',
			noteBkgColor: '#232733',
			noteTextColor: '#e6e8eb'
		}
	}
} as const;

let browser: Promise<Browser> | undefined;

function launch(): Promise<Browser> {
	browser ??= puppeteer.launch({
		executablePath: CHROMIUM_PATH,
		headless: true,
		args: ['--no-sandbox']
	});
	return browser;
}

/** Close the browser once the build is done with diagrams. */
export async function closeDiagrams() {
	if (browser) (await browser).close();
	browser = undefined;
}

/** The URLs of a diagram's two renders, rendering them when they are not cached. */
export async function renderDiagram(code: string): Promise<{ light: string; dark: string }> {
	const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
	mkdirSync(DIAGRAMS_DIR, { recursive: true });
	const urls = {
		light: `${DIAGRAMS_URL}/${hash}-light.svg`,
		dark: `${DIAGRAMS_URL}/${hash}-dark.svg`
	};
	for (const mode of ['light', 'dark'] as const) {
		const file = join(DIAGRAMS_DIR, `${hash}-${mode}.svg`);
		if (existsSync(file)) continue;
		const { data } = await renderMermaid(await launch(), code, 'svg', {
			backgroundColor: 'transparent',
			mermaidConfig: { ...THEMES[mode], securityLevel: 'strict' } as never
		});
		writeFileSync(file, data);
	}
	return urls;
}
