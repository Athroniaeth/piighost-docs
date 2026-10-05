<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import {
		Button,
		GithubIcon,
		LangMenu,
		SiteFooter,
		SiteNav,
		ThemeToggle,
		ecosystemLinks
	} from '@piighost/ui';
	import Search from '#lib/components/Search.svelte';
	import { labels } from '#lib/i18n.js';
	import { PUBLIC_CHAT_URL } from '$app/env/public';

	let { children } = $props();

	/** The chatbot, Chainlit's copilot widget, when the build names its server. */
	const chatUrl = PUBLIC_CHAT_URL;

	const lang = $derived(page.url.pathname.startsWith('/en') ? 'en' : 'fr');
	const t = $derived(labels(lang));
	const space = $derived(page.url.pathname.split('/')[2]);
	const alternate = $derived((page.data as { alternate?: string }).alternate);

	/** The ecosystem menu every piighost header shares, without the philosophy and the registry. */
	const links = $derived(
		ecosystemLinks('docs', lang, ['philosophy', 'hub']).map((link) =>
			// The docs link stays on this site, whatever host serves it.
			link.label === 'Docs' ? { ...link, href: `/${lang}/` } : link
		)
	);

	/** The docs' own switch, technical or domain documentation. */
	const local = $derived([
		{ href: `/${lang}/guide/`, label: t.guideShort, current: space === 'guide' },
		{ href: `/${lang}/domain/quickstart/`, label: t.domainShort, current: space === 'domain' }
	]);

	/**
	 * Place the card of an identifier that sits in a table, fixed to the window
	 * (app.css), under its link, or above it near the bottom of the window.
	 */
	function placeCard(event: Event) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const link = target.closest('table .group\\/id');
		const card = link?.querySelector<HTMLElement>('[role="tooltip"]');
		if (!link || !card) return;
		// The card keeps its 0.375rem top margin: below, it already makes the gap.
		const box = link.getBoundingClientRect();
		const gap = 6;
		const margin = 8;
		const fits = box.bottom + gap + card.offsetHeight + margin <= window.innerHeight;
		const top = fits ? box.bottom : box.top - card.offsetHeight - 2 * gap;
		card.style.top = `${Math.max(margin, top)}px`;
		card.style.left = `${Math.max(margin, Math.min(box.left, window.innerWidth - card.offsetWidth - margin))}px`;
	}

	const locales = $derived([
		{
			code: 'fr' as const,
			name: 'Français',
			href: lang === 'fr' ? page.url.pathname : (alternate ?? '/fr/')
		},
		{
			code: 'en' as const,
			name: 'English',
			href: lang === 'en' ? page.url.pathname : (alternate ?? '/en/')
		}
	]);
</script>

<svelte:document onpointerover={placeCard} onfocusin={placeCard} />

<svelte:head>
	{#if chatUrl}
		<script src="/chat-widget.js" data-server={chatUrl} defer></script>
	{/if}
</svelte:head>

<a
	href="#content"
	class="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>{lang === 'fr' ? 'Aller au contenu' : 'Skip to content'}</a
>

{#snippet controls()}
	<Button
		variant="ghost"
		size="icon"
		href="https://github.com/Athroniaeth/piighost"
		target="_blank"
		rel="noreferrer"
		aria-label={t.github}><GithubIcon class="size-5" /></Button
	>
	<ThemeToggle label={t.toggleTheme} />
	<LangMenu current={lang} label={t.language} {locales} />
{/snippet}

<SiteNav
	homeHref="/{lang}/"
	surface="docs"
	{links}
	{local}
	localStyle="segmented"
	menuActions={controls}
	mainNavigationLabel={t.mainNavigation}
	menuLabel={t.menu}
>
	{#snippet actions()}
		<Search {lang} />
		<span class="hidden items-center gap-1 lg:flex">{@render controls()}</span>
	{/snippet}
</SiteNav>

{@render children()}

<SiteFooter
	tagline={t.tagline}
	columns={[
		{
			title: 'Documentation',
			links: [
				{ href: `/${lang}/guide/`, label: t.guide },
				{ href: `/${lang}/domain/quickstart/`, label: t.domain }
			]
		},
		{
			title: t.ecosystem,
			links: [
				{ href: 'https://piighost.dev', label: 'piighost.dev', external: true },
				{ href: 'https://hub.piighost.dev', label: 'hub.piighost.dev', external: true }
			]
		},
		{
			title: t.code,
			links: [
				{ href: 'https://github.com/Athroniaeth/piighost', label: 'GitHub', external: true },
				{ href: 'https://pypi.org/project/piighost/', label: 'PyPI', external: true }
			]
		}
	]}
	legal={t.license}
/>
