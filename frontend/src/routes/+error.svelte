<!-- A navigation that fails in the browser, a page the site does not have,
     shows the same page as the one nginx serves. -->
<script lang="ts">
	import { page } from '$app/state';
	import NotFound from '#lib/components/NotFound.svelte';
</script>

<NotFound lang={page.url.pathname.startsWith('/en') ? 'en' : 'fr'} />
