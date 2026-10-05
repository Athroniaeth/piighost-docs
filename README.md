# piighost-docs

The documentation site of piighost, `docs.piighost.dev`: the technical guide
and the business wiki in one place, in the piighost identity.

The site holds no copy of the documentation. It reads a checkout of the
`piighost` repository at build time:

| Space | Source in `piighost` | Route |
|---|---|---|
| Technical guide | `docs/fr`, `docs/en`, navigation from `docs/zensical*.toml` | `/fr/guide/…`, `/en/guide/…` |
| Business wiki | `openwiki/`, maintained by OpenWiki | `/fr/domain/…`, `/en/domain/…` |

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

Every identifier is a link with a hover card. Its card, `/fr/ids/<ID>/` and
`/en/ids/<ID>/`, is the stable URL to cite from code, issues and the chatbot:
`/ids/<ID>/` leads to the reader's language. A rule's card lists the code the
wiki locates and the tests the code graph reaches, directly or through its
module.

## Develop

```bash
just install
PIIGHOST_CONTENT=~/piighost-besoins just content-check   # read the content, report problems
PIIGHOST_CONTENT=~/piighost-besoins just build           # prerender into frontend/build, then Pagefind
```

Diagrams are rendered once per source with mermaid-cli and the local Chromium
(`CHROMIUM_PATH`), cached in `frontend/static/diagrams/`.

## Deploy

One `Dockerfile` builds the site and its two MCP servers from one build of the
content: it clones piighost at `PIIGHOST_REF`, builds the code graph with
graphify, renders the diagrams with Chromium, prerenders the pages and indexes
them with Pagefind. `@piighost/ui` is not published: its packed build sits in
`frontend/vendor/`, refreshed with `pnpm pack` in `piighost-ui`.

| Target | What it serves |
|---|---|
| `web` | the site, behind nginx, with `/mcp` and `/mcp/code` proxied and rate limited |
| `docs-mcp` | the MCP server over the built pages |
| `graph-mcp` | graphify's MCP server over the code graph |

`compose.prod.yml` is the Coolify stack. Its build variables are
`PIIGHOST_REF` and `PUBLIC_CHAT_URL`, the chatbot's server, baked into the pages
and their content policy. Only `web` gets a domain.

To run the same stack from a local piighost commit:

```bash
git -C ../piighost archive HEAD | tar -x -C /tmp/piighost-content
docker compose up --build        # http://localhost:8080
```

The `Deploy` workflow checks the content of piighost's master, then calls the
Coolify webhook, on a push here. piighost's own Documentation workflow calls
the same webhook when `docs/` or `openwiki/` change on master, and the image
build stops on a broken page. Both repositories hold `COOLIFY_DEPLOY_WEBHOOK`
and `COOLIFY_TOKEN`.

Each page carries its own content policy as a meta tag, with the hash of its
inline bootstrap script, and nginx sends the rest of the policy as a header.
An unknown path gets the bilingual 404 page.

## Not done yet

- The backend (`backend/`, `Dockerfile.api`, from template-litestar-svelte) is
  not part of the stack any more: the MCP servers live in `mcp/` and graphify,
  the chatbot in `piighost-docs-chainlit`. It is to be removed.
