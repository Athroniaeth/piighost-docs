import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * The environment the site reads, at build time: the site is prerendered.
 */
export const variables = defineEnvVars({
	PUBLIC_CHAT_URL: {
		public: true,
		static: true,
		description:
			'The server of the documentation chatbot, embedded as its copilot widget. Unset, no chatbot.',
		schema: (value) => value?.replace(/\/+$/, '') || undefined
	},
	PUBLIC_OPENPANEL_CLIENT_ID: {
		public: true,
		static: true,
		description:
			'The OpenPanel client of docs.piighost.dev, in the organisation "piighost". Unset, no analytics.',
		schema: (value) => value || undefined
	}
});
