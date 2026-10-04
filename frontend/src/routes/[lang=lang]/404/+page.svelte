<!-- nginx answers an unknown path with the page of its language and a 404
     status: /en/… gets the English one, any other path the French one. -->
<script lang="ts">
	import { page } from '$app/state';
	import NotFound from '#lib/components/NotFound.svelte';
</script>

<NotFound lang={page.params.lang === 'en' ? 'en' : 'fr'} />
