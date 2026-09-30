#!/usr/bin/env bash
# Builds intervals-icu-mcp.mcpb: a one-click install bundle for Claude Desktop.
# Expects `npm run build` to have produced dist/. Production dependencies are
# installed into a staging directory, so the bundle works offline.
set -euo pipefail

cd "$(dirname "$0")/.."
stage=.mcpb-build
rm -rf "$stage"
mkdir -p "$stage"

cp mcpb/manifest.json package.json package-lock.json LICENSE README.md "$stage/"
cp -R dist "$stage/dist"
(cd "$stage" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)

npx --yes @anthropic-ai/mcpb pack "$stage" intervals-icu-mcp.mcpb
rm -rf "$stage"
