# The Chainlit chat over the piighost documentation and code.
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app.py chainlit.md chainlit_fr-FR.md ./
COPY .chainlit ./.chainlit
RUN mkdir -p /app/.files && chown -R nobody /app/.chainlit /app/.files
USER nobody
ENV HOME=/tmp
EXPOSE 8000
CMD ["/app/.venv/bin/chainlit", "run", "app.py", "--host", "0.0.0.0", "--port", "8000", "--headless"]
