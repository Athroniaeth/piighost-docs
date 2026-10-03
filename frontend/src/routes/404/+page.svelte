<!-- nginx answers any unknown path with this page and a 404 status. The
     language of a missing page is unknown, so the page speaks both. -->
<svelte:head>
	<title>Page introuvable · Page not found · piighost</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main id="content" class="mx-auto max-w-3xl space-y-10 px-6 py-20">
	<p class="font-mono text-sm text-muted-foreground">404</p>
	<section lang="fr" class="space-y-3">
		<h1 class="text-3xl font-bold tracking-tight">Cette page n’existe pas.</h1>
		<p class="text-muted-foreground">
			Elle a peut-être changé d’adresse. La recherche en haut de la page retrouve un titre ou un
			identifiant de règle, comme BR-MSG-05.
		</p>
		<p class="flex flex-wrap gap-x-6 gap-y-2">
			<a class="text-primary underline-offset-4 hover:underline" href="/fr/guide/">Le guide</a>
			<a class="text-primary underline-offset-4 hover:underline" href="/fr/wiki/quickstart/"
				>Le wiki métier</a
			>
		</p>
	</section>
	<section lang="en" class="space-y-3">
		<h2 class="text-3xl font-bold tracking-tight">This page does not exist.</h2>
		<p class="text-muted-foreground">
			It may have moved. The search at the top of the page finds a title or a rule identifier, such
			as BR-MSG-05.
		</p>
		<p class="flex flex-wrap gap-x-6 gap-y-2">
			<a class="text-primary underline-offset-4 hover:underline" href="/en/guide/">The guide</a>
			<a class="text-primary underline-offset-4 hover:underline" href="/en/wiki/quickstart/"
				>The business wiki</a
			>
		</p>
	</section>
</main>
