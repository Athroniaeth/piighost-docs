<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Copy from '@lucide/svelte/icons/copy';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { closeOnOutside } from '@piighost/ui';

	/**
	 * Copy the page as Markdown for an assistant, the main action, and a menu to
	 * open the Markdown or hand the page to an assistant directly. At the top of
	 * the page, beside the breadcrumb, where a reader looks for it.
	 */
	let {
		markdownUrl,
		lang
	}: {
		/** The page's Markdown export, a path on this site. */
		markdownUrl: string;
		lang: 'fr' | 'en';
	} = $props();

	const TEXT = {
		fr: {
			copy: 'Copier la page',
			copied: 'Copiée',
			more: 'Autres actions sur la page',
			view: 'Voir en Markdown',
			viewHint: 'Le texte brut de la page',
			open: 'Ouvrir dans',
			openHint: 'Poser vos questions sur cette page',
			prompt: (url: string) =>
				`Lis ${url} puis réponds à mes questions sur cette page de la documentation de piighost.`
		},
		en: {
			copy: 'Copy page',
			copied: 'Copied',
			more: 'More page actions',
			view: 'View as Markdown',
			viewHint: 'The page as plain text',
			open: 'Open in',
			openHint: 'Ask questions about this page',
			prompt: (url: string) =>
				`Read ${url} then answer my questions about this page of the piighost documentation.`
		}
	} as const;

	const t = $derived(TEXT[lang]);

	/** The published address: an assistant fetches the page from the live site. */
	const absolute = $derived(`https://docs.piighost.dev${markdownUrl}`);

	const assistants = $derived(
		[
			['ChatGPT', 'https://chatgpt.com/?q='],
			['Claude', 'https://claude.ai/new?q='],
			['Le Chat', 'https://chat.mistral.ai/chat?q=']
		].map(([name, base]) => ({ name, href: base + encodeURIComponent(t.prompt(absolute)) }))
	);

	let copied = $state(false);

	async function copyMarkdown() {
		const response = await fetch(markdownUrl);
		await navigator.clipboard.writeText(await response.text());
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const ITEM =
		'flex items-start gap-2.5 rounded-md px-2.5 py-2 text-popover-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50';
</script>

<div class="relative inline-flex rounded-lg border bg-background">
	<button
		type="button"
		onclick={copyMarkdown}
		class="inline-flex h-8 items-center gap-1.5 rounded-s-lg px-3 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
	>
		{#if copied}<Check class="size-4" />{t.copied}{:else}<Copy class="size-4" />{t.copy}{/if}
	</button>
	<details class="group" {@attach closeOnOutside}>
		<summary
			aria-label={t.more}
			class="inline-flex h-8 cursor-pointer list-none items-center rounded-e-lg border-s px-2 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<ChevronDown class="size-4 transition-transform group-open:rotate-180" />
		</summary>
		<ul
			class="absolute right-0 z-40 mt-1.5 grid w-[17rem] gap-0.5 rounded-lg border bg-popover p-1 shadow-lg"
		>
			<li>
				<!-- A file, not a page: rel="external" makes the router load it. -->
				<a href={markdownUrl} target="_blank" rel="external noopener" class={ITEM}>
					<FileText class="mt-0.5 size-4 shrink-0" />
					<span class="grid">
						<span class="text-sm font-medium">{t.view}</span>
						<span class="text-xs text-muted-foreground">{t.viewHint}</span>
					</span>
				</a>
			</li>
			{#each assistants as assistant (assistant.name)}
				<li>
					<a href={assistant.href} target="_blank" rel="noreferrer" class={ITEM}>
						<MessageSquare class="mt-0.5 size-4 shrink-0" />
						<span class="grid">
							<span class="text-sm font-medium">{t.open} {assistant.name}</span>
							<span class="text-xs text-muted-foreground">{t.openHint}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</details>
</div>
