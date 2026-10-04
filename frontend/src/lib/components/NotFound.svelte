<script lang="ts">
	import { Button, Ghost } from '@piighost/ui';

	/**
	 * The page a reader lands on when an address leads nowhere, in one language.
	 * nginx serves it for a missing file, and +error.svelte for a navigation that
	 * fails in the browser, so both look the same.
	 */
	let { lang }: { lang: 'fr' | 'en' } = $props();

	const TEXT = {
		fr: {
			title: 'Page introuvable',
			eyebrow: 'Erreur 404',
			heading: 'Cette page n’existe pas.',
			lead: 'Elle a peut-être changé d’adresse. La recherche, en haut de la page, retrouve une page par son titre ou par un identifiant comme BR-MSG-05.',
			home: 'Retour à l’accueil',
			guide: 'Documentation technique',
			domain: 'Documentation métier'
		},
		en: {
			title: 'Page not found',
			eyebrow: 'Error 404',
			heading: 'This page does not exist.',
			lead: 'It may have moved. The search at the top of the page finds a page by its title or by an identifier such as BR-MSG-05.',
			home: 'Back to the home page',
			guide: 'Technical documentation',
			domain: 'Domain documentation'
		}
	} as const;

	const t = $derived(TEXT[lang]);
</script>

<svelte:head>
	<title>{t.title} · piighost</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	id="content"
	{lang}
	class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
>
	<Ghost class="size-[6rem]" />
	<p class="font-mono text-4xl font-medium tracking-tight sm:text-6xl">{t.eyebrow}</p>
	<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{t.heading}</h1>
	<p class="text-muted-foreground">{t.lead}</p>
	<div class="flex flex-wrap justify-center gap-3">
		<Button href="/{lang}/">{t.home}</Button>
		<Button variant="outline" href="/{lang}/guide/">{t.guide}</Button>
		<Button variant="outline" href="/{lang}/domain/quickstart/">{t.domain}</Button>
	</div>
</main>
