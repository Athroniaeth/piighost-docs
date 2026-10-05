<script lang="ts">
	import LangRedirect from '#lib/components/LangRedirect.svelte';

	let { data } = $props();
</script>

<!-- The address code and issues cite leads to the card in the reader's language,
     English without script, as the first cards were. -->
<LangRedirect path="/ids/{data.id}/" fallback="en" title="{data.id} · piighost" />
