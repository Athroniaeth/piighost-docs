<script lang="ts">
	import { Content, PageActions, PrevNext, SidebarTree, Toc } from '@piighost/ui';
	import { labels } from '#lib/i18n.js';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CopyPageMenu from '#lib/components/CopyPageMenu.svelte';
	import FoldedPanel from '#lib/components/FoldedPanel.svelte';

	let { data } = $props();

	const lang = $derived(data.page.route.startsWith('/en/') ? 'en' : 'fr');
	const t = $derived(labels(lang));
	const isDomain = $derived(data.page.route.includes('/domain/'));
	// The guide's home is titled "piighost": the tab names the space instead
	// of "piighost · piighost".
	const title = $derived(
		data.page.title.trim().toLowerCase() === 'piighost'
			? `${isDomain ? t.domain : t.guide} · piighost`
			: `${data.page.title} · piighost`
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={data.page.description} />
	<link rel="canonical" href="https://docs.piighost.dev{data.page.route}" />
	{#if data.alternate}
		<link
			rel="alternate"
			hreflang={lang === 'fr' ? 'en' : 'fr'}
			href="https://docs.piighost.dev{data.alternate}"
		/>
		<link rel="alternate" hreflang={lang} href="https://docs.piighost.dev{data.page.route}" />
	{/if}
	<meta property="og:title" content={title} />
	<meta property="og:description" content={data.page.description} />
</svelte:head>

<div
	class="mx-auto grid max-w-[84rem] gap-8 px-6 py-8 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_12rem]"
>
	<aside class="hidden lg:block" aria-label={isDomain ? t.domain : t.guide}>
		<div class="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pe-2 pb-8">
			<p class="mb-3 px-2 text-xs font-semibold text-muted-foreground">
				{isDomain ? t.domain : t.guide}
			</p>
			<SidebarTree nodes={data.nav} current={data.page.route} />
		</div>
	</aside>

	<main
		id="content"
		class="feuille min-w-0 pb-24 lg:pb-0"
		data-pagefind-body
		data-pagefind-meta="title:{data.page.title}"
	>
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3" data-pagefind-ignore>
			<Breadcrumbs items={data.page.breadcrumbs} label={t.breadcrumb} />
			<CopyPageMenu markdownUrl={data.markdownUrl} {lang} />
		</div>
		<!-- Below the widths that show the two columns, the section tree and the
		     page outline fold above the content. -->
		<div class="mb-6 grid gap-2 xl:hidden" data-pagefind-ignore>
			<FoldedPanel label={isDomain ? t.domain : t.guide} class="lg:hidden">
				<div class="max-h-[60dvh] overflow-y-auto px-2 pb-3">
					<SidebarTree nodes={data.nav} current={data.page.route} />
				</div>
			</FoldedPanel>
			{#if data.page.toc.length > 1}
				<FoldedPanel label={t.onThisPage}>
					<div class="toc-folded max-h-[60dvh] overflow-y-auto px-4 pb-3">
						<Toc entries={data.page.toc} title={t.onThisPage} />
					</div>
				</FoldedPanel>
			{/if}
		</div>
		<article class="prose-piighost">
			<Content nodes={data.page.nodes} copyLabel={t.copy} copiedLabel={t.copied} />
		</article>
		<div class="mt-10 border-t pt-6" data-pagefind-ignore>
			<PageActions
				editUrl={data.editUrl}
				issueUrl={data.issueUrl}
				labels={{
					copy: t.copyPage,
					copied: t.copied,
					view: t.viewMarkdown,
					edit: t.edit,
					issue: t.issue
				}}
			/>
		</div>
		<div class="mt-8" data-pagefind-ignore>
			<PrevNext
				previous={data.page.previous}
				next={data.page.next}
				previousLabel={t.previous}
				nextLabel={t.next}
			/>
		</div>
	</main>

	<!-- The outline ends above the chatbot's button, bottom right of the window. -->
	<aside class="hidden xl:block" data-pagefind-ignore>
		<div class="sticky top-24 max-h-[calc(100dvh-13rem)] overflow-y-auto pe-2 pb-8">
			<Toc entries={data.page.toc} title={t.onThisPage} />
		</div>
	</aside>
</div>
