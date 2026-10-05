<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { closeOnOutside } from '@piighost/ui';

	/**
	 * A panel folded above the content below the widths that show the side
	 * columns: the section tree, the page outline. It closes when a link in it
	 * is followed, on a tap outside, on Escape and on any navigation, so the
	 * next page never opens under a panel left unfolded.
	 */
	let {
		label,
		class: className = '',
		children
	}: { label: string; class?: string; children: Snippet } = $props();

	let open = $state(false);
	afterNavigate(() => (open = false));
</script>

<details
	class={['rounded-lg border bg-card', className]}
	data-folded-panel
	bind:open
	{@attach closeOnOutside}
>
	<summary class="cursor-pointer px-4 py-2.5 text-sm font-semibold">{label}</summary>
	{@render children()}
</details>
