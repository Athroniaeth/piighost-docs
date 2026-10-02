<script lang="ts">
	import { Breadcrumbs, Content, PageActions, PrevNext, SidebarTree, Toc } from '@piighost/ui';
	import { labels } from '#lib/i18n.js';

	let { data } = $props();

	const lang = $derived(data.page.route.startsWith('/en/') ? 'en' : 'fr');
	const t = $derived(labels(lang));
	const isWiki = $derived(data.page.route.includes('/wiki/'));
</script>

<svelte:head>
	<title>{data.page.title} · piighost</title>
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
	<meta property="og:title" content="{data.page.title} · piighost" />
	<meta property="og:description" content={data.page.description} />
</svelte:head>

<div
	class="mx-auto grid max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]"
>
	<aside class="hidden lg:block" aria-label={isWiki ? t.wiki : t.guide}>
		<div class="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pe-2 pb-8">
			<p class="mb-3 px-2 text-xs font-semibold text-muted-foreground">
				{isWiki ? t.wiki : t.guide}
			</p>
			<SidebarTree nodes={data.nav} current={data.page.route} />
		</div>
	</aside>

	<main
		id="content"
		class="feuille min-w-0"
		data-pagefind-body
		data-pagefind-meta="title:{data.page.title}"
	>
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3" data-pagefind-ignore>
			<Breadcrumbs items={data.page.breadcrumbs} label={t.breadcrumb} />
		</div>
		{#if isWiki && lang === 'en'}
			<p class="mb-4 text-sm text-muted-foreground">{t.wikiInFrench}</p>
		{/if}
		<article class="prose-piighost">
			<Content nodes={data.page.nodes} copyLabel={t.copy} copiedLabel={t.copied} />
		</article>
		<div class="mt-10 border-t pt-6" data-pagefind-ignore>
			<PageActions
				markdownUrl={data.markdownUrl}
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

	<aside class="hidden xl:block" data-pagefind-ignore>
		<div class="sticky top-24">
			<Toc entries={data.page.toc} title={t.onThisPage} />
		</div>
	</aside>
</div>
