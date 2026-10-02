import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// The chatbot's server, when the build embeds it: its widget script is the one
// script the pages take from another origin.
const chat = process.env.PUBLIC_CHAT_URL?.replace(/\/+$/, '') as
	`https://${string}.${string}` | undefined;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ strict: true }),
			// Prerendered pages get the policy as a meta tag, with the hash of each
			// inline bootstrap script. Only script-src goes there: nginx sends the
			// rest, since a meta tag cannot carry frame-ancestors. Pagefind
			// compiles its WebAssembly, hence wasm-unsafe-eval.
			csp: {
				mode: 'hash',
				directives: { 'script-src': ['self', 'wasm-unsafe-eval', ...(chat ? [chat] : [])] }
			},
			// Root-relative asset paths: the 404 page is served at any depth, where a
			// path relative to /404/ would point nowhere.
			paths: { relative: false },
			prerender: { handleHttpError: 'fail', handleMissingId: 'fail' }
		})
	]
});
