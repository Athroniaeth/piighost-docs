/**
 * Build-time syntax highlighting into the `tok-*` classes of @piighost/ui.
 *
 * Shiki tokenises with real TextMate grammars, but it writes colours as inline
 * styles, which `style-src 'self'` refuses. So it runs with a sentinel theme:
 * each Primer role (comment, string, keyword, constant, entity, base) gets a
 * colour no real theme uses, and each sentinel is read back as a class name.
 * The page then carries only classes, coloured by ui.css in both themes.
 */
import { createHighlighter, type Highlighter } from 'shiki';
import type { Token } from '@piighost/ui/utils';

const ROLES: Record<string, string> = {
	'#000001': 'comment',
	'#000002': 'string',
	'#000003': 'keyword',
	'#000004': 'constant',
	'#000005': 'entity',
	'#000006': 'base'
};

const SENTINEL_THEME = {
	name: 'piighost-sentinel',
	type: 'dark' as const,
	colors: { 'editor.foreground': '#000006', 'editor.background': '#000000' },
	tokenColors: [
		{ scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#000001' } },
		{
			scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'],
			settings: { foreground: '#000002' }
		},
		{
			scope: [
				'keyword',
				'storage',
				'storage.type',
				'storage.modifier',
				'keyword.operator.logical',
				'keyword.operator.word',
				'keyword.control'
			],
			settings: { foreground: '#000003' }
		},
		{
			scope: [
				'constant',
				'constant.numeric',
				'constant.language',
				'constant.character',
				'variable.other.constant',
				'support.constant',
				'variable.parameter.function.language.special',
				'support.type.property-name',
				'entity.name.tag.toml',
				'meta.object-literal.key',
				'variable.other.readwrite.alias'
			],
			settings: { foreground: '#000004' }
		},
		{
			scope: [
				'entity.name.function',
				'support.function',
				'entity.name.type',
				'entity.name.class',
				'support.class',
				'entity.other.inherited-class',
				'entity.name.section',
				'entity.name.tag',
				'meta.function-call.generic',
				'support.function.builtin'
			],
			settings: { foreground: '#000005' }
		}
	]
};

const LANGUAGES = ['python', 'bash', 'toml', 'json', 'yaml', 'sql', 'typescript', 'javascript'];
const ALIASES: Record<string, string> = {
	sh: 'bash',
	shell: 'bash',
	console: 'bash',
	py: 'python',
	ts: 'typescript',
	js: 'javascript',
	yml: 'yaml'
};

let highlighter: Promise<Highlighter> | undefined;

function load(): Promise<Highlighter> {
	highlighter ??= createHighlighter({ themes: [SENTINEL_THEME], langs: LANGUAGES });
	return highlighter;
}

/** The tokens of a code block, or undefined for a language without grammar. */
export async function highlight(
	code: string,
	language: string | undefined
): Promise<Token[] | undefined> {
	const lang = language ? (ALIASES[language] ?? language) : undefined;
	if (!lang || !LANGUAGES.includes(lang)) return undefined;
	const shiki = await load();
	const lines = shiki.codeToTokensBase(code, {
		lang: lang as never,
		theme: SENTINEL_THEME.name as never
	});
	const tokens: Token[] = [];
	const push = (text: string, kind: string) => {
		const last = tokens[tokens.length - 1];
		if (last && last.kind === kind) last.text += text;
		else tokens.push({ text, kind });
	};
	lines.forEach((line, index) => {
		if (index > 0) push('\n', 'base');
		for (const token of line) {
			const kind = ROLES[(token.color ?? '').toLowerCase()] ?? 'base';
			push(token.content, token.content.trim() === '' ? 'base' : kind);
		}
	});
	return tokens;
}
