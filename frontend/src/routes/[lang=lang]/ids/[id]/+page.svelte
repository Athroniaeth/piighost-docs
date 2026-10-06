<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import FileCode from '@lucide/svelte/icons/file-code';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Workflow from '@lucide/svelte/icons/workflow';
	import { SidebarTree } from '@piighost/ui';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CopyPageMenu from '#lib/components/CopyPageMenu.svelte';
	import FoldedPanel from '#lib/components/FoldedPanel.svelte';
	import SeoHead from '#lib/components/SeoHead.svelte';
	import { labels } from '#lib/i18n.js';
	import { CARD_TEXT } from '#lib/card-text.js';

	/**
	 * The card of an identifier, the URL to cite, inside the domain
	 * documentation: what it says, where it is written, and for a rule where it
	 * lives in the code and which tests reach it.
	 */
	let { data } = $props();

	const lang = $derived(data.route.startsWith('/en/') ? 'en' : 'fr');
	const t = $derived(labels(lang));
	const c = $derived(CARD_TEXT[lang]);
	const entry = $derived(data.entry);
	const trace = $derived(entry.trace);
	const isRule = $derived(entry.id.startsWith('BR-'));
	const tested = $derived(trace ? trace.tests.length + trace.indirectTests.length > 0 : false);
	const SHOWN = 12;
</script>

<!-- A card is a thin page, the address to cite: followed, kept out of the index. -->
<SeoHead
	{lang}
	title="{entry.id} · piighost"
	description={data.description}
	route={data.route}
	markdownUrl={data.markdownUrl}
	noindex
/>

<svelte:head>
	<link
		rel="alternate"
		hreflang={lang === 'fr' ? 'en' : 'fr'}
		href="https://docs.piighost.dev{data.alternate}"
	/>
	<link rel="alternate" hreflang={lang} href="https://docs.piighost.dev{data.route}" />
</svelte:head>

{#snippet list(
	title: string,
	Icon: typeof FileCode,
	refs: { label: string; href: string }[],
	empty: string,
	hint?: string
)}
	<section class="space-y-2">
		<h2 class="flex items-center gap-2 text-lg font-semibold">
			<Icon class="size-4 text-primary" aria-hidden="true" />{title}
			<span class="font-mono text-sm font-normal text-muted-foreground">{refs.length}</span>
		</h2>
		{#if hint}<p class="text-sm text-muted-foreground">{hint}</p>{/if}
		{#if refs.length === 0}
			<p class="text-sm text-muted-foreground">{empty}</p>
		{:else}
			<ul class="grid gap-1">
				{#each refs.slice(0, SHOWN) as ref (ref.label)}
					<li>
						<a
							href={ref.href}
							target="_blank"
							rel="noreferrer"
							class="block rounded-md px-2 py-1 font-mono text-sm break-all hover:bg-muted"
							>{ref.label}</a
						>
					</li>
				{/each}
			</ul>
			{#if refs.length > SHOWN}
				<p class="px-2 text-sm text-muted-foreground">{c.more(refs.length - SHOWN)}</p>
			{/if}
		{/if}
	</section>
{/snippet}

<div
	class="mx-auto grid max-w-[84rem] gap-8 px-6 py-8 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_12rem]"
>
	<aside class="hidden lg:block" aria-label={t.domain}>
		<div class="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pe-2 pb-8">
			<p class="mb-3 px-2 text-xs font-semibold text-muted-foreground">{t.domain}</p>
			<SidebarTree nodes={data.nav} current={entry.page} />
		</div>
	</aside>

	<main id="content" class="feuille min-w-0 space-y-8 pb-24 lg:pb-0">
		<div class="space-y-4" data-pagefind-ignore>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<Breadcrumbs items={data.breadcrumbs} label={t.breadcrumb} />
				<CopyPageMenu markdownUrl={data.markdownUrl} {lang} />
			</div>
			<FoldedPanel label={t.domain} class="lg:hidden">
				<div class="max-h-[60dvh] overflow-y-auto px-2 pb-3">
					<SidebarTree nodes={data.nav} current={entry.page} />
				</div>
			</FoldedPanel>
		</div>

		<header class="space-y-3">
			<p class="font-mono text-sm text-primary">{c.card} {entry.id}</p>
			<h1 class="text-xl leading-relaxed font-normal">{entry.summary}</h1>
			<p class="text-sm text-muted-foreground">
				{c.definedIn}
				<a
					class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
					href={entry.href}>{entry.title}<ArrowRight class="size-4" aria-hidden="true" /></a
				>
			</p>
		</header>

		{#if isRule}
			{#if trace}
				<div class="grid min-w-0 gap-8 rounded-lg border bg-card p-6">
					{@render list(c.lives, FileCode, trace.implementations, c.livesEmpty)}
					{#if tested}
						{@render list(c.direct, FlaskConical, trace.tests, c.directEmpty, c.directHint)}
						{@render list(
							c.indirect,
							FlaskConical,
							trace.indirectTests,
							c.indirectEmpty,
							c.indirectHint
						)}
					{:else}
						<section class="space-y-2">
							<h2 class="flex items-center gap-2 text-lg font-semibold">
								<FlaskConical class="size-4 text-primary" aria-hidden="true" />{c.tests}
							</h2>
							<p class="text-sm text-muted-foreground">{c.untested}</p>
						</section>
					{/if}
					{@render list(c.usedBy, Workflow, trace.callers, c.usedByEmpty)}
				</div>
				<p class="text-sm text-muted-foreground">{c.source}</p>
			{:else}
				<p class="text-sm text-muted-foreground">{c.noPlace}</p>
			{/if}
		{/if}
	</main>
</div>
