<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.entry.id} · piighost</title>
	<meta name="description" content={data.entry.summary} />
	<meta http-equiv="refresh" content="0; url={data.entry.href}" />
	<link rel="canonical" href="https://docs.piighost.dev{data.entry.href}" />
</svelte:head>

<main id="content" class="mx-auto max-w-2xl px-6 py-16">
	<p class="font-mono text-sm text-primary">{data.entry.id}</p>
	<p class="mt-1 text-sm text-muted-foreground">{data.entry.title}</p>
	<p class="mt-4 text-lg">{data.entry.summary}</p>
	<a class="mt-6 inline-block font-medium text-primary hover:underline" href={data.entry.href}
		>{data.entry.title} →</a
	>
</main>
