# syntax=docker/dockerfile:1
# The documentation site and its two MCP servers, from one build of the content.
#
# The site holds no copy of the documentation: the content stage reads piighost at
# PIIGHOST_REF, a branch or a commit. To build from a local commit instead,
# export it, so the build sees what a clone would and none of the checkout's
# virtualenvs or caches:
#
#   git -C ../piighost archive HEAD | tar -x -C /tmp/piighost-content
#   docker build --build-context piighost=/tmp/piighost-content --build-arg CONTENT=piighost .
#
# Three targets share the stages above them, so BuildKit builds the content once:
#   web        the prerendered site behind nginx, the only public entry
#   docs-mcp   the MCP server over the built pages
#   graph-mcp  graphify's MCP server over the code graph of piighost
ARG CONTENT=content-git

# BuildKit's own git source, not a RUN git fetch: it resolves the branch to its
# commit at every build, so a new commit on piighost misses the cache. A RUN
# keyed on the branch name stayed cached and served the old pages.
FROM scratch AS content-git
ARG PIIGHOST_REPO=https://github.com/Athroniaeth/piighost.git
ARG PIIGHOST_REF=master
ADD ${PIIGHOST_REPO}#${PIIGHOST_REF} /

FROM ${CONTENT} AS content

# The code graph, for each rule's trace. graphify parses with tree-sitter,
# locally and without an API key.
FROM python:3.13-slim AS graph
RUN pip install --no-cache-dir "graphifyy[mcp]==0.9.73"
WORKDIR /work
COPY --from=content /src ./src
COPY --from=content /tests ./tests
RUN graphify extract . --code-only --no-viz >/dev/null \
    && mkdir /graph && cp graphify-out/graph.json /graph/graph.json

FROM node:22-bookworm-slim AS site
# Chromium renders the Mermaid diagrams at build time, through mermaid-cli.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium PIIGHOST_CONTENT=/content
WORKDIR /app/frontend
# Manifest, lockfile and the vendored @piighost/ui first, to keep the install cached.
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
COPY frontend/vendor ./vendor
RUN corepack enable && pnpm install --frozen-lockfile
COPY frontend ./
COPY --from=content / /content
COPY --from=graph /graph/graph.json .graph/graph.json
# The chatbot's server, baked into the pages and their policy. Empty, no chatbot.
ARG PUBLIC_CHAT_URL=
ENV PUBLIC_CHAT_URL=$PUBLIC_CHAT_URL
# The OpenPanel client of the docs: public, it ships in every page anyway.
ARG PUBLIC_OPENPANEL_CLIENT_ID=41a2d535-a35a-4c3e-82ed-71697bde0fa9
ENV PUBLIC_OPENPANEL_CLIENT_ID=$PUBLIC_OPENPANEL_CLIENT_ID
RUN pnpm build

# Unprivileged nginx: runs as the nginx user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS web
ARG PUBLIC_CHAT_URL=
COPY deploy/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf deploy/mcp-proxy.conf /etc/nginx/
# The policy names the chatbot's origin, over https and its websocket.
USER root
RUN chat="${PUBLIC_CHAT_URL%/}" \
    && socket="$(printf %s "$chat" | sed 's#^https://#wss://#')" \
    && sed -i "s#__CHAT__#${chat:+$chat $socket}#; s#__CHAT_ORIGIN__#${chat}#g" \
        /etc/nginx/security-headers.conf
USER nginx
COPY --from=site /app/frontend/build /usr/share/nginx/html

FROM python:3.13-slim AS docs-mcp
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app
COPY mcp/pyproject.toml mcp/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY mcp/piighost_docs_mcp ./piighost_docs_mcp
RUN uv sync --frozen --no-dev
COPY --from=site /app/frontend/build /site
USER nobody
ENV PIIGHOST_SITE=/site PORT=8000
EXPOSE 8000
CMD ["/app/.venv/bin/piighost-docs-mcp"]

FROM python:3.13-slim AS graph-mcp
RUN pip install --no-cache-dir "graphifyy[mcp]==0.9.73"
COPY --from=graph /graph /graph
USER nobody
EXPOSE 8080
CMD ["python", "-m", "graphify.serve", "/graph/graph.json", "--transport", "http", "--host", "0.0.0.0", "--port", "8080", "--stateless"]
