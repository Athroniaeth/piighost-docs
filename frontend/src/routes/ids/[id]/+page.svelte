<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import FileCode from '@lucide/svelte/icons/file-code';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Workflow from '@lucide/svelte/icons/workflow';

	/**
	 * The card of an identifier, the URL to cite: what it says in each language,
	 * where it is written, and for a rule where it lives in the code and which
	 * tests guard it.
	 */
	let { data } = $props();

	const entry = $derived(data.card.en);
	const french = $derived(data.card.fr);
	const trace = $derived(entry.trace);
	const isRule = $derived(entry.id.startsWith('BR-'));
	const SHOWN = 12;
</script>

<svelte:head>
	<title>{entry.id} · piighost</title>
	<meta name="description" content={entry.summary} />
	<link rel="canonical" href="https://docs.piighost.dev/ids/{entry.id}/" />
</svelte:head>

{#snippet list(
	title: string,
	Icon: typeof FileCode,
	refs: { label: string; href: string }[],
	empty: string
)}
	<section class="space-y-2">
		<h2 class="flex items-center gap-2 text-lg font-semibold">
			<Icon class="size-4 text-primary" aria-hidden="true" />{title}
			<span class="font-mono text-sm font-normal text-muted-foreground">{refs.length}</span>
		</h2>
		{#if refs.length === 0}
			<p class="text-sm text-muted-foreground">{empty}</p>
		{:else}
			<ul class="grid gap-1">
				{#each refs.slice(0, SHOWN) as ref (ref.label)}
					<li>
						<a
							href={ref.href}
							target="_blank"
							rel="noreferrer"
							class="block rounded-md px-2 py-1 font-mono text-sm break-all hover:bg-muted"
							>{ref.label}</a
						>
					</li>
				{/each}
			</ul>
			{#if refs.length > SHOWN}
				<p class="px-2 text-sm text-muted-foreground">and {refs.length - SHOWN} more</p>
			{/if}
		{/if}
	</section>
{/snippet}

<main id="content" lang="en" class="mx-auto max-w-3xl space-y-8 px-6 py-14">
	<header class="feuille space-y-3">
		<p class="font-mono text-sm text-primary">{entry.id}</p>
		<p class="text-xl leading-relaxed">{entry.summary}</p>
		<a
			class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
			href={entry.href}>{entry.title}<ArrowRight class="size-4" aria-hidden="true" /></a
		>
	</header>

	<section lang="fr" class="space-y-2 rounded-lg border bg-card p-6">
		<p class="text-sm text-muted-foreground">En français</p>
		<p class="leading-relaxed">{french.summary}</p>
		<a
			class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
			href={french.href}>{french.title}<ArrowRight class="size-4" aria-hidden="true" /></a
		>
	</section>

	{#if isRule}
		{#if trace}
			<div class="grid min-w-0 gap-8 rounded-lg border bg-card p-6">
				{@render list(
					'Where the rule lives',
					FileCode,
					trace.implementations,
					'No location found.'
				)}
				{@render list('Tested by', FlaskConical, trace.tests, 'No test calls it directly.')}
				{@render list('Used by', Workflow, trace.callers, 'No caller found.')}
			</div>
			<p class="text-sm text-muted-foreground">
				Read from the code graph graphify builds, at the places the domain documentation gives. A
				test that goes through another function does not show here.
			</p>
		{:else}
			<p class="text-sm text-muted-foreground">
				The page of this rule does not give its place in the code yet.
			</p>
		{/if}
	{/if}
</main>
