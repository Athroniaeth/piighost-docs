<script lang="ts">
	import { page } from '$app/state';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Users from '@lucide/svelte/icons/users';
	import CodeXml from '@lucide/svelte/icons/code-xml';
	import Scale from '@lucide/svelte/icons/scale';
	import Server from '@lucide/svelte/icons/server';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { Card, CardGrid, InstallTabs } from '@piighost/ui';
	import { labels } from '#lib/i18n.js';

	const lang = $derived(page.params.lang === 'en' ? 'en' : 'fr');
	const t = $derived(labels(lang));

	/** Who expects what from piighost is business content: each card opens its
	 *  section of the needs page in the reader's language, which links on to the
	 *  guide pages of that profile. The icon names the profile: the law, the
	 *  code, the server, the person. */
	const NEEDS = $derived(`/${lang}/domain/needs-by-profile/#`);
	const profiles = $derived(
		lang === 'fr'
			? [
					{
						title: 'Responsable conformité',
						icon: Scale,
						text: 'Aucune donnée confidentielle ne part en clair, et vous pouvez le prouver.',
						href: `${NEEDS}responsable-conformité-dpo`,
						link: 'Vos besoins'
					},
					{
						title: 'Développeur',
						icon: CodeXml,
						text: 'La protection s’ajoute à votre agent sans réécrire sa logique.',
						href: `${NEEDS}développeur`,
						link: 'Vos besoins'
					},
					{
						title: 'Exploitant',
						icon: Server,
						text: 'Un serveur partagé, une mémoire chiffrée, des secrets hors des fichiers.',
						href: `${NEEDS}exploitant`,
						link: 'Vos besoins'
					},
					{
						title: 'Utilisateur de l’application',
						icon: UserRound,
						text: 'Il lit ses vraies informations et ne voit jamais un jeton.',
						href: `${NEEDS}utilisateur-de-lapplication`,
						link: 'Ses besoins'
					}
				]
			: [
					{
						title: 'Compliance officer',
						icon: Scale,
						text: 'No confidential data leaves in clear, and you can prove it.',
						href: `${NEEDS}compliance-officer-dpo`,
						link: 'Your needs'
					},
					{
						title: 'Developer',
						icon: CodeXml,
						text: 'The protection joins your agent without rewriting its logic.',
						href: `${NEEDS}developer`,
						link: 'Your needs'
					},
					{
						title: 'Operator',
						icon: Server,
						text: 'A shared server, an encrypted memory, secrets kept out of files.',
						href: `${NEEDS}operator`,
						link: 'Your needs'
					},
					{
						title: 'Application user',
						icon: UserRound,
						text: 'They read their real information and never see a token.',
						href: `${NEEDS}application-user`,
						link: 'Their needs'
					}
				]
	);
</script>

<svelte:head>
	<title>{t.homeTitle} · piighost</title>
	<meta name="description" content={t.homeLead} />
	<link rel="canonical" href="https://docs.piighost.dev/{lang}/" />
	<link rel="alternate" hreflang="fr" href="https://docs.piighost.dev/fr/" />
	<link rel="alternate" hreflang="en" href="https://docs.piighost.dev/en/" />
	<!-- The root picks the reader's language. -->
	<link rel="alternate" hreflang="x-default" href="https://docs.piighost.dev/" />
</svelte:head>

<!-- One centred column, as wide as the reading text, like the philosophy page. -->
<main id="content" class="feuille mx-auto max-w-3xl space-y-14 px-6 py-14">
	<header class="space-y-5">
		<!-- The philosophy page's heading: an eyebrow, a centred title, room below. -->
		<div class="pb-7 text-center">
			<p class="mb-2 text-sm font-semibold tracking-wide text-primary">{t.homeEyebrow}</p>
			<h1 class="text-4xl font-bold tracking-tight">{t.homeTitle}</h1>
		</div>
		<div class="space-y-3 leading-7 text-muted-foreground">
			<p class="text-lg leading-relaxed">{t.homeLead}</p>
			<p>{t.homeTwoDocs}</p>
			<ul class="list-disc space-y-1 pl-6">
				<li><strong class="text-foreground">{t.guideArticle}</strong>, {t.homeGuideItem}</li>
				<li><strong class="text-foreground">{t.domainArticle}</strong>, {t.homeDomainItem}</li>
			</ul>
			<p>{t.homeNewPractice}</p>
			<p>
				{t.homeWhyBefore}
				<a
					class="font-medium text-primary underline-offset-4 hover:underline"
					href="/{lang}/guide/why-anonymize/">{t.homeWhy}</a
				>
				{t.homeWhyText}
			</p>
		</div>
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
			href="/{lang}/domain/quickstart/"
			class="group flex flex-col gap-2 rounded-lg border bg-card p-6 transition-colors hover:border-primary"
		>
			<Users class="size-6 text-primary" aria-hidden="true" />
			<span class="text-xl font-semibold">{t.domain}</span>
			<span class="text-sm text-muted-foreground">{t.domainDescription}</span>
		</a>
	</section>

	<section class="space-y-4">
		<h2 class="text-2xl font-bold">{lang === 'fr' ? 'Selon votre profil' : 'By profile'}</h2>
		<CardGrid>
			{#each profiles as profile (profile.title)}
				<Card title={profile.title} href={profile.href} linkLabel={profile.link}>
					{#snippet icon()}<profile.icon
							class="size-5 shrink-0 text-primary"
							aria-hidden="true"
						/>{/snippet}
					<p>{profile.text}</p>
				</Card>
			{/each}
		</CardGrid>
	</section>
</main>
