<script lang="ts">
	import { labels, type Lang } from '#lib/i18n.js';
	import { OG_IMAGE, OG_LOCALE, SITE_URL, jsonLd, ogImageUrl } from '#lib/seo.js';

	/**
	 * The head every page shares: its title and description, its canonical
	 * address, the card a shared link shows, and what search engines read
	 * besides the text.
	 */
	let {
		lang,
		title,
		description,
		route,
		type = 'article',
		translated = true,
		markdownUrl,
		noindex = false,
		structured
	}: {
		lang: Lang;
		/** The whole title, suffix included. */
		title: string;
		description: string;
		/** The canonical route, from the root, with its trailing slash. */
		route: string;
		/** `website` for a home, `article` for a page. */
		type?: 'website' | 'article';
		/** The page exists in the other language too. */
		translated?: boolean;
		/** The page's Markdown export, announced for the assistants that read it. */
		markdownUrl?: string;
		/** Followed but kept out of the index: a thin page. */
		noindex?: boolean;
		/** The schema.org data of the page, one block. */
		structured?: unknown;
	} = $props();

	const url = $derived(`${SITE_URL}${route}`);
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if noindex}<meta name="robots" content="noindex, follow" />{/if}
	<link rel="canonical" href={url} />
	{#if markdownUrl}
		<link rel="alternate" type="text/markdown" href="{SITE_URL}{markdownUrl}" />
	{/if}
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content="piighost" />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={title} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:locale" content={OG_LOCALE[lang]} />
	{#if translated}
		<meta property="og:locale:alternate" content={OG_LOCALE[lang === 'fr' ? 'en' : 'fr']} />
	{/if}
	<meta property="og:image" content={ogImageUrl(lang)} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content={String(OG_IMAGE.width)} />
	<meta property="og:image:height" content={String(OG_IMAGE.height)} />
	<meta property="og:image:alt" content={labels(lang).ogImageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	{#if structured}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- our own data, serialised with every < escaped (seo.ts) -->
		{@html jsonLd(structured)}
	{/if}
</svelte:head>
