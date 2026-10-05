/**
 * The words of an identifier's card, in both languages: the page and its
 * Markdown export say the same thing.
 */
export const CARD_TEXT = {
	fr: {
		card: 'Fiche',
		tests: 'Tests',
		definedIn: 'Défini dans',
		lives: 'Où vit la règle',
		livesEmpty: 'Aucun emplacement trouvé.',
		direct: 'Tests directs',
		directHint: "Le test, ou une fonction d'aide de son fichier, appelle le code de la règle.",
		directEmpty: "Aucun test n'appelle ce code directement.",
		indirect: 'Tests indirects',
		indirectHint:
			'Le test construit sa classe ou appelle une autre fonction de son module, qui mène à la règle.',
		indirectEmpty: 'Aucun test indirect trouvé.',
		untested:
			"Le graphe du code ne relie aucun test à cette règle. Ce n'est pas la preuve qu'aucun test ne la vérifie : un test qui passe par un autre module n'apparaît pas ici.",
		usedBy: 'Utilisé par',
		usedByEmpty: 'Aucun appelant trouvé.',
		more: (n: number) => `et ${n} de plus`,
		source:
			'Lu dans le graphe du code que construit graphify, aux emplacements que donne la documentation métier.',
		noPlace: 'La page de cette règle ne donne pas encore sa place dans le code.'
	},
	en: {
		card: 'Card',
		tests: 'Tests',
		definedIn: 'Defined in',
		lives: 'Where the rule lives',
		livesEmpty: 'No location found.',
		direct: 'Direct tests',
		directHint: "The test, or a helper of its file, calls the rule's code.",
		directEmpty: 'No test calls this code directly.',
		indirect: 'Indirect tests',
		indirectHint:
			'The test builds its class or calls another function of its module, which leads to the rule.',
		indirectEmpty: 'No indirect test found.',
		untested:
			'The code graph links no test to this rule. That does not prove no test checks it: a test that goes through another module does not show here.',
		usedBy: 'Used by',
		usedByEmpty: 'No caller found.',
		more: (n: number) => `and ${n} more`,
		source:
			'Read from the code graph graphify builds, at the places the domain documentation gives.',
		noPlace: 'The page of this rule does not give its place in the code yet.'
	}
} as const;
