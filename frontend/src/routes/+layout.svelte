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
	import { PUBLIC_CHAT_URL, PUBLIC_OPENPANEL_CLIENT_ID } from '$app/env/public';
	import { afterNavigate } from '$app/navigation';
	import { initAnalytics, track } from '#lib/analytics.js';

	let { children } = $props();

	/** The chatbot, Chainlit's copilot widget, when the build names its server. */
	const chatUrl = PUBLIC_CHAT_URL;

	const lang = $derived(page.url.pathname.startsWith('/en') ? 'en' : 'fr');

	// One page view per page reached, the first load included. The client id
	// is baked in at build time; without one, nothing is sent.
	afterNavigate(() => {
		initAnalytics(PUBLIC_OPENPANEL_CLIENT_ID);
		track({ name: 'page_view', props: { space: page.url.pathname.split('/')[2] ?? 'home', lang } });
	});
	const t = $derived(labels(lang));
	// An identifier's card belongs to the domain documentation.
	const space = $derived.by(() => {
		const segment = page.url.pathname.split('/')[2];
		return segment === 'ids' ? 'domain' : segment;
	});

	// The server writes the language on <html> for the first page only: a
	// navigation inside the site must carry it, for screen readers, hyphenation
	// and the French spacing rules alike.
	$effect(() => {
		document.documentElement.lang = lang;
	});
	const alternate = $derived((page.data as { alternate?: string }).alternate);

	/** The ecosystem menu every piighost header shares, without the philosophy and the registry. */
	const links = $derived(
		ecosystemLinks('docs', lang, ['philosophy', 'catalog']).map((link) =>
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
	 * Keep the card of an identifier inside the window. In a table, which clips
	 * what leaves it, the card is fixed to the window (app.css) and placed under
	 * its link, or above it near the bottom of the window. Elsewhere it hangs
	 * under its link and is moved left as far as the right edge needs. Through
	 * the CSS object model, which the style policy allows.
	 */
	function placeCard(event: Event) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const link = target.closest('.group\\/id');
		const card = link?.querySelector<HTMLElement>('[role="tooltip"]');
		if (!link || !card) return;
		const margin = 8;
		if (!link.closest('table')) {
			card.style.left = '';
			const box = card.getBoundingClientRect();
			const over = box.right - (document.documentElement.clientWidth - margin);
			if (over > 0) card.style.left = `${-Math.min(over, box.left - margin)}px`;
			return;
		}
		// The card keeps its 0.375rem top margin: below, it already makes the gap.
		const box = link.getBoundingClientRect();
		const gap = 6;
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
				{ href: 'https://catalog.piighost.dev', label: 'catalog.piighost.dev', external: true }
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
