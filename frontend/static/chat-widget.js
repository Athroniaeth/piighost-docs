// The documentation's chatbot, Chainlit's copilot widget, served by the chat
// itself. A file and not an inline script: the policy is script-src 'self'.
// The layout includes it only when PUBLIC_CHAT_URL is set at build time.
(() => {
	const server = document.currentScript?.dataset.server;
	if (!server) return;

	// The widget reads its theme from the chat's /public/theme.json and appends
	// each stylesheet of `custom_fonts` to its shadow root. With none, it loads
	// Inter from fonts.googleapis.com, which the page's policy refuses (the
	// fonts are self-hosted). The docs' stylesheet for the widget is added to
	// the list: the widget then loads it, and never Google's.
	const theme = `${server}/public/theme.json`;
	const ownStyles = new URL('/chat-widget.css', location.origin).href;
	const fetch = window.fetch.bind(window);
	window.fetch = async (input, init) => {
		const response = await fetch(input, init);
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		if (url !== theme || !response.ok) return response;
		try {
			const body = await response.clone().json();
			body.custom_fonts = [...(body.custom_fonts ?? []), ownStyles];
			return new Response(JSON.stringify(body), {
				status: response.status,
				headers: { 'content-type': 'application/json' }
			});
		} catch {
			return response;
		}
	};

	const root = document.documentElement;
	const mode = () => (root.classList.contains('dark') ? 'dark' : 'light');
	let mounted = '';
	const mount = () => {
		if (mounted === mode()) return;
		if (mounted) window.unmountChainlitWidget();
		mounted = mode();
		window.mountChainlitWidget({
			chainlitServer: server,
			theme: mounted,
			customCssUrl: `${server}/public/copilot.css`,
			button: { imageUrl: `${server}/public/chat-bubble.svg` }
		});
	};
	const loader = document.createElement('script');
	loader.src = `${server}/copilot/index.js`;
	loader.onload = () => {
		mount();
		// The widget takes its theme at mount: follow the page's toggle.
		new MutationObserver(mount).observe(root, { attributes: true, attributeFilter: ['class'] });
	};
	document.body.append(loader);
})();
