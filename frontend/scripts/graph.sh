#!/bin/sh
# Build the code graph of piighost with graphify, for the rule traceability.
#
# graphify parses the code with tree-sitter, locally and without an API key
# (--code-only). It runs on a copy of src/ and tests/ so that nothing lands in
# the piighost checkout. The graph is written to .graph/graph.json, which the
# content pipeline reads when it exists.
#
#   PIIGHOST_CONTENT=~/piighost-besoins sh scripts/graph.sh
set -e
content="${PIIGHOST_CONTENT:-$HOME/piighost-besoins}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
rsync -a --exclude __pycache__ "$content/src" "$content/tests" "$work/"
(cd "$work" && graphify extract . --code-only --no-viz >/dev/null)
mkdir -p .graph
cp "$work/graphify-out/graph.json" .graph/graph.json
echo "graph of $(git -C "$content" rev-parse --short HEAD) written to .graph/graph.json"
