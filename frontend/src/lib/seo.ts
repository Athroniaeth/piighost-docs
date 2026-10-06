/**
 * What a page tells search engines and link previews about itself: the
 * share card and the schema.org data, built from what the page already holds.
 */
import type { NavLink } from '@piighost/ui';
import { labels, type Lang } from './i18n';

export const SITE_URL = 'https://docs.piighost.dev';

/** The share card, one per language: 1200 by 630, the size every preview expects. */
export const OG_IMAGE = { width: 1200, height: 630 } as const;
export const ogImageUrl = (lang: Lang) => `${SITE_URL}/og-${lang}.png`;

/** The Open Graph locale of each language. */
export const OG_LOCALE: Record<Lang, string> = { fr: 'fr_FR', en: 'en_US' };

const absolute = (href: string) => (href.startsWith('http') ? href : `${SITE_URL}${href}`);

/**
 * The trail as schema.org reads it, under the documentation's home. A crumb
 * without a page, a section of the guide, is left out: every item needs an
 * address.
 */
function breadcrumbList(lang: Lang, crumbs: NavLink[]) {
	const items = [{ href: `/${lang}/`, label: labels(lang).homeTitle }, ...crumbs].filter(
		(crumb) => crumb.href && !crumb.href.includes('#')
	);
	return {
		'@type': 'BreadcrumbList',
		itemListElement: items.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.label,
			item: absolute(crumb.href)
		}))
	};
}

/** A documentation page: the article and where it sits. */
export function pageGraph(page: {
	lang: Lang;
	route: string;
	title: string;
	description: string;
	breadcrumbs: NavLink[];
	modified?: string;
}) {
	const url = absolute(page.route);
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'TechArticle',
				headline: page.title,
				...(page.description ? { description: page.description } : {}),
				inLanguage: page.lang,
				url,
				mainEntityOfPage: url,
				image: ogImageUrl(page.lang),
				...(page.modified ? { dateModified: page.modified } : {}),
				isPartOf: {
					'@type': 'WebSite',
					name: labels(page.lang).docsName,
					url: `${SITE_URL}/`
				},
				publisher: {
					'@type': 'Organization',
					name: 'piighost',
					url: `https://piighost.dev/${page.lang}`
				}
			},
			breadcrumbList(page.lang, page.breadcrumbs)
		]
	};
}

/**
 * A schema.org block, ready for the head. A `<` is escaped inside the strings,
 * so no value can close the element. A data block is never run, so the
 * policy's script-src does not apply to it and it needs no hash.
 */
export const jsonLd = (data: unknown) =>
	`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
