/**
 * What the docs report to a self-hosted OpenPanel, and nothing else.
 *
 * The set of events is closed on purpose: each property is a shape, never a
 * text a reader typed. The SDK is bundled and the events go to a same-origin
 * path nginx relays, so the policy stays connect-src 'self' and a blocker that
 * filters openpanel.dev has nothing to filter. Session replay is off: a library
 * whose point is that data does not leave cannot film its readers' screens.
 * The same reasoning as the site and the hub.
 */
import { OpenPanel } from '@openpanel/web';

export type AnalyticsEvent =
	| { name: 'page_view'; props: { space: string; lang: string } }
	| { name: 'page_copied'; props: { space: string; lang: string } }
	| { name: 'assistant_opened'; props: { assistant: string; lang: string } };

/** Same origin, relayed by nginx. */
const API_URL = '/api/op';

let panel: OpenPanel | null = null;

export function initAnalytics(clientId: string | undefined) {
	if (!clientId || panel) return;
	panel = new OpenPanel({
		clientId,
		apiUrl: API_URL,
		sessionReplay: { enabled: false },
		// Page views are sent by hand, typed above: the SDK would guess others.
		trackScreenViews: false,
		trackOutgoingLinks: false,
		trackAttributes: false
	});
}

export function track<E extends AnalyticsEvent>(event: E) {
	panel?.track(event.name, event.props);
}
