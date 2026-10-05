/**
 * Mermaid diagrams rendered at build time, one SVG per theme.
 *
 * A diagram rendered in the browser injects a <style> element, which
 * `style-src 'self'` refuses. Rendered here and loaded through <img>, its styles
 * belong to the image document and the page policy does not apply to them.
 * Each diagram is cached by the hash of its source, so a build only renders
 * the diagrams that changed.
 *
 * Mermaid writes `width="100%"` on the root element. Loaded through <img>, such
 * an SVG has no width of its own and is stretched to the column, so a diagram
 * 250 pixels wide was shown three times larger. Every render, cached ones
 * included, is given the size of its viewBox instead: the column can shrink a
 * diagram, never enlarge it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMermaid } from '@mermaid-js/mermaid-cli';
import puppeteer, { type Browser } from 'puppeteer-core';
import { CHROMIUM_PATH, DIAGRAMS_DIR, DIAGRAMS_URL } from './config';

/**
 * A diagram is measured at build time and drawn later in the reader's browser,
 * through <img>, which cannot load the site's web fonts. Labels were measured
 * in one font and drawn in another, and the wider one was cut ("detecto").
 * Arial, Liberation Sans and Helvetica share the same metrics, and every system
 * has one of them, so what is measured is what is drawn.
 */
const FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';

/** Part of each cache key: a change of font or theme renders every diagram again. */
const RENDER_VERSION = 'metric-font-1';

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

/** The SVG with its viewBox size as its width and height, and no max-width style. */
export function withIntrinsicSize(svg: string): string {
	return svg.replace(/<svg\b[^>]*>/, (tag) => {
		const box = /\sviewBox="([^"]+)"/
			.exec(tag)?.[1]
			.trim()
			.split(/[\s,]+/)
			.map(Number);
		if (!box || box.length !== 4 || !(box[2] > 0 && box[3] > 0)) return tag;
		const [width, height] = [Math.ceil(box[2]), Math.ceil(box[3])];
		return tag
			.replace(/\s(?:width|height)="[^"]*"/g, '')
			.replace(/max-width:\s*[^;"]*;?\s*/, '')
			.replace(/^<svg/, `<svg width="${width}" height="${height}"`);
	});
}

async function render(code: string, mode: keyof typeof THEMES): Promise<string> {
	const { data } = await renderMermaid(await launch(), code, 'svg', {
		backgroundColor: 'transparent',
		mermaidConfig: { ...THEMES[mode], securityLevel: 'strict' } as never
	});
	return new TextDecoder().decode(data);
}

/** A diagram's two renders and the size of its drawing. */
export interface Diagram {
	light: string;
	dark: string;
	width: number;
	height: number;
}

/** The URLs of a diagram's two renders, rendering them when they are not cached. */
export async function renderDiagram(code: string): Promise<Diagram> {
	const hash = createHash('sha256').update(RENDER_VERSION).update(code).digest('hex').slice(0, 16);
	mkdirSync(DIAGRAMS_DIR, { recursive: true });
	const diagram = {
		light: `${DIAGRAMS_URL}/${hash}-light.svg`,
		dark: `${DIAGRAMS_URL}/${hash}-dark.svg`,
		width: 0,
		height: 0
	};
	for (const mode of ['light', 'dark'] as const) {
		const file = join(DIAGRAMS_DIR, `${hash}-${mode}.svg`);
		const cached = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
		const svg = cached ?? (await render(code, mode));
		const sized = withIntrinsicSize(svg);
		if (sized !== cached) writeFileSync(file, sized);
		const size = /^<svg width="(\d+)" height="(\d+)"/.exec(sized);
		if (size) [diagram.width, diagram.height] = [Number(size[1]), Number(size[2])];
	}
	return diagram;
}
