<script lang="ts">
	import { page } from '$app/state';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Users from '@lucide/svelte/icons/users';
	import { Card, CardGrid, InstallTabs } from '@piighost/ui';
	import { labels } from '#lib/i18n.js';

	const lang = $derived(page.params.lang === 'en' ? 'en' : 'fr');
	const t = $derived(labels(lang));

	const profiles = $derived(
		lang === 'fr'
			? [
					{
						title: 'Responsable conformité',
						text: 'Aucune donnée confidentielle ne part en clair, et vous pouvez le prouver.',
						href: '/fr/guide/dpia/',
						link: 'Documenter une AIPD'
					},
					{
						title: 'Développeur',
						text: 'La protection s’ajoute à votre agent sans réécrire sa logique.',
						href: '/fr/guide/getting-started/langchain/',
						link: 'Protéger un agent LangChain'
					},
					{
						title: 'Exploitant',
						text: 'Un serveur partagé, une mémoire chiffrée, des secrets hors des fichiers.',
						href: '/fr/guide/getting-started/api-server/',
						link: 'Déployer une API de dé-identification'
					},
					{
						title: 'Utilisateur de l’application',
						text: 'Il lit ses vraies informations et ne voit jamais un jeton.',
						href: '/fr/wiki/besoins-par-profil/#utilisateur-de-lapplication',
						link: 'Ses besoins'
					}
				]
			: [
					{
						title: 'Compliance officer',
						text: 'No confidential data leaves in clear, and you can prove it.',
						href: '/en/guide/dpia/',
						link: 'Document a DPIA'
					},
					{
						title: 'Developer',
						text: 'The protection joins your agent without rewriting its logic.',
						href: '/en/guide/getting-started/langchain/',
						link: 'Protect a LangChain agent'
					},
					{
						title: 'Operator',
						text: 'A shared server, an encrypted memory, secrets kept out of files.',
						href: '/en/guide/getting-started/api-server/',
						link: 'Deploy a de-identification API'
					},
					{
						title: 'Application user',
						text: 'They read their real information and never see a token.',
						href: '/fr/wiki/besoins-par-profil/#utilisateur-de-lapplication',
						link: 'Their needs (French)'
					}
				]
	);
</script>

<svelte:head>
	<title>{t.homeTitle}</title>
	<meta name="description" content={t.homeLead} />
	<link rel="canonical" href="https://docs.piighost.dev/{lang}/" />
	<link rel="alternate" hreflang="fr" href="https://docs.piighost.dev/fr/" />
	<link rel="alternate" hreflang="en" href="https://docs.piighost.dev/en/" />
</svelte:head>

<main id="content" class="mx-auto max-w-5xl space-y-14 px-6 py-14">
	<header class="feuille space-y-5">
		<h1 class="text-4xl font-bold tracking-[-0.02em] sm:text-5xl">{t.homeTitle}</h1>
		<p class="max-w-2xl text-lg text-muted-foreground">{t.homeLead}</p>
		<div class="max-w-md"><InstallTabs copyLabel={t.copy} copiedLabel={t.copied} /></div>
	</header>

	<section class="grid gap-4 md:grid-cols-2">
		<a
			href="/{lang}/guide/"
			class="group flex flex-col gap-2 rounded-lg border bg-card p-6 transition-colors hover:border-primary"
		>
			<BookOpen class="size-6 text-primary" aria-hidden="true" />
			<span class="text-xl font-semibold">{t.guide}</span>
			<span class="text-sm text-muted-foreground">{t.guideDescription}</span>
		</a>
		<a
			href="/fr/wiki/quickstart/"
			class="group flex flex-col gap-2 rounded-lg border bg-card p-6 transition-colors hover:border-primary"
		>
			<Users class="size-6 text-primary" aria-hidden="true" />
			<span class="text-xl font-semibold">{t.wiki}</span>
			<span class="text-sm text-muted-foreground">{t.wikiDescription}</span>
		</a>
	</section>

	<section class="space-y-4">
		<h2 class="text-2xl font-bold">{lang === 'fr' ? 'Selon votre profil' : 'By profile'}</h2>
		<CardGrid>
			{#each profiles as profile (profile.title)}
				<Card title={profile.title} href={profile.href} linkLabel={profile.link}
					><p>{profile.text}</p></Card
				>
			{/each}
		</CardGrid>
	</section>
</main>
