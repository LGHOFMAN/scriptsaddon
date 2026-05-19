#!/usr/bin/env bash
set -e

VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
OUTPUT_DIR="dist"
OUTPUT_FILE="${OUTPUT_DIR}/scriptsaddon-${VERSION}.xpi"

echo "Building ScriptsAddon v${VERSION}..."

mkdir -p "$OUTPUT_DIR"

zip -r "$OUTPUT_FILE" \
  manifest.json \
  background/ \
  content/ \
  editor/ \
  popup/ \
  shared/ \
  icons/ \
  --exclude "*.DS_Store" \
  --exclude "*~"

echo "Built: ${OUTPUT_FILE}"
