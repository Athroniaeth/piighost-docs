# The MCP server of the piighost documentation, over the built site mounted at /site.
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY piighost_docs_mcp ./piighost_docs_mcp
RUN uv sync --frozen --no-dev
USER nobody
ENV PIIGHOST_SITE=/site PORT=8000
EXPOSE 8000
CMD ["/app/.venv/bin/piighost-docs-mcp"]
