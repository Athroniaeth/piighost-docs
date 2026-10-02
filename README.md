# piighost-docs

The documentation site of piighost, `docs.piighost.dev`: the technical guide
and the business wiki in one place, in the piighost identity.

The site holds no copy of the documentation. It reads a checkout of the
`piighost` repository at build time:

| Space | Source in `piighost` | Route |
|---|---|---|
| Technical guide | `docs/fr`, `docs/en`, navigation from `docs/zensical*.toml` | `/fr/guide/…`, `/en/guide/…` |
| Business wiki | `openwiki/`, maintained by OpenWiki | `/fr/wiki/…` |

The pages stay written in the Zensical dialect (admonitions, tabs, cards,
`{ .pii }` chips): `frontend/src/lib/server/content/preprocess.ts` turns it into
standard directives, and the components come from
[`@piighost/ui`](../piighost-ui).

## What the build checks

The build fails rather than ship a broken page:

- a link to a page or an anchor that does not exist,
- an identifier (`DPO-9`, `BR-MSG-05`, `AT-OPS-2-1`, `ECART-09`) that the wiki
  does not define, or that it defines twice,
- a missing image.

Every identifier is a link with a hover card, and `/ids/<ID>/` is the stable
URL to cite from code, issues and the chatbot.

## Develop

```bash
just install
PIIGHOST_CONTENT=~/piighost-besoins just content-check   # read the content, report problems
PIIGHOST_CONTENT=~/piighost-besoins just build           # prerender into frontend/build, then Pagefind
```

Diagrams are rendered once per source with mermaid-cli and the local Chromium
(`CHROMIUM_PATH`), cached in `frontend/static/diagrams/`.

## Not done yet

- The backend (`backend/`, from template-litestar-svelte) is the place of the
  public MCP (documentation and graphify) and of the chatbot, steps 2 to 4.
- Deployment: `Dockerfile.web` still serves the template's `frontend/dist`, it
  will serve `frontend/build`; the content policy needs the hashes of
  SvelteKit's inline bootstrap script and `wasm-unsafe-eval` for Pagefind.
- The `repository_dispatch` workflow that rebuilds on a change in `piighost`.
