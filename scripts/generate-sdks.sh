#!/usr/bin/env bash
# Regenerate the multi-language SDK clients from the OpenAPI spec.
# Python needs only Python; Go/PHP use openapi-generator (needs Java).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Validating spec"
npx -y @redocly/cli@latest lint docs/openapi.yaml

echo "→ Python (openapi-python-client)"
python3 -m pip install --quiet --user openapi-python-client
rm -rf clients/python
python3 -m openapi_python_client generate \
  --path docs/openapi.yaml --output-path clients/python --overwrite || true

if command -v java >/dev/null 2>&1; then
  echo "→ Go (openapi-generator)"
  rm -rf clients/go
  npx -y @openapitools/openapi-generator-cli generate \
    -i docs/openapi.yaml -g go -o clients/go \
    --additional-properties=packageName=penpact,isGoSubmodule=true

  echo "→ PHP (openapi-generator)"
  rm -rf clients/php
  npx -y @openapitools/openapi-generator-cli generate \
    -i docs/openapi.yaml -g php -o clients/php \
    --additional-properties=invokerPackage=Penpact\\Sdk,composerVendorName=penpact,composerProjectName=sdk
else
  echo "⚠ Java not found — skipping Go/PHP. CI (.github/workflows/sdks.yml) generates them."
fi
echo "✓ Done."
