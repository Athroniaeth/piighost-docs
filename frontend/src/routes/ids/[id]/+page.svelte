<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import FileCode from '@lucide/svelte/icons/file-code';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Workflow from '@lucide/svelte/icons/workflow';

	/**
	 * The card of an identifier, the URL to cite: what it says, where it is
	 * written, and for a rule where it lives in the code and which tests guard it.
	 */
	let { data } = $props();

	const entry = $derived(data.entry);
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
				<p class="px-2 text-sm text-muted-foreground">et {refs.length - SHOWN} autres</p>
			{/if}
		{/if}
	</section>
{/snippet}

<main id="content" class="mx-auto max-w-3xl space-y-8 px-6 py-14">
	<header class="feuille space-y-3">
		<p class="font-mono text-sm text-primary">{entry.id}</p>
		<p class="text-xl leading-relaxed">{entry.summary}</p>
		<a
			class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
			href={entry.href}>{entry.title}<ArrowRight class="size-4" aria-hidden="true" /></a
		>
	</header>

	{#if isRule}
		{#if trace}
			<div class="grid min-w-0 gap-8 rounded-lg border bg-card p-6">
				{@render list(
					'Où vit la règle',
					FileCode,
					trace.implementations,
					'Aucun emplacement relevé.'
				)}
				{@render list(
					'Testée par',
					FlaskConical,
					trace.tests,
					'Aucun test ne l’appelle directement.'
				)}
				{@render list('Utilisée par', Workflow, trace.callers, 'Aucun appelant relevé.')}
			</div>
			<p class="text-sm text-muted-foreground">
				Relevé dans le graphe du code construit par graphify, à partir des emplacements que donne le
				wiki. Un test qui passe par une autre fonction n’apparaît pas ici.
			</p>
		{:else}
			<p class="text-sm text-muted-foreground">
				La page de cette règle ne donne pas encore son emplacement dans le code.
			</p>
		{/if}
	{/if}
</main>
