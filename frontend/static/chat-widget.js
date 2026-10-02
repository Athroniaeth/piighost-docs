// The documentation's chatbot, Chainlit's copilot widget, served by the chat
// itself. A file and not an inline script: the policy is script-src 'self'.
// The layout includes it only when PUBLIC_CHAT_URL is set at build time.
(() => {
	const server = document.currentScript?.dataset.server;
	if (!server) return;
	const root = document.documentElement;
	const theme = () => (root.classList.contains('dark') ? 'dark' : 'light');
	let mounted = '';
	const mount = () => {
		if (mounted === theme()) return;
		if (mounted) window.unmountChainlitWidget();
		mounted = theme();
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
