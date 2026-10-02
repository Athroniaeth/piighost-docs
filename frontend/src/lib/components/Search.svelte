<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from '@piighost/ui';
	import { labels } from '#lib/i18n.js';

	/**
	 * Full-text search over the prerendered pages, ⌘K or Ctrl+K.
	 *
	 * Pagefind indexes the built site after the prerender, one index per page
	 * language, and loads only the fragments a query needs. A native <dialog>
	 * gives focus trapping and Escape. Excerpts arrive with <mark> tags: they are
	 * split into text runs here rather than injected as HTML.
	 */
	let { lang }: { lang: 'fr' | 'en' } = $props();

	const t = $derived(labels(lang));

	interface Result {
		url: string;
		title: string;
		excerpt: { text: string; mark: boolean }[];
	}

	interface Pagefind {
		search: (query: string) => Promise<{
			results: {
				data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }>;
			}[];
		}>;
	}

	let dialog = $state<HTMLDialogElement | null>(null);
	let query = $state('');
	let results = $state<Result[]>([]);
	let unavailable = $state(false);
	let pagefind: Pagefind | undefined;

	function open() {
		dialog?.showModal();
	}

	function onkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			open();
		}
	}

	/** Split a Pagefind excerpt into text runs, the <mark> ones flagged. */
	function runs(excerpt: string): Result['excerpt'] {
		const decode = (text: string) =>
			text
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'")
				.replace(/&amp;/g, '&');
		return excerpt
			.split(/(<mark>.*?<\/mark>)/)
			.filter(Boolean)
			.map((part) =>
				part.startsWith('<mark>')
					? { text: decode(part.slice(6, -7)), mark: true }
					: { text: decode(part.replace(/<[^>]+>/g, '')), mark: false }
			);
	}

	async function search(event: Event & { currentTarget: HTMLInputElement }) {
		query = event.currentTarget.value;
		if (!query.trim()) {
			results = [];
			return;
		}
		try {
			const index = '/pagefind/pagefind.js';
			pagefind ??= (await import(/* @vite-ignore */ index)) as Pagefind;
		} catch {
			unavailable = true;
			return;
		}
		const found = await pagefind.search(query);
		const data = await Promise.all(found.results.slice(0, 8).map((result) => result.data()));
		results = data.map((item) => ({
			url: item.url,
			title: item.meta.title ?? item.url,
			excerpt: runs(item.excerpt)
		}));
	}
</script>

<svelte:window {onkeydown} />

<Button variant="ghost" size="icon" onclick={open} aria-label="{t.search} (Ctrl+K)">
	<SearchIcon />
</Button>

<dialog
	bind:this={dialog}
	class="m-auto mt-[12vh] w-[min(40rem,92vw)] rounded-lg border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-background/70 backdrop:backdrop-blur-sm"
	aria-label={t.search}
	closedby="any"
>
	<div class="flex items-center gap-2 border-b px-4">
		<SearchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
		<input
			type="search"
			class="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
			placeholder={t.searchPlaceholder}
			value={query}
			oninput={search}
			aria-label={t.searchPlaceholder}
		/>
	</div>
	<div class="max-h-[60vh] overflow-y-auto p-2">
		{#if unavailable}
			<p class="p-3 text-sm text-muted-foreground">
				{lang === 'fr'
					? 'L’index est construit avec le site : lancez un build.'
					: 'The index is built with the site: run a build.'}
			</p>
		{:else if query && results.length === 0}
			<p class="p-3 text-sm text-muted-foreground">{t.noResult}</p>
		{/if}
		<ul class="grid gap-1">
			{#each results as result (result.url)}
				<li>
					<a
						href={result.url}
						onclick={() => dialog?.close()}
						class="block rounded-md px-3 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<span class="block font-medium">{result.title}</span>
						<span class="mt-0.5 line-clamp-2 block text-sm text-muted-foreground"
							>{#each result.excerpt as run, index (index)}{#if run.mark}<mark
										class="rounded-sm bg-primary/20 text-foreground">{run.text}</mark
									>{:else}{run.text}{/if}{/each}</span
						>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</dialog>
