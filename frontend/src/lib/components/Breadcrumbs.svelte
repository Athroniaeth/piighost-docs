<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { NavLink } from '@piighost/ui';

	/**
	 * Where the page sits. The last crumb is the page itself; a section with no
	 * page of its own (an empty href) is named, not linked.
	 */
	let { items, label = 'Breadcrumb' }: { items: NavLink[]; label?: string } = $props();
</script>

<nav aria-label={label}>
	<ol class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
		{#each items as item, index (item.href + item.label + index)}
			<li class="flex items-center gap-1">
				{#if index > 0}<ChevronRight class="size-3.5" aria-hidden="true" />{/if}
				{#if index === items.length - 1}
					<span aria-current="page" class="text-foreground">{item.label}</span>
				{:else if item.href}
					<a href={item.href} class="hover:text-foreground">{item.label}</a>
				{:else}
					<span>{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
