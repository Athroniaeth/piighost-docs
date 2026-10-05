// The addresses without a language, the root and /ids/<ID>/, lead to the
// reader's: French for a browser set to French, English otherwise. A file and
// not an inline script: the policy is script-src 'self'. Without script, the
// page's noscript refresh leads to its fallback language.
(() => {
	const path = document.currentScript?.dataset.path ?? '/';
	const lang = (navigator.language ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
	location.replace(`/${lang}${path}${location.search}${location.hash}`);
})();
