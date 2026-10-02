# graphify's MCP server over the code graph of piighost, mounted at /graph.
FROM python:3.13-slim
RUN pip install --no-cache-dir "graphifyy[mcp]==0.9.73"
USER nobody
EXPOSE 8080
CMD ["python", "-m", "graphify.serve", "/graph/graph.json", "--transport", "http", "--host", "0.0.0.0", "--port", "8080", "--stateless"]
