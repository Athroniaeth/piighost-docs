/** The interface labels, written in both languages as the charter asks. */
export const LABELS = {
	fr: {
		guide: 'Documentation technique',
		guideShort: 'Technique',
		guideDescription: 'Tutoriels, recettes, référence et concepts',
		domain: 'Documentation métier',
		domainShort: 'Métier',
		domainDescription: 'Besoins par profil, processus, règles et tests',
		catalog: 'Catalogue',
		site: 'Site',
		github: 'GitHub',
		toggleTheme: 'Changer de thème',
		language: 'Langue',
		menu: 'Menu',
		mainNavigation: 'Navigation principale',
		onThisPage: 'Sur cette page',
		previous: 'Précédent',
		next: 'Suivant',
		breadcrumb: "Fil d'Ariane",
		copy: 'Copier',
		copied: 'Copié',
		copyPage: 'Copier en Markdown',
		viewMarkdown: 'Voir le Markdown',
		edit: 'Modifier cette page',
		issue: 'Signaler un problème',
		search: 'Rechercher',
		searchPlaceholder: 'Rechercher dans la documentation',
		noResult: 'Aucun résultat',
		tagline: 'Tout ce que le modèle sait faire, rien de ce qu’il n’a pas à savoir.',
		license: 'piighost est sous licence MIT.',
		ecosystem: 'Écosystème',
		code: 'Code',
		homeEyebrow: 'Docs',
		homeTitle: 'Documentation',
		// The tab and the shared link say what the documentation is about; the
		// page itself keeps its heading.
		homeSeoTitle: 'Dé-identifier les données personnelles avant le LLM · documentation piighost',
		homeDescription:
			'piighost protège les données confidentielles envoyées à un LLM. Il remplace chaque valeur sensible par un jeton, puis la restaure dans la réponse.',
		docsName: 'Documentation piighost',
		ogImageAlt:
			'Le logo et le nom de piighost, au-dessus de la devise « Tout ce que le modèle sait faire, rien de ce qu’il n’a pas à savoir. » et de la ligne « Dé-identification réversible pour les agents LLM, en Python ».',
		homeLead:
			'piighost protège les données confidentielles dans les conversations avec un LLM. Il remplace chaque valeur sensible par un jeton avant l’envoi au modèle, puis la restaure dans la réponse.',
		homeTwoDocs:
			'Ce projet se veut open source et communautaire. Il propose donc deux documentations :',
		homeGuideItem: 'pour les développeurs qui installent, intègrent et configurent piighost.',
		homeDomainItem:
			'pour définir ensemble les règles de la dé-identification, c’est-à-dire ce que fait chaque traitement et les tests qui le vérifient.',
		homeNewPractice:
			'Dé-identifier une conversation avec un LLM est une pratique encore nouvelle, et ses règles ne sont écrites nulle part. La documentation métier est l’endroit où les proposer et les discuter.',
		homeWhy: 'Pourquoi dé-identifier ?',
		homeWhyBefore: 'Lisez',
		homeWhyText:
			'pour savoir ce que risquent vos données quand elles partent vers un LLM, et ce que le droit ne suffit pas à garantir.',
		guideArticle: 'une documentation technique',
		domainArticle: 'une documentation métier'
	},
	en: {
		guide: 'Technical docs',
		guideShort: 'Technical',
		guideDescription: 'Tutorials, recipes, reference and concepts',
		domain: 'Domain docs',
		domainShort: 'Domain',
		domainDescription: 'Needs by profile, processes, rules and tests',
		catalog: 'Catalog',
		site: 'Site',
		github: 'GitHub',
		toggleTheme: 'Toggle theme',
		language: 'Language',
		menu: 'Menu',
		mainNavigation: 'Main navigation',
		onThisPage: 'On this page',
		previous: 'Previous',
		next: 'Next',
		breadcrumb: 'Breadcrumb',
		copy: 'Copy',
		copied: 'Copied',
		copyPage: 'Copy as Markdown',
		viewMarkdown: 'View as Markdown',
		edit: 'Edit this page',
		issue: 'Report a problem',
		search: 'Search',
		searchPlaceholder: 'Search the documentation',
		noResult: 'No result',
		tagline: "Everything the model can do. Nothing it doesn't need to know.",
		license: 'piighost is MIT licensed.',
		ecosystem: 'Ecosystem',
		code: 'Code',
		homeEyebrow: 'Docs',
		homeTitle: 'Documentation',
		homeSeoTitle: 'De-identify PII before the LLM · piighost documentation',
		homeDescription:
			'piighost protects confidential data sent to an LLM. It replaces each sensitive value with a placeholder before the model, then restores it in the reply.',
		docsName: 'piighost documentation',
		ogImageAlt:
			'The piighost ghost logo and name, above the motto “Everything the model can do. Nothing it doesn’t need to know.” and the line “Reversible PII masking for LLM agents, in Python”.',
		homeLead:
			'piighost protects confidential data in conversations with an LLM. It replaces each sensitive value with a placeholder before the model sees it, then restores it in the reply.',
		homeTwoDocs:
			'This project aims to be open source and community-driven, so it has two sets of documentation:',
		homeGuideItem: 'for developers who install, integrate and configure piighost.',
		homeDomainItem:
			'to define together the rules of de-identification, that is what each process does and the tests that check it.',
		homeNewPractice:
			'De-identifying a conversation with an LLM is still a new practice, and its rules are written down nowhere. The domain documentation is where to propose and discuss them.',
		homeWhy: 'Why de-identify?',
		homeWhyBefore: 'Read',
		homeWhyText:
			'to learn what your data risks when it goes to an LLM, and what the law alone cannot guarantee.',
		guideArticle: 'technical documentation',
		domainArticle: 'domain documentation'
	}
} as const;

export type Lang = keyof typeof LABELS;
export const labels = (lang: string) => LABELS[lang === 'en' ? 'en' : 'fr'];
