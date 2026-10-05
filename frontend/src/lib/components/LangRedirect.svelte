<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * A page without a language, the root or /ids/<ID>/: it leads to the
	 * reader's language. On a first load the script in the head does it before
	 * anything is drawn; after a navigation inside the site, the component does.
	 * Without script, the refresh leads to `fallback`, and the links stay.
	 */
	let {
		path,
		fallback,
		title
	}: {
		/** What follows the language, `/` or `/ids/BR-MSG-05/`. */
		path: string;
		fallback: 'fr' | 'en';
		title: string;
	} = $props();

	onMount(() => {
		const lang = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
		location.replace(`/${lang}${path}${location.search}${location.hash}`);
	});
</script>

<svelte:head>
	<title>{title}</title>
	<script src="/lang-redirect.js" data-path={path}></script>
	<noscript><meta http-equiv="refresh" content="0;url=/{fallback}{path}" /></noscript>
	<link rel="alternate" hreflang="fr" href="https://docs.piighost.dev/fr{path}" />
	<link rel="alternate" hreflang="en" href="https://docs.piighost.dev/en{path}" />
	<link rel="alternate" hreflang="x-default" href="https://docs.piighost.dev{path}" />
</svelte:head>

<main id="content" class="mx-auto max-w-3xl px-6 py-14">
	<p>
		<a class="text-primary hover:underline" href="/fr{path}">Version française</a> ·
		<a class="text-primary hover:underline" href="/en{path}">English version</a>
	</p>
</main>
