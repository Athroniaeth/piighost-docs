/** The interface labels, written in both languages as the charter asks. */
export const LABELS = {
	fr: {
		guide: 'Documentation technique',
		guideShort: 'Technique',
		guideDescription: 'Tutoriels, recettes, référence et concepts',
		domain: 'Documentation métier',
		domainShort: 'Métier',
		domainDescription: 'Besoins par profil, processus, règles et tests',
		hub: 'Hub',
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
		homeTitle: 'Documentation piighost',
		homeLead:
			'piighost protège les données confidentielles dans les conversations avec un LLM. Il remplace chaque valeur sensible par un jeton avant l’envoi au modèle, puis la restaure dans la réponse.',
		homeTwoDocs:
			'Ce projet se veut open source et communautaire. Il propose donc deux documentations :',
		homeGuideItem: 'pour les développeurs qui installent, intègrent et configurent piighost.',
		homeDomainItem:
			'pour définir ensemble les règles de la dé-identification, c’est-à-dire ce que fait chaque traitement et les tests qui le vérifient.',
		homeNewPractice:
			'Dé-identifier une conversation avec un LLM est une pratique encore nouvelle, et ses règles ne sont écrites nulle part. La documentation métier est l’endroit où les proposer et les discuter.',
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
		hub: 'Hub',
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
		homeTitle: 'piighost documentation',
		homeLead:
			'piighost protects confidential data in conversations with an LLM. It replaces each sensitive value with a placeholder before the model sees it, then restores it in the reply.',
		homeTwoDocs:
			'This project aims to be open source and community-driven, so it has two sets of documentation:',
		homeGuideItem: 'for developers who install, integrate and configure piighost.',
		homeDomainItem:
			'to define together the rules of de-identification, that is what each process does and the tests that check it.',
		homeNewPractice:
			'De-identifying a conversation with an LLM is still a new practice, and its rules are written down nowhere. The domain documentation is where to propose and discuss them.',
		guideArticle: 'technical documentation',
		domainArticle: 'domain documentation'
	}
} as const;

export type Lang = keyof typeof LABELS;
export const labels = (lang: string) => LABELS[lang === 'en' ? 'en' : 'fr'];
