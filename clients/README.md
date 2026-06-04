# Penpact SDK clients

The **TypeScript** SDK is hand-crafted for the best DX and lives in
[`packages/sdk`](../packages/sdk) (published as
[`@penpact/sdk`](https://www.npmjs.com/package/@penpact/sdk)).

The **Python, Go, and PHP** clients are generated from the OpenAPI spec
([`docs/openapi.yaml`](../docs/openapi.yaml)) — the single source of truth — so
they stay in lock-step with the API:

| Language | Location | Generator |
|---|---|---|
| Python | `clients/python` | `openapi-python-client` |
| Go | `clients/go` | `openapi-generator` (Go) |
| PHP | `clients/php` | `openapi-generator` (PHP) |

## Regenerate

```bash
./scripts/generate-sdks.sh
```

Python regenerates anywhere; Go/PHP need Java (openapi-generator). CI does all
three on every spec change — see `.github/workflows/sdks.yml`.

## Publishing

- **npm** (`@penpact/sdk`): the scope is reserved. Publish with
  `pnpm --filter @penpact/sdk publish --access public` after `npm login`, or cut
  a GitHub Release with the `NPM_TOKEN` secret set (the workflow publishes it).
- **PyPI / Packagist / Go modules**: add credentials/tags when ready; the
  generated packages carry the right metadata.
