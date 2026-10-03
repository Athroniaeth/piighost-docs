// Read the whole site the way the build does, and fail on any problem: a broken
// link, an unknown identifier, an identifier defined twice, a missing asset.
//   pnpm content:check
import { getSite } from '../src/lib/server/content/site';

const site = await getSite();
const bySpace = { guide: 0, wiki: 0 };
for (const page of site.pages.values()) bySpace[page.space]++;
console.log(
	`${site.pages.size} pages (guide ${bySpace.guide}, wiki ${bySpace.wiki}), ${[...site.ids.values()].map((index) => index.size).join(' and ')} identifiers (fr and en)`
);
if (site.problems.length) {
	console.error(`${site.problems.length} problem(s):`);
	for (const problem of site.problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log('no problem');
