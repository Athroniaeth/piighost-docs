<script lang="ts">
	import LangRedirect from '#lib/components/LangRedirect.svelte';
</script>

<!-- The root leads to the reader's language, French without script. -->
<LangRedirect path="/" fallback="fr" title="Documentation · piighost" />
